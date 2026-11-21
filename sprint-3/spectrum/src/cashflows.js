const Cashflows = (() => {
  const fields = {
    summary: ['instrument_id', 'opening_principal', 'total_principal', 'total_interest', 'closing_balance', 'flow_count'],
    flows: ['instrument_id', 'payment_date', 'cash_flow_type', 'amount'],
  };
  const normalizeZero = (amount) => Math.abs(amount) < 0.000001 ? 0 : amount;

  function number(value, fileName, row, field) {
    const decimal = value.replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(decimal) || !Number.isFinite(Number(decimal))) {
      throw new Error(`${fileName}: проверьте число в поле ${field}, строка ${row + 2}.`);
    }
    return normalizeZero(Number(decimal));
  }

  function fromCsv(summaryText, flowsText, source = 'Выгрузка команды 1') {
    const summaries = Csv.parse(summaryText, fields.summary, 'deal_summary.csv');
    const flows = Csv.parse(flowsText, fields.flows, 'cashflows.csv');
    const deals = new Map();
    summaries.forEach((row, index) => {
      const id = row.instrument_id;
      if (!id) throw new Error(`deal_summary.csv: пустой ID в строке ${index + 2}.`);
      if (deals.has(id)) throw new Error(`deal_summary.csv: повторяется сделка ${id}.`);
      const values = Object.fromEntries(fields.summary.slice(1).map((key) => [key, number(row[key], 'deal_summary.csv', index, key)]));
      if (!Number.isInteger(values.flow_count) || values.flow_count < 0) throw new Error(`deal_summary.csv: неверное количество потоков в строке ${index + 2}.`);
      deals.set(id, { id, ...values, dates: new Map(), sourceCount: 0 });
    });

    const unknown = new Set();
    flows.forEach((row, index) => {
      const id = row.instrument_id;
      if (!id) throw new Error(`cashflows.csv: пустой ID в строке ${index + 2}.`);
      if (!Portfolio.isDate(row.payment_date)) throw new Error(`cashflows.csv: неверная дата в строке ${index + 2}. Ожидается ГГГГ-ММ-ДД.`);
      const type = row.cash_flow_type.toUpperCase();
      if (type !== 'PRINCIPAL' && type !== 'INTEREST') throw new Error(`cashflows.csv: тип платежа «${type}» в строке ${index + 2}. Поддерживаются PRINCIPAL и INTEREST.`);
      const amount = number(row.amount, 'cashflows.csv', index, 'amount');
      const deal = deals.get(id);
      if (!deal) { unknown.add(id); return; }
      const payment = deal.dates.get(row.payment_date) ?? { date: row.payment_date, principal: 0, interest: 0 };
      payment[type.toLowerCase()] += amount;
      deal.dates.set(row.payment_date, payment);
      deal.sourceCount += 1;
    });
    const warnings = [];
    if (unknown.size) warnings.push(`В файле платежей ${unknown.size} ID без строки в сводке. Например, ${[...unknown].slice(0, 3).join(', ')}.`);

    for (const deal of deals.values()) {
      deal.payments = [...deal.dates.values()].sort((a, b) => a.date.localeCompare(b.date)).map((payment) => ({
        ...payment, total: payment.principal + payment.interest,
      }));
      delete deal.dates;
      const totals = deal.payments.reduce((sum, row) => ({ principal: sum.principal + row.principal, interest: sum.interest + row.interest }), { principal: 0, interest: 0 });
      const issues = [];
      const off = (left, right) => Math.abs(left - right) >= 0.01;
      if (deal.sourceCount !== deal.flow_count) issues.push('количество строк CF');
      if (off(totals.principal, deal.total_principal)) issues.push('сумма тела');
      if (off(totals.interest, deal.total_interest)) issues.push('сумма процентов');
      if (off(deal.opening_principal - deal.total_principal, deal.closing_balance)) issues.push('конечный остаток');
      if (issues.length) warnings.push(`Сделка ${deal.id}: сверьте ${issues.join(', ')}.`);
      deal.issues = issues;
    }
    return { source, deals: [...deals.values()], rowCount: flows.length, warnings };
  }

  function byYear(payments) {
    const years = new Map();
    for (const payment of payments) {
      const year = payment.date.slice(0, 4);
      const current = years.get(year) ?? { year, principal: 0, interest: 0 };
      current.principal += payment.principal;
      current.interest += payment.interest;
      years.set(year, current);
    }
    return [...years.values()];
  }

  function exportRows(deal) {
    return [
      ['instrument_id', 'payment_date', 'principal', 'interest', 'total'],
      ...deal.payments.map((p) => [deal.id, p.date, p.principal.toFixed(2), p.interest.toFixed(2), p.total.toFixed(2)]),
    ];
  }

  return { fromCsv, byYear, exportRows };
})();
