const Portfolio = (() => {
  const paymentTypes = {
    ANNUITY: 'Аннуитетные', LINEAR: 'Дифференцированные', BULLET: 'В конце срока',
  };
  const rateTypes = { FIXED: 'Фиксированная', FLOATING: 'Плавающая' };
  const termProfiles = { uniform: 'Равномерно', short: 'Больше коротких', long: 'Больше длинных' };
  const defaults = Object.freeze({
    count: 120, seed: '4317', valuationDate: '2026-09-30',
    amountMin: 200000, amountMax: 1100000, termMin: 12, termMax: 84,
    rateMin: 10, rateMax: 19, benchmark: 14, termProfile: 'uniform',
    annuity: 60, linear: 30, bullet: 10, fixed: 70, floating: 30,
  });
  const presets = {
    standard: defaults,
    short: { ...defaults, termMin: 6, termMax: 36, termProfile: 'short', fixed: 85, floating: 15, seed: '6002' },
    floating: { ...defaults, termMin: 24, termMax: 120, termProfile: 'long', fixed: 25, floating: 75, seed: '7502' },
  };
  const paymentFields = { ANNUITY: 'annuity', LINEAR: 'linear', BULLET: 'bullet' };
  const rateFields = { FIXED: 'fixed', FLOATING: 'floating' };

  function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function addMonths(value, count) {
    const date = new Date(`${value}T00:00:00Z`);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, next.getUTCDate()));
    return date.toISOString().slice(0, 10);
  }

  function validate(input = {}) {
    const settings = {};
    const errors = {};
    const constraints = {
      count: [1, 5000, true], amountMin: [0.01, 10000000000, false], amountMax: [0.01, 10000000000, false],
      termMin: [1, 360, true], termMax: [1, 360, true], rateMin: [0, 100, false], rateMax: [0, 100, false],
      benchmark: [0, 100, false], annuity: [0, 100, false], linear: [0, 100, false], bullet: [0, 100, false],
      fixed: [0, 100, false], floating: [0, 100, false],
    };
    for (const [key, [min, max, integer]] of Object.entries(constraints)) {
      const raw = String(input[key] ?? '').trim().replace(',', '.');
      const value = /^[+-]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(raw) ? Number(raw) : NaN;
      if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        const fmt = (n) => n.toLocaleString('ru-RU');
        errors[key] = `Введите ${integer ? 'целое число' : 'число с точностью до двух знаков'} от ${fmt(min)} до ${fmt(max)}.`;
      } else settings[key] = value;
    }
    for (const [min, max] of [['amountMin', 'amountMax'], ['termMin', 'termMax'], ['rateMin', 'rateMax']]) {
      if (settings[min] > settings[max]) errors[max] = 'Максимум должен быть не меньше минимума.';
    }
    for (const [key, fields] of [['paymentShares', ['annuity', 'linear', 'bullet']], ['rateShares', ['fixed', 'floating']]]) {
      if (fields.every((field) => Number.isFinite(settings[field])) && Math.abs(fields.reduce((n, field) => n + settings[field], 0) - 100) > 1e-8) {
        errors[key] = 'Сумма долей должна быть равна 100%.';
      }
    }
    const seed = String(input.seed ?? '').trim();
    if (!/^[\p{L}\p{N}_-]{1,64}$/u.test(seed)) errors.seed = 'Введите от 1 до 64 букв, цифр, дефисов или подчёркиваний.';
    else settings.seed = seed;
    if (!isDate(input.valuationDate) || input.valuationDate < '1901-01-01' || input.valuationDate > '2099-12-31') {
      errors.valuationDate = 'Укажите дату в пределах 1901–2099 годов.';
    } else settings.valuationDate = input.valuationDate;
    if (!Object.hasOwn(termProfiles, input.termProfile)) errors.termProfile = 'Выберите распределение сроков.';
    else settings.termProfile = input.termProfile;
    return { settings, errors, valid: Object.keys(errors).length === 0 };
  }

  function seededRandom(seed) {
    let state = 2166136261;
    for (const letter of seed) state = Math.imul(state ^ letter.codePointAt(0), 16777619);
    return () => {
      state = (state + 0x6D2B79F5) | 0;
      let next = Math.imul(state ^ (state >>> 15), state | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }

  function allocate(count, fields, settings, random) {
    const parts = Object.entries(fields).map(([key, field], index) => {
      const quota = count * Math.round(settings[field] * 100);
      return { key, count: Math.floor(quota / 10000), remainder: quota % 10000, index };
    });
    const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    const unassigned = count - parts.reduce((sum, part) => sum + part.count, 0);
    for (const part of byRemainder.slice(0, unassigned)) part.count += 1;
    const values = parts.flatMap(({ key, count }) => Array(count).fill(key));
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [values[j], values[i]] = [values[i], values[j]];
    }
    return values;
  }

  function generate(input) {
    const { settings: s, errors, valid } = validate(input);
    if (!valid) return { errors };
    const random = seededRandom(s.seed);
    const integer = (min, max, draw = random()) => min + Math.floor(draw * (max - min + 1));
    const payments = allocate(s.count, paymentFields, s, random);
    const rates = allocate(s.count, rateFields, s, random);
    const deals = payments.map((paymentType, index) => {
      const sample = random();
      const termDraw = s.termProfile === 'short' ? sample ** 2 : s.termProfile === 'long' ? 1 - (1 - sample) ** 2 : sample;
      const months = integer(s.termMin, s.termMax, termDraw);
      const principal = integer(Math.round(s.amountMin * 100), Math.round(s.amountMax * 100)) / 100;
      const rate = integer(Math.round(s.rateMin * 100), Math.round(s.rateMax * 100)) / 10000;
      const rateType = rates[index];
      return {
        id: `SYN-${String(index + 1).padStart(5, '0')}`,
        valuationDate: s.valuationDate, maturityDate: addMonths(s.valuationDate, months),
        principal, months, rate, paymentType, rateType,
        benchmark: rateType === 'FLOATING' ? s.benchmark / 100 : null,
        spread: rateType === 'FLOATING' ? Math.round((rate - s.benchmark / 100) * 10000) / 10000 : null,
      };
    });
    return { settings: s, deals };
  }

  function statistics({ deals, settings }) {
    const paymentCounts = Object.fromEntries(Object.keys(paymentFields).map((key) => [key, 0]));
    const rateCounts = Object.fromEntries(Object.keys(rateFields).map((key) => [key, 0]));
    let total = 0, term = 0, rateWeight = 0;
    for (const deal of deals) {
      total += deal.principal;
      term += deal.months;
      rateWeight += deal.rate * deal.principal;
      paymentCounts[deal.paymentType] += 1;
      rateCounts[deal.rateType] += 1;
    }
    const distribution = (counts, fields, titles) => Object.entries(counts).map(([key, count]) => ({
      key, title: titles[key], count, target: settings[fields[key]], actual: 100 * count / deals.length,
    }));
    const width = settings.termMax - settings.termMin + 1;
    const groupCount = Math.min(5, width);
    const terms = Array.from({ length: groupCount }, (_, key) => {
      const min = settings.termMin + Math.ceil(key * width / groupCount);
      const max = settings.termMin + Math.ceil((key + 1) * width / groupCount) - 1;
      const count = deals.filter(({ months }) => months >= min && months <= max).length;
      const title = min === max ? `${min} мес.` : `${min}–${max} мес.`;
      return { key, min, max, count, title, actual: 100 * count / deals.length };
    });
    return {
      total, meanAmount: total / deals.length, meanTerm: term / deals.length, meanRate: rateWeight / total,
      payments: distribution(paymentCounts, paymentFields, paymentTypes),
      rates: distribution(rateCounts, rateFields, rateTypes), terms,
    };
  }

  function selectDeals(deals, view, terms) {
    const query = view.query.trim().toLowerCase();
    const term = terms[view.termFilter];
    const matches = deals.filter((deal) =>
      (!query || deal.id.toLowerCase().includes(query)) &&
      (!view.paymentFilter || deal.paymentType === view.paymentFilter) &&
      (!view.rateFilter || deal.rateType === view.rateFilter) &&
      (!term || (deal.months >= term.min && deal.months <= term.max)));
    const { sortKey, sortDirection } = view;
    if (sortKey === 'id' && sortDirection > 0) return matches;
    return matches.sort((a, b) => sortDirection * (typeof a[sortKey] === 'number' ? a[sortKey] - b[sortKey] : a[sortKey].localeCompare(b[sortKey])));
  }

  function exportRows({ deals }) {
    return [
      ['instrument_id', 'valuation_date', 'maturity_date', 'principal_amount', 'currency', 'term_months', 'payment_type', 'rate_type', 'annual_rate', 'demo_benchmark_rate', 'spread'],
      ...deals.map((d) => [
        d.id, d.valuationDate, d.maturityDate, d.principal.toFixed(2), 'RUB', d.months,
        d.paymentType, d.rateType, d.rate.toFixed(4), d.benchmark?.toFixed(4) ?? '', d.spread?.toFixed(4) ?? '',
      ]),
    ];
  }

  return { defaults, presets, paymentTypes, rateTypes, termProfiles, isDate, addMonths, validate, generate, statistics, selectDeals, exportRows };
})();
