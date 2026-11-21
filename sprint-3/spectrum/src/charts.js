const Charts = (() => {
  function stepFor(range) {
    const scaled = Math.max(range / 4, 1e-8);
    const base = 10 ** Math.floor(Math.log10(scaled));
    return ([1, 2, 2.5, 5, 10].find((step) => step * base >= scaled) ?? 10) * base;
  }

  function unitFor(value) {
    if (value >= 1e9) return { amount: 1e9, label: 'млрд' };
    if (value >= 1e6) return { amount: 1e6, label: 'млн' };
    if (value >= 1e3) return { amount: 1e3, label: 'тыс.' };
    return { amount: 1, label: '' };
  }

  function factorContributions({ factors, residual }) {
    const rows = [...factors];
    if (residual) rows.push({ title: 'Необъяснённый остаток', description: 'Разница между итогом и суммой вкладов', contribution: residual });
    const largest = Math.max(...rows.map(({ contribution }) => Math.abs(contribution)));

    function row(factor) {
      const amount = UI.signedRub(factor.contribution);
      const tone = UI.tone(factor.contribution);
      const bar = tone === 'neutral' ? '' : `<span class="impact-bar ${tone}" style="--impact-width:${50 * Math.abs(factor.contribution) / largest}%"></span>`;
      const content = `<span class="impact-name"><strong>${UI.esc(factor.title)}</strong><small>${UI.esc(factor.description)}</small></span>
        <span class="impact-track" aria-hidden="true">${bar}</span>
        <span class="impact-amount ${tone}">${amount}</span>`;
      if (!factor.key) return `<div class="impact-row">${content}</div>`;
      return `<button type="button" class="impact-row impact-button" data-action="choose-factor" data-factor="${factor.key}" aria-haspopup="dialog" aria-label="${UI.esc(`${factor.title}, вклад ${amount}`)}">
        ${content}<span class="impact-arrow">${UI.icon('next', 16)}</span>
      </button>`;
    }

    return `<div class="impact-axis" aria-hidden="true">
      <span>Фактор</span>
      <div class="impact-directions"><span>Снижает</span><span>0</span><span>Повышает</span></div>
      <span>Вклад в NPV</span>
    </div><div class="impact-list" role="group" aria-label="Влияние факторов на NPV">${rows.map(row).join('')}</div>`;
  }

  function yearly(years, selectedYear) {
    const width = 1100, height = 245, left = 82, right = width - 12, top = 13, bottom = 213;
    if (!years.length) return UI.empty('Платежей нет', 'В выгрузке для этой сделки нет строк денежных потоков.');
    const positive = (d) => Math.max(0, d.principal) + Math.max(0, d.interest);
    const negative = (d) => Math.min(0, d.principal) + Math.min(0, d.interest);
    const min = Math.min(0, ...years.map(negative));
    const max = Math.max(0, ...years.map(positive));
    const increment = stepFor(Math.max(1, max - min));
    const low = Math.floor(min / increment) * increment;
    const high = Math.max(increment, Math.ceil(max / increment) * increment);
    const unit = unitFor(Math.max(high, Math.abs(low)));
    const labelInterval = Math.ceil(years.length / 12);
    const y = (value) => bottom - (value - low) / (high - low) * (bottom - top);
    const ticks = Math.round((high - low) / increment);
    const labels = Array.from({ length: ticks + 1 }, (_, i) => {
      const value = low + i * increment;
      return `<line class="chart-grid" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis" x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${UI.decimal(value / unit.amount)}${unit.label ? ` ${unit.label}` : ''}</text>`;
    }).join('');
    const band = (right - left) / years.length;
    const bar = Math.min(86, band * 0.76);
    const bars = years.map((year, i) => {
      const x = left + (i + 0.5) * band;
      const principalEnd = year.principal;
      const interestStart = Math.sign(year.interest) === Math.sign(year.principal) ? principalEnd : 0;
      const rect = (start, end, color) => `<rect class="stack-${color}" x="${x - bar / 2}" y="${y(Math.max(start, end))}" width="${bar}" height="${Math.abs(y(start) - y(end))}" rx="1"/>`;
      return `<g role="button" tabindex="0" class="year-bar ${selectedYear === year.year ? 'selected' : ''}" data-action="choose-year" data-year="${year.year}" data-focus-key="year-${year.year}" aria-pressed="${selectedYear === year.year}" aria-label="${year.year}, тело ${UI.money(year.principal, true)}, проценты ${UI.money(year.interest, true)}">
        <rect class="chart-hit" x="${x - band / 2 + 1}" y="${top}" width="${band - 2}" height="${bottom - top + 3}" rx="4"/>
        <title>${year.year} · Тело ${UI.money(year.principal, true)} · Проценты ${UI.money(year.interest, true)}</title>
        ${rect(0, principalEnd, 'principal')}${rect(interestStart, interestStart + year.interest, 'interest')}
        ${i % labelInterval === 0 || i === years.length - 1 || selectedYear === year.year ? `<text class="chart-axis year-label" x="${x}" y="${bottom + 20}" text-anchor="middle">${year.year}</text>` : ''}
      </g>`;
    }).join('');
    return `<div class="chart-scroll" tabindex="0" aria-label="Прокручиваемый график платежей"><svg class="yearly" viewBox="0 0 ${width} ${height}" role="group" aria-label="Платежи по годам. Выберите год для фильтрации таблицы.">${labels}${bars}</svg></div><p class="scroll-hint">Прокрутите вправо, чтобы увидеть весь график.</p>`;
  }

  return { factorContributions, yearly };
})();
