const Scenarios = (() => {
  const names = {
    base: 'Базовая кривая',
    parallel_up: 'Параллельный вверх',
    parallel_down: 'Параллельный вниз',
    steepener: 'Увеличение наклона',
    flattener: 'Уменьшение наклона',
    short_rate_up: 'Краткосрочные вверх',
    short_rate_down: 'Краткосрочные вниз',
  };
  const codes = new Map(Object.entries(names).map(([code, name]) => [name, code]));
  const columns = {
    date: 'отчётная дата',
    name: 'сценарий',
    label: 'бакет',
    tenor: 'расчётный тенор, лет',
    rate: 'доходность, % годовых',
  };
  const dayMs = 86_400_000;

  function csvNumber(value, description) {
    const text = value.replace(',', '.');
    const number = Number(text);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(number)) {
      throw new Error(`Проверьте ${description} в выгрузке кривых.`);
    }
    return number;
  }

  function point(label, tenor, discountFactor) {
    if (typeof label !== 'string' || !label || !Number.isFinite(tenor) || tenor <= 0 ||
        !Number.isFinite(discountFactor) || discountFactor <= 0) {
      throw new Error('В кривых нужны положительные теноры и коэффициенты дисконтирования.');
    }
    const rate = -Math.log(discountFactor) / tenor;
    if (!Number.isFinite(rate)) throw new Error('Нулевая ставка вышла за пределы точности расчёта.');
    return { label, tenor, discountFactor, rate };
  }

  function fromCsv(text, fileName) {
    const rows = Csv.parse(text, Object.values(columns), fileName);
    const reportDate = rows[0][columns.date];
    const provenance = rows[0]['происхождение данных'];
    const curves = new Map();
    for (const row of rows) {
      if (row[columns.date] !== reportDate || row['происхождение данных'] !== provenance) {
        throw new Error('Загрузите кривые одного расчёта на одну отчётную дату.');
      }
      const name = row[columns.name];
      const code = codes.get(name);
      if (!code) throw new Error(`Неизвестный сценарий кривой «${name}».`);
      const tenor = csvNumber(row[columns.tenor], 'тенор');
      const rate = csvNumber(row[columns.rate], 'доходность');
      if (!curves.has(code)) curves.set(code, []);
      curves.get(code).push(point(row[columns.label], tenor, Math.exp(-rate / 100 * tenor)));
    }
    return { reportDate, provenance, curves };
  }

  function fromJson(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Файл результата кривых содержит некорректный JSON.'); }
    if (!Array.isArray(data?.curves)) throw new Error('Выберите JSON с результатом расчёта кривых.');
    const curves = new Map();
    for (const curve of data.curves) {
      const code = curve?.curveCode;
      if (!Object.hasOwn(names, code) || !Array.isArray(curve.points) || curves.has(code)) {
        throw new Error('В результате кривых есть неизвестный, пустой или повторный сценарий.');
      }
      curves.set(code, curve.points.map((p) => point(p?.bucketLabel, p?.tenorYears, p?.discountFactor)));
    }
    const provenance = data.dataProvenance === 'synthetic' ? 'Синтетические'
      : data.dataProvenance === 'market' ? 'Рыночные' : '';
    return { reportDate: data.reportDate, provenance, curves };
  }

  function fromFile(input, fileName) {
    const text = input.replace(/^\uFEFF/, '').trim();
    const bundle = /\.json$/i.test(fileName) || text.startsWith('{') ? fromJson(text) : fromCsv(text, fileName);
    if (!Portfolio.isDate(bundle.reportDate)) throw new Error('Проверьте отчётную дату кривых.');
    const base = bundle.curves.get('base');
    if (!base?.length || bundle.curves.size < 2) throw new Error('Для оценки нужны базовая и хотя бы одна стрессовая кривая.');
    for (const points of bundle.curves.values()) points.sort((a, b) => a.tenor - b.tenor);
    for (const [code, points] of bundle.curves) {
      const labels = new Set(points.map((p) => p.label));
      if (labels.size !== points.length || points.some((p, i) => i > 0 && p.tenor === points[i - 1].tenor)) {
        throw new Error(`В сценарии «${names[code]}» повторяются узлы кривой.`);
      }
      if (points.length !== base.length || points.some((p, i) => p.tenor !== base[i].tenor || p.label !== base[i].label)) {
        throw new Error(`Сетка сценария «${names[code]}» отличается от базовой кривой.`);
      }
    }
    return bundle;
  }

  function discount(points, years) {
    if (years === 0) return 1;
    const index = points.findIndex((p) => years <= p.tenor);
    if (index !== -1 && points[index].tenor === years) return points[index].discountFactor;
    if (index <= 0) return Math.exp(-points.at(index).rate * years);
    const left = points[index - 1], right = points[index];
    const weight = (years - left.tenor) / (right.tenor - left.tenor);
    return Math.exp(-(left.rate + weight * (right.rate - left.rate)) * years);
  }

  function evaluate(bundle, batch, reportDate, dealId = '') {
    if (!Portfolio.isDate(reportDate)) throw new Error('Укажите отчётную дату денежного потока.');
    if (reportDate !== bundle.reportDate) throw new Error('Отчётная дата потоков должна совпадать с датой кривых.');
    if (batch.warnings.length) throw new Error('Исправьте расхождения в сверке денежных потоков перед оценкой.');
    const deals = dealId ? batch.deals.filter((deal) => deal.id === dealId) : batch.deals;
    const origin = Date.parse(`${reportDate}T00:00:00Z`);
    const amounts = new Map();
    for (const deal of deals) {
      if (deal.reportDate && deal.reportDate !== reportDate) {
        throw new Error(`Отчётная дата сделки ${deal.id} по входному CSV — ${deal.reportDate}. Выберите сделки на дату кривых.`);
      }
      const sign = deal.side === 'LIABILITY' && deal.opening_principal > 0 ? -1 : 1;
      for (const payment of deal.payments) {
        const days = (Date.parse(`${payment.date}T00:00:00Z`) - origin) / dayMs;
        if (days < 0) throw new Error(`У сделки ${deal.id} есть платёж до отчётной даты. Проверьте вход калькулятора.`);
        amounts.set(days, (amounts.get(days) ?? 0) + sign * payment.total);
      }
    }
    if (!amounts.size) throw new Error('В выбранных сделках нет платежей для оценки.');
    const results = Object.entries(names).filter(([code]) => bundle.curves.has(code)).map(([code, name]) => {
      const points = bundle.curves.get(code);
      let pv = 0;
      for (const [days, amount] of amounts) pv += amount * discount(points, days / 365);
      if (!Number.isFinite(pv)) throw new Error(`Не удалось оценить сценарий «${name}».`);
      return { code, name, pv };
    });
    const base = results[0].pv;
    for (const result of results) {
      result.delta = result.pv - base;
      if (!Number.isFinite(result.delta)) throw new Error('Изменение стоимости вышло за пределы точности расчёта.');
    }
    return { reportDate, dealId, dealCount: deals.length, results };
  }

  function exportRows(result) {
    return [
      ['reporting_date', 'instrument_id', 'deal_count', 'scenario_code', 'scenario', 'pv_rub', 'delta_vs_base_rub'],
      ...result.results.map((row) => [
        result.reportDate, result.dealId, result.dealCount, row.code, row.name, row.pv.toFixed(2), row.delta.toFixed(2),
      ]),
    ];
  }

  return { fromFile, evaluate, exportRows };
})();
