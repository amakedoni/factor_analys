import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = ['portfolio', 'csv', 'calculator', 'cashflows', 'scenarios'].map((name) => read('src/' + name + '.js'));
const { Portfolio, Csv, Calculator, Cashflows, Scenarios } = vm.runInNewContext(
  source.join('\n') + '\n({ Portfolio, Csv, Calculator, Cashflows, Scenarios })',
);
const demoDate = '2026-07-31';
const inputDeal = {
  id: 'SYN-00001', valuationDate: demoDate, maturityDate: '2027-07-31',
  principal: 100000, paymentType: 'ANNUITY', rateType: 'FIXED', rate: 0.1,
};
const flows = Cashflows.fromCsv(read('data/integration/deal_summary.csv'), read('data/integration/cashflows.csv'));
const curves = Scenarios.fromFile(read('data/integration/curves.csv'), 'curves.csv');

test('calculator export uses the normalized v1 columns and the synthetic benchmark', () => {
  const deals = Portfolio.generate({ ...Portfolio.defaults, count: 30, valuationDate: demoDate }).deals;
  const input = Calculator.exportInput(deals);
  assert.equal(input.charCodeAt(0), 'd'.charCodeAt(0));
  assert.equal(input.split('\r\n', 1)[0].split(';').length, 29);
  const rows = Csv.parse(input, ['deal_id', 'rate_type_cd', 'discriminator'], 'calculator input');
  assert.equal(rows.length, 30);
  assert.equal(rows[0].deal_id, '1');
  assert.equal(rows[0].report_dttm, demoDate);
  const floating = rows.find((row) => row.rate_type_cd === 'FLOAT');
  const deal = deals[Number(floating.deal_id) - 1];
  assert.equal(Number(floating.interest_rate), deal.spread);
  assert.equal(Number(floating.base_indicator_rate), deal.benchmark);
  assert.equal(rows.find((row) => row.discriminator === 'SIMPLE').regular_payment_rule_period_cd, '');
});

test('actual calculator outputs and semicolon-separated curve export value all seven scenarios', () => {
  assert.equal(flows.warnings.length, 0);
  assert.equal(curves.curves.get('base').length, 23);
  const result = Scenarios.evaluate(curves, flows, demoDate);
  assert.equal(result.results.length, 7);
  assert.equal(result.results[0].pv.toFixed(2), '98119.01');
  assert.equal(result.results[1].delta.toFixed(2), '-2055.49');
  assert.equal(Scenarios.exportRows(result).length, 8);
});

test('input reconciliation verifies report date and rejects partial calculator output for valuation', () => {
  const input = Calculator.exportInput([inputDeal]);
  const matched = Calculator.reconcileInput(flows, input);
  assert.equal(matched.reportDate, demoDate);
  assert.equal(matched.warnings.length, 0);
  assert.throws(() => Scenarios.evaluate(curves, flows, '2026-07-30'), /совпадать с датой кривых/);
  const changedDate = Calculator.reconcileInput(flows, input.replaceAll(demoDate, '2026-07-30'));
  assert.throws(() => Scenarios.evaluate(curves, changedDate, demoDate), /Отчётная дата сделки 1/);
  const partial = Calculator.reconcileInput(flows, Calculator.exportInput([inputDeal, { ...inputDeal, id: 'SYN-00002' }]));
  assert.match(partial.warnings[0], /нет результата/);
  assert.throws(() => Scenarios.evaluate(curves, partial, demoDate), /Исправьте расхождения/);
  const liability = Calculator.reconcileInput(flows, input.replace(';ASSET;', ';LIABILITY;'));
  assert.equal(Scenarios.evaluate(curves, liability, demoDate).results[0].pv.toFixed(2), '-98119.01');
});

test('JSON uses supplied discount factors and rejects incomplete tenor grids', () => {
  const point = (tenorYears, discountFactor) => ({ tenorYears, discountFactor, bucketLabel: String(tenorYears) });
  const payload = { reportDate: '2024-01-01', curves: [
    { curveCode: 'base', points: [point(1, 0.9), point(2, 0.8)] },
    { curveCode: 'parallel_up', points: [point(1, 0.85), point(2, 0.75)] },
  ] };
  const bundle = Scenarios.fromFile(JSON.stringify(payload), 'curves.json');
  const batch = { warnings: [], deals: [{
    id: '1', payments: [
      { date: '2024-01-01', total: 10 },
      { date: '2024-12-31', total: 100 },
    ],
  }] };
  const result = Scenarios.evaluate(bundle, batch, payload.reportDate, '1');
  assert.equal(result.results[0].pv, 100);
  assert.equal(result.results[1].delta, -5);
  payload.curves[1].points.pop();
  assert.throws(() => Scenarios.fromFile(JSON.stringify(payload), 'curves.json'), /Сетка сценария/);
});
