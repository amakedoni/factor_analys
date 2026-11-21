const RiskAnalysis = (() => {
  const factors = [
    { key: 'principal', title: 'Остаток долга', description: 'Сколько основного долга осталось вернуть' },
    { key: 'rate', title: 'Кредитная ставка', description: 'Какие проценты платит заёмщик' },
    { key: 'months', title: 'Оставшийся срок', description: 'Сколько месяцев осталось до погашения' },
    { key: 'paymentType', title: 'Тип платежей', description: 'Когда возвращается основной долг' },
    { key: 'discountRate', title: 'Ставка дисконтирования', description: 'Как оцениваются будущие платежи на текущую дату' },
  ];
  const segments = {
    all: { title: 'Все сделки', filter: () => true },
    fixed: { title: 'Фиксированная ставка', filter: (deal) => deal.rateType === 'FIXED' },
    floating: { title: 'Плавающая ставка', filter: (deal) => deal.rateType === 'FLOATING' },
    annuity: { title: 'Аннуитетные сделки', filter: (deal) => deal.paymentType === 'ANNUITY' },
    long: { title: 'Срок от 60 месяцев', filter: (deal) => deal.months >= 60 },
  };
  // These snapshots are examples, specified relative to the portfolio's valuation date.
  const phases = [
    { offset: -1, balance: 0.954, fixedRateChange: -0.006, floatingRateChange: -0.009, term: 2, discountRate: 0.154, conversions: 0 },
    { offset: 0, balance: 1, fixedRateChange: 0, floatingRateChange: 0, term: 0, discountRate: 0.151, conversions: 0 },
    { offset: 1, balance: 1.078, fixedRateChange: 0, floatingRateChange: 0.024, term: -7, discountRate: 0.167, conversions: 3 },
    { offset: 2, balance: 1.112, fixedRateChange: 0, floatingRateChange: 0.010, term: 4, discountRate: 0.149, conversions: 5 },
  ];
  const combinations = 2 ** factors.length;
  const factorial = [1, 1, 2, 6, 24, 120];

  const periods = (date) => phases.map((phase, index) => ({ index, date: Portfolio.addMonths(date, phase.offset) }));

  function snapshot(deal, position, phase) {
    const rateShift = deal.rateType === 'FLOATING' ? phase.floatingRateChange : phase.fixedRateChange;
    return {
      principal: Math.round(deal.principal * phase.balance * 100) / 100,
      rate: Math.max(0, deal.rate + rateShift),
      months: Math.max(1, Math.min(360, deal.months + phase.term)),
      paymentType: position % 13 < phase.conversions ? 'BULLET' : deal.paymentType,
      discountRate: phase.discountRate,
    };
  }

  function presentValue({ principal, rate, months, paymentType, discountRate }) {
    const interest = rate / 12;
    const discount = Math.expm1(Math.log1p(discountRate) / 12);
    const df = 1 / (1 + discount);
    const years = -months * Math.log1p(discount);
    const discountSum = discount === 0 ? months : -Math.expm1(years) / discount;
    if (paymentType === 'ANNUITY') {
      const payment = interest === 0 ? principal / months : principal * interest / -Math.expm1(-months * Math.log1p(interest));
      return payment * discountSum;
    }
    if (paymentType === 'BULLET') return principal * (interest * discountSum + Math.exp(years));
    let pv = 0;
    let factor = df;
    const principalPayment = principal / months;
    for (let month = 0; month < months; month += 1) {
      pv += (principalPayment + (principal - month * principalPayment) * interest) * factor;
      factor *= df;
    }
    return pv;
  }

  function mixedSnapshot(before, after, mask) {
    return Object.fromEntries(factors.map(({ key }, bit) => [key, (mask & (1 << bit) ? after : before)[key]]));
  }

  function shapleyWeights() {
    return Array.from({ length: combinations }, (_, mask) => {
      const size = mask.toString(2).split('1').length - 1;
      return size === factors.length ? 0 : factorial[size] * factorial[factors.length - size - 1] / factorial[factors.length];
    });
  }

  const weights = shapleyWeights();

  function compare(portfolio, from, to, segmentName = 'all') {
    if (!phases[from] || !phases[to] || from >= to) return { error: 'Конец периода должен быть позже начала.' };
    const segment = segments[segmentName] ?? segments.all;
    const deals = portfolio.deals.filter(segment.filter);
    if (!deals.length) return { error: 'По выбранному сегменту нет сделок. Выберите другой сегмент или создайте новый портфель.' };
    const volumes = new Float64Array(combinations);
    const means = () => ({ principal: 0, rate: 0, months: 0, paymentType: 0, discountRate: 0 });
    const before = means(), after = means();
    let changedSchedules = 0;
    for (const [position, deal] of deals.entries()) {
      // Use the deal number so filtering does not change which contracts are repriced or restructured.
      const ordinal = Number(deal.id.split('-').at(-1));
      const stageIndex = Number.isInteger(ordinal) ? ordinal - 1 : position;
      const first = snapshot(deal, stageIndex, phases[from]);
      const last = snapshot(deal, stageIndex, phases[to]);
      if (first.paymentType !== last.paymentType) changedSchedules += 1;
      for (const [totals, state] of [[before, first], [after, last]]) {
        totals.principal += state.principal;
        totals.rate += state.rate * state.principal;
        totals.months += state.months;
        totals.paymentType += state.paymentType === 'BULLET' ? 1 : 0;
        totals.discountRate += state.discountRate;
      }
      for (let mask = 0; mask < combinations; mask += 1) {
        volumes[mask] += presentValue(mixedSnapshot(first, last, mask));
      }
    }
    for (const totals of [before, after]) {
      totals.rate = totals.rate / totals.principal;
      totals.months = totals.months / deals.length;
      totals.discountRate = totals.discountRate / deals.length;
    }
    const start = volumes[0];
    const end = volumes[combinations - 1];
    const difference = end - start;
    const ranked = factors.map((factor, index) => {
      const bit = 1 << index;
      let contribution = 0;
      for (let mask = 0; mask < combinations; mask += 1) {
        if ((mask & bit) === 0) contribution += weights[mask] * (volumes[mask | bit] - volumes[mask]);
      }
      const interactions = factors.flatMap((other, partner) => {
        if (partner === index) return [];
        const otherBit = 1 << partner;
        return [{ title: other.title, effect: volumes[bit | otherBit] - volumes[bit] - volumes[otherBit] + start }];
      }).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
      return { ...factor, contribution, before: before[factor.key], after: after[factor.key], interactions };
    });
    const sum = ranked.reduce((total, factor) => total + factor.contribution, 0);
    const residual = Math.abs(difference - sum) < 0.005 ? 0 : difference - sum;
    return { start, end, difference, residual, factors: ranked, count: deals.length, changedSchedules, segment: segment.title };
  }

  return { factors, segments, periods, compare, presentValue };
})();
