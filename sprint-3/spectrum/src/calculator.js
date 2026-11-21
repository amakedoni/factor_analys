const Calculator = (() => {
  // cf-normalizer/contracts/normalized-deals-v1.json в общей репе.
  const fields = [
    'deal_id', 'report_dttm', 'discriminator', 'currency_id', 'side', 'portfolio_key',
    'current_principal_amt', 'deal_dttm', 'maturity_dttm', 'rate_type_cd', 'interest_rate',
    'base_indicator_rate', 'cap_limit_interest_rate', 'floor_limit_interest_rate',
    'accrued_interest', 'day_convention_cd',
    'interest_payment_rule_start_dttm', 'interest_payment_rule_period_cd', 'interest_payment_rule_day_num',
    'regular_payment_rule_start_dttm', 'regular_payment_rule_period_cd', 'regular_payment_rule_day_num',
    'repricing_rule_start_dttm', 'repricing_rule_period_cd', 'repricing_rule_day_num',
    'interest_payment', 'principal_payment', 'repricing_dttm_schedule', 'repricing_dttm_rate_schedule_fixed',
  ];
  const amortization = { ANNUITY: 'ANN', LINEAR: 'RGM', BULLET: 'SIMPLE' };

  function exportInput(deals) {
    const rows = deals.map((deal) => {
      const day = Number(deal.valuationDate.slice(-2));
      const monthly = [deal.valuationDate, '1M', day];
      const principalRule = deal.paymentType === 'BULLET' ? ['', '', ''] : monthly;
      const floating = deal.rateType === 'FLOATING';
      return [
        Number(deal.id.slice(4)), deal.valuationDate, amortization[deal.paymentType], 'RUB', 'ASSET', 0,
        deal.principal.toFixed(2), deal.valuationDate, deal.maturityDate, floating ? 'FLOAT' : 'FIXED',
        (floating ? deal.spread : deal.rate).toFixed(4), floating ? deal.benchmark.toFixed(4) : '',
        '', '', '0', 'ACT_365', ...monthly, ...principalRule, '', '', '', '', '', '', '',
      ];
    });
    return Csv.serialize([fields, ...rows], { delimiter: ';', bom: false });
  }

  function reconcileInput(batch, text) {
    const rows = Csv.parse(text, ['deal_id', 'report_dttm', 'current_principal_amt'], 'Входной CSV калькулятора');
    const expected = new Map();
    for (const row of rows) {
      const principal = Number(row.current_principal_amt);
      if (!/^-?\d+$/.test(row.deal_id) || !Portfolio.isDate(row.report_dttm) || !Number.isFinite(principal) || principal <= 0) {
        throw new Error('Проверьте ID, отчётные даты и суммы в нормализованном входном CSV.');
      }
      const id = String(BigInt(row.deal_id));
      if (expected.has(id)) throw new Error(`Сделка ${id} повторяется во входном CSV.`);
      expected.set(id, { reportDate: row.report_dttm, principal, side: row.side });
    }
    const warnings = [...batch.warnings];
    const received = new Set(batch.deals.map((deal) => deal.id));
    const missing = [...expected.keys()].filter((id) => !received.has(id));
    if (missing.length) warnings.push(`По ${missing.length} сделкам из входа нет результата. ID: ${missing.slice(0, 3).join(', ')}.`);
    const deals = batch.deals.map((deal) => {
      const entry = expected.get(deal.id);
      if (!entry) warnings.push(`Сделка ${deal.id} из сводки отсутствует во входном CSV.`);
      else if (Math.abs(Math.abs(deal.opening_principal) - entry.principal) >= 0.01) {
        warnings.push(`Сделка ${deal.id}: начальный долг не совпадает с входным CSV.`);
      }
      return { ...deal, reportDate: entry?.reportDate, side: entry?.side };
    });
    const dates = new Set(rows.map((row) => row.report_dttm));
    return { ...batch, deals, warnings, reportDate: dates.size === 1 ? rows[0].report_dttm : '' };
  }

  return { exportInput, reconcileInput };
})();
