const Views = (() => {
  const labels = { generator: 'Генератор', portfolio: 'Состав портфеля', analysis: 'Факторный анализ', cashflows: 'Денежные потоки', valuation: 'Сценарная оценка' };
  const formatOptions = (object, selected) => Object.entries(object).map(([key, value]) => UI.option(key, value, selected)).join('');
  const tableWrap = (label, table) => `<div class="table-scroll" tabindex="0" aria-label="${UI.esc(label)}">${table}</div>`;

  function sidebar(route) {
    return `<a class="brand" href="#generator" aria-label="Спектр — генератор сделок"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>Спектр</strong></a>
      <nav class="navigation" aria-label="Разделы">${Object.entries(labels).map(([id, label]) => `<a href="#${id}" ${route === id ? 'aria-current="page"' : ''}>${UI.icon(id, 20)}<span>${label}</span></a>`).join('')}</nav>
      <div class="sidebar-foot">${UI.icon('team', 19)}<span>Теневое правительство</span></div>`;
  }

  function viewBar(tabs, active, action, label, trailing = '') {
    return `<div class="view-bar"><div class="view-switch" role="group" aria-label="${UI.esc(label)}">${Object.entries(tabs).map(([key, name]) =>
      `<button type="button" data-action="${action}" data-view="${key}" data-focus-key="${action}-${key}" aria-pressed="${key === active}">${UI.esc(name)}</button>`).join('')}</div>${trailing}</div>`;
  }

  function field(values, errors, key, title, { prefix, type = 'text', extra = '', help } = {}) {
    const message = errors[key];
    return `<div class="field ${prefix ? 'range-field' : ''} ${message ? 'has-error' : ''}"><span${help ? ' class="help-label"' : ''}><label for="gen-${key}">${UI.esc(prefix ?? title)}</label>${help ? Help.button(help) : ''}</span>
      <input type="${type}" ${type === 'text' && key !== 'seed' ? 'inputmode="decimal"' : ''} autocomplete="off" id="gen-${key}" name="${key}" value="${UI.esc(values[key])}" ${prefix ? `aria-label="${UI.esc(title)}"` : ''} ${extra} ${message ? `aria-invalid="true" aria-describedby="err-${key}"` : ''}>
      ${message ? `<small id="err-${key}">${UI.esc(message)}</small>` : ''}</div>`;
  }

  function generator(view) {
    const { form, errors } = view;
    const input = (key, title, options) => field(form, errors, key, title, options);
    const range = (title, min, max, lower, upper, help) => `<div class="form-row">${help ? Help.label(title, help) : `<span>${title}</span>`}<div class="range-pair">${input(min, lower, { prefix: 'От' })}${input(max, upper, { prefix: 'До' })}</div></div>`;
    const shareError = (key) => errors[key] ? `<p class="form-error" role="alert">${UI.esc(errors[key])}</p>` : '';
    const header = UI.heading('Генератор сделок', 'Создайте набор тестовых кредитов, посмотрите его состав и сравните стоимость портфеля на две даты.');
    const distributionOpen = view.distributionOpen || errors.paymentShares || errors.rateShares ||
      ['annuity', 'linear', 'bullet', 'fixed', 'floating'].some((key) => errors[key]);
    const advancedOpen = view.advancedOpen || errors.seed || errors.valuationDate || errors.benchmark || errors.termProfile;
    return header + `<section class="panel generator-form"><form id="generator-form" novalidate>
      <div class="generator-start">
        <p>Параметры уже заполнены. После запуска откроется список сделок.</p>
        <button class="button primary" type="submit">Сгенерировать портфель${UI.icon('right', 19)}</button>
      </div>
      <div class="generator-top"><h2>Параметры портфеля</h2>
        <select id="preset-select" aria-label="Готовые профили">
          <option value="">Готовые профили</option><option value="standard">Сбалансированный</option><option value="short">Короткие кредиты</option><option value="floating">Плавающие ставки</option>
        </select></div>
      <p class="field-help">Сумма, срок и годовая ставка каждой сделки попадут в указанные диапазоны. Кнопка «?» открывает пояснение.</p>
      ${view.message ? `<div class="form-message ${view.message.type}" role="status">${UI.esc(view.message.text)}</div>` : ''}
      <div class="form-row count-row">${input('count', 'Количество сделок')}</div>
      ${range('Сумма сделки, ₽', 'amountMin', 'amountMax', 'Минимальная сумма сделки, ₽', 'Максимальная сумма сделки, ₽')}
      ${range('Срок сделки, мес.', 'termMin', 'termMax', 'Минимальный срок, мес.', 'Максимальный срок, мес.')}
      ${range('Годовая ставка, %', 'rateMin', 'rateMax', 'Минимальная годовая ставка, %', 'Максимальная годовая ставка, %', 'creditRate')}
      <details class="form-disclosure" data-generator-open="distributionOpen" ${distributionOpen ? 'open' : ''}>
        <summary>Распределение сделок${UI.icon('down', 18)}</summary>
        <p class="field-help">Доли задаются по числу сделок. В каждой группе они должны в сумме давать 100%.</p>
        <div class="shares-grid">
          <fieldset class="shares-group"><legend>${Help.label('Тип платежей, %', 'paymentTypes')}</legend>
            ${input('annuity', 'Аннуитетные')}${input('linear', 'Дифференцированные')}${input('bullet', 'В конце срока')}${shareError('paymentShares')}
          </fieldset>
          <fieldset class="shares-group"><legend>${Help.label('Тип ставки, %', 'rateTypes')}</legend>
            ${input('fixed', 'Фиксированная')}${input('floating', 'Плавающая')}${shareError('rateShares')}
          </fieldset>
        </div>
      </details>
      <details class="form-disclosure" data-generator-open="advancedOpen" ${advancedOpen ? 'open' : ''}>
        <summary>Дополнительные настройки${UI.icon('down', 18)}</summary>
        <div class="advanced-fields">
          ${input('seed', 'Код генерации', { extra: 'maxlength="64"', help: 'seed' })}
          ${input('valuationDate', 'Дата оценки', { type: 'date', help: 'valuationDate' })}
          <div class="field"><span class="help-label"><label for="gen-termProfile">Распределение сроков</label>${Help.button('termProfile')}</span><select name="termProfile" id="gen-termProfile">${formatOptions(Portfolio.termProfiles, form.termProfile)}</select></div>
          ${input('benchmark', 'Индекс плавающей ставки, %', { help: 'floatingIndex' })}
        </div>
        <div class="settings-actions"><button type="button" class="link-button" data-action="settings-picker">Загрузить настройки из JSON</button><input type="file" id="settings-file" accept=".json,application/json" hidden></div>
      </details>
    </form></section>`;
  }

  function dealTable(view, result, stats, pageSize) {
    const deals = Portfolio.selectDeals(result.deals, view, stats.terms);
    const filtered = view.query.trim() || view.paymentFilter || view.rateFilter || view.termFilter !== '';
    const count = `${UI.int(deals.length)} из ${UI.int(result.deals.length)} сделок`;
    const tools = filtered ? `<div class="deal-results">
      <span role="status">${count}</span>
      <div class="deal-result-actions"><button type="button" class="link-button" data-action="clear-deal-filters">Сбросить фильтры</button>
        ${deals.length ? UI.button('Скачать выборку', 'download', 'selection-export') : ''}</div>
    </div>` : '';
    if (!deals.length) return tools + UI.empty('Сделок по фильтрам нет', 'Измените запрос или сбросьте фильтры.');
    const { sortKey, sortDirection } = view;
    const page = Math.max(0, Math.min(view.page, Math.ceil(deals.length / pageSize) - 1));
    const columns = [['id', 'ID'], ['principal', 'Сумма'], ['months', 'Срок'], ['paymentType', 'Тип платежей'], ['rateType', 'Тип ставки'], ['rate', 'Ставка']];
    const headers = columns.map(([key, label]) => {
      const sort = key === sortKey ? `aria-sort="${sortDirection > 0 ? 'ascending' : 'descending'}"` : '';
      return `<th scope="col" ${sort}><button type="button" data-action="sort-deals" data-sort="${key}" data-focus-key="sort-${key}" class="sort-button">${UI.esc(label)}${UI.icon(sort ? 'down' : 'sort', 14)}</button></th>`;
    }).join('');
    const rows = deals.slice(page * pageSize, (page + 1) * pageSize).map((deal) => {
      const rateHelp = deal.spread === null ? 'Фиксированная ставка' : `Индекс ${UI.pct(deal.benchmark * 100)} · надбавка ${UI.signed(deal.spread * 100, UI.decimal)} п. п.`;
      return `<tr><td class="id-cell"><button type="button" class="link-button" data-action="open-deal" data-deal="${UI.esc(deal.id)}" aria-haspopup="dialog">${UI.esc(deal.id)}</button></td><td>${UI.rub(deal.principal, true)}</td><td>${deal.months} мес.</td><td>${Portfolio.paymentTypes[deal.paymentType]}</td><td>${Portfolio.rateTypes[deal.rateType]}</td><td title="${UI.esc(rateHelp)}">${UI.pct(deal.rate * 100)}</td></tr>`;
    }).join('');
    return tools + tableWrap('Таблица сделок', `<table class="deal-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`) +
      `<div class="table-footer">${filtered ? '' : `<span>${count}</span>`}${UI.pager(page, deals.length, pageSize, 'deal-page')}</div>`;
  }

  function distribution(title, rows, field) {
    const showTarget = field !== 'termFilter';
    const items = rows.map((row) => `<button type="button" class="distribution-row distribution-choice" data-action="distribution-filter" data-field="${field}" data-value="${row.key}"><span>${UI.esc(row.title)}</span><span>${showTarget ? UI.pct(row.target) : ''}</span><strong>${UI.pct(row.actual)}</strong><span>${UI.int(row.count)}</span>
      <span class="distribution-bars" aria-hidden="true">${showTarget ? `<i style="--length:${row.target}%"></i>` : ''}<i class="actual-bar" style="--length:${row.actual}%"></i></span></button>`).join('');
    return `<section class="distribution" aria-label="${UI.esc(title)}"><h2>${UI.esc(title)}</h2>
      <div class="distribution-row distribution-head"><span>${showTarget ? 'Тип' : 'Интервал'}</span><span>${showTarget ? 'Цель' : ''}</span><span>Факт</span><span>Сделок</span></div>${items}</section>`;
  }

  function portfolio(view, result, stats, pageSize, subtitle) {
    const actions = `<div class="page-actions"><a class="button secondary" href="#generator">Изменить настройки</a><button type="button" class="button primary" data-action="analyze-portfolio">Открыть в анализе${UI.icon('right', 19)}</button></div>`;
    const header = UI.heading('Состав портфеля', subtitle, actions);
    const metrics = UI.metrics([
      { label: 'Количество сделок', value: UI.int(result.deals.length) },
      { label: 'Сумма основного долга', value: UI.shortRub(stats.total), title: UI.rub(stats.total, true) },
      { label: 'Средний срок', value: `${UI.decimal(stats.meanTerm)}&nbsp;мес.` },
      { label: 'Средняя ставка', context: 'С учётом сумм сделок', value: UI.pct(stats.meanRate * 100), help: 'weightedRate' },
    ]);
    const exports = `<div class="table-exports">${UI.button('Скачать все сделки', 'download', 'portfolio-export', 'secondary', 'title="Весь портфель в CSV"')}
      ${UI.button('CSV для калькулятора', 'download', 'calculator-export', 'secondary', 'title="Входной файл для калькулятора команды 1"')}</div>`;
    const bar = viewBar({ deals: 'Сделки', distribution: 'Распределение' }, view.mode, 'portfolio-view', 'Состав портфеля', exports);
    const content = view.mode === 'distribution'
      ? `<p class="view-hint">«Цель» — доля из настроек. ${Help.label('«Факт» — доля в готовом портфеле.', 'distribution')} Нажмите на строку, чтобы увидеть сделки этой группы.</p>
        <div class="distribution-grid">${distribution('Тип платежей', stats.payments, 'paymentFilter')}${distribution('Тип ставки', stats.rates, 'rateFilter')}${distribution('Сроки сделок', stats.terms, 'termFilter')}</div>
        <div class="portfolio-meta"><span>Средняя сумма сделки <strong>${UI.rub(stats.meanAmount, true)}</strong></span><span>Код генерации <strong>${UI.esc(result.settings.seed)}</strong></span><button type="button" class="link-button" data-action="settings-export">Скачать настройки</button></div>`
      : `<p class="view-hint">Нажмите на номер сделки, чтобы открыть её карточку.</p>
        <div class="table-controls"><label class="search-field">${UI.icon('search', 18)}<input id="deal-search" type="search" placeholder="Поиск по номеру сделки" aria-label="Поиск по номеру сделки" value="${UI.esc(view.query)}"></label>
        <select id="payment-filter" data-portfolio-filter="paymentFilter" aria-label="Фильтр по типу платежей">${UI.option('', 'Все типы платежей', view.paymentFilter)}${formatOptions(Portfolio.paymentTypes, view.paymentFilter)}</select>
        <select id="rate-filter" data-portfolio-filter="rateFilter" aria-label="Фильтр по типу ставки">${UI.option('', 'Все типы ставок', view.rateFilter)}${formatOptions(Portfolio.rateTypes, view.rateFilter)}</select>
        <select id="term-filter" data-portfolio-filter="termFilter" aria-label="Фильтр по сроку">${UI.option('', 'Все сроки', view.termFilter)}${stats.terms.map(({ key, title }) => UI.option(key, title, view.termFilter)).join('')}</select></div>
        <p class="view-hint table-hint">Прокрутите таблицу вправо, чтобы увидеть все столбцы. Номер сделки закреплён слева.</p>
        <div id="deal-table">${dealTable(view, result, stats, pageSize)}</div>`;
    return header + metrics + `<section class="panel work-panel">${bar}${content}</section>`;
  }

  function dealDialog(deal) {
    const fields = [
      ['Сумма сделки', UI.rub(deal.principal, true)],
      ['Срок', `${deal.months} мес.`],
      ['Дата оценки', UI.date(deal.valuationDate)],
      ['Дата погашения', UI.date(deal.maturityDate)],
      ['Тип платежей', Portfolio.paymentTypes[deal.paymentType], 'paymentTypes'],
      ['Тип ставки', Portfolio.rateTypes[deal.rateType]],
      ['Годовая ставка на дату оценки', `${UI.money(deal.rate * 100, true)}%`],
    ];
    if (deal.rateType === 'FLOATING') {
      fields.push(['Модельный индекс', `${UI.money(deal.benchmark * 100, true)}%`],
        ['Надбавка к индексу', `${UI.signed(deal.spread * 100, (n) => UI.money(n, true))} п. п.`, 'floatingIndex']);
    }
    return `<div class="dialog-head"><h2 id="deal-title">Сделка ${UI.esc(deal.id)}</h2><button type="button" class="icon-button" data-action="close-deal" aria-label="Закрыть" autofocus>${UI.icon('close')}</button></div>
      <dl class="facts">${fields.map(([label, value, help]) => `<div><dt>${help ? Help.label(label, help) : UI.esc(label)}</dt><dd>${UI.esc(value)}</dd></div>`).join('')}</dl>
      <div class="modal-actions">${UI.button('CSV сделки для калькулятора', 'download', 'calculator-export', 'secondary', `data-deal="${UI.esc(deal.id)}"`)}</div>`;
  }

  const factorNotes = {
    principal: {
      measure: 'Суммарный остаток основного долга',
      format: (value) => UI.rub(value, true),
      formatChange: UI.signedRub,
      reason: 'При большем остатке предстоит вернуть больше основного долга. Проценты также начисляются на большую сумму. Вклад показывает, как эти будущие поступления изменили приведённую стоимость портфеля.',
    },
    rate: {
      measure: 'Средняя годовая ставка по кредитам, взвешенная по остатку долга',
      format: (value) => `${UI.money(value * 100, true)}%`,
      formatChange: rateChange,
      reason: 'Ставка по кредиту определяет проценты, которые платит заёмщик. Более высокая ставка увеличивает будущие процентные платежи. Для расчёта вклада модель берёт ставку каждой сделки.',
    },
    months: {
      measure: 'Среднее число месяцев до погашения',
      format: (value) => `${UI.decimal(value)} мес.`,
      formatChange: (value) => UI.signed(Math.abs(value) < 0.05 ? 0 : value, (n) => `${UI.decimal(n)} мес.`),
      reason: 'При изменении срока сдвигаются даты платежей и меняется сумма процентов. Более поздний возврат долга уменьшает его приведённую стоимость. Дополнительные проценты могут компенсировать этот эффект.',
    },
    paymentType: {
      measure: 'Количество сделок с возвратом основного долга в конце срока',
      format: UI.int,
      formatChange: UI.signed,
      reason: 'Аннуитет даёт одинаковые ежемесячные платежи. При дифференцированном графике основной долг гасится равными частями. При погашении в конце срока весь основной долг возвращается в последнем платеже. Вклад учитывает, как изменились даты и суммы будущих платежей.',
    },
    discountRate: {
      measure: 'Годовая ставка дисконтирования',
      format: (value) => `${UI.money(value * 100, true)}%`,
      formatChange: rateChange,
      reason: 'Ставка дисконтирования переводит будущие платежи в стоимость на дату оценки. Чем она выше, тем меньше стоит одна и та же будущая сумма. На дальних платежах этот эффект заметнее.',
    },
  };

  function rateChange(value) {
    const points = value * 100;
    return UI.signed(Math.abs(points) < 0.005 ? 0 : points, (n) => `${UI.money(n, true)} п. п.`);
  }

  function factorDialog(factor, result, fromDate, toDate) {
    const notes = factorNotes[factor.key];
    const isRate = factor.key === 'rate' || factor.key === 'discountRate';
    const figures = [
      [UI.date(fromDate), notes.format(factor.before)],
      [UI.date(toDate), notes.format(factor.after)],
      ['Изменение', notes.formatChange(factor.after - factor.before), isRate ? 'percentagePoints' : null],
    ];
    const tone = UI.tone(factor.contribution);
    const direction = { positive: 'Повысил NPV', negative: 'Снизил NPV', neutral: 'Вклад нулевой с точностью до копейки' }[tone];
    const interactions = factor.interactions.filter(({ effect }) => Math.abs(effect) >= 0.005).slice(0, 2);
    return `<div class="dialog-head"><h2 id="factor-title">${UI.esc(factor.title)}</h2><button type="button" class="icon-button" data-action="close-factor" aria-label="Закрыть" autofocus>${UI.icon('close')}</button></div>
      <p class="factor-scope">${UI.dealCount(result.count)} · ${UI.esc(result.segment)}</p>
      <section class="factor-section"><h3>Что изменилось</h3>
        <p>${UI.esc(notes.measure)}</p>
        <dl class="factor-comparison">${figures.map(([label, value, help]) => `<div><dt>${help ? Help.label(label, help) : UI.esc(label)}</dt><dd>${UI.esc(value)}</dd></div>`).join('')}</dl>
        ${factor.key === 'paymentType' ? `<p class="factor-extra">Сделки со сменой графика <strong>${UI.int(result.changedSchedules)} из ${UI.int(result.count)}</strong></p>` : ''}
      </section>
      <section class="factor-section"><h3>Как это повлияло на NPV</h3>
        <div class="factor-number"><strong class="${tone}">${UI.signedRub(factor.contribution)}</strong><span>${direction}</span></div>
        <p>${UI.esc(notes.reason)}</p>
      </section>
      ${interactions.length ? `<details class="interaction"><summary>Взаимодействия факторов${UI.icon('down', 17)}</summary>
        <p>Парный эффект показывает, насколько совместное влияние двух факторов отличается от суммы их отдельных эффектов. Остальные параметры берутся на начало периода.</p>
        <dl class="facts">${interactions.map((pair) => `<div><dt>${UI.esc(pair.title)}</dt><dd class="${UI.tone(pair.effect)}">${UI.signedRub(pair.effect)}</dd></div>`).join('')}</dl>
        <p class="factor-interaction-note">Основной вклад по методу Шепли уже учитывает эти взаимодействия.</p></details>` : ''}`;
  }

  function factorTable(data) {
    const hasChange = Math.abs(data.difference) >= 0.005;
    const cells = (amount) => `<td class="t-right amount ${UI.tone(amount)}">${UI.signedRub(amount)}</td>
      <td class="t-right">${hasChange ? UI.signed(100 * amount / data.difference, UI.pct) : '—'}</td>`;
    const rows = data.factors.map((factor) => `<tr><td><button class="table-action" type="button" data-action="choose-factor" data-factor="${factor.key}" aria-haspopup="dialog">${UI.esc(factor.title)}${UI.icon('next', 15)}</button></td>${cells(factor.contribution)}</tr>`).join('');
    const residual = data.residual ? `<tr><td>Необъяснённый остаток</td>${cells(data.residual)}</tr>` : '';
    return tableWrap('Таблица вкладов', `<table class="factor-table"><thead><tr><th scope="col">Фактор</th><th scope="col" class="t-right">Вклад в NPV</th><th scope="col" class="t-right">${Help.label('Доля', 'contributionShare')}</th></tr></thead><tbody>${rows}${residual}</tbody>
      <tfoot><tr><th scope="row">Изменение NPV</th><td class="t-right ${UI.tone(data.difference)}">${UI.signedRub(data.difference)}</td><td class="t-right">${hasChange ? '100,0%' : '—'}</td></tr></tfoot></table>`);
  }

  function analysis(view, data, dates, hasOwnPortfolio) {
    const opts = (selection) => dates.map((period) => UI.option(period.index, UI.date(period.date), selection)).join('');
    const sources = { demo: 'Готовый пример', ...(hasOwnPortfolio ? { generated: 'Мой портфель' } : {}) };
    const filters = `<div class="analysis-filters">
      <label>Портфель<select id="analysis-source" data-analysis="source" ${hasOwnPortfolio ? '' : 'disabled'}>${formatOptions(sources, view.source)}</select></label>
      <label>Начальная дата<select id="period-from" data-analysis="from">${opts(view.from)}</select></label>
      <label>Конечная дата<select id="period-to" data-analysis="to">${opts(view.to)}</select></label>
      <label>Сделки в расчёте<select id="analysis-segment" data-analysis="segment">${Object.entries(RiskAnalysis.segments).map(([key, config]) => UI.option(key, config.title, view.segment)).join('')}</select></label>
    </div>`;
    const header = UI.heading('Факторный анализ', 'NPV показывает стоимость будущих платежей на дату оценки.', UI.button('Скачать отчёт', 'download', 'report', 'secondary', data.error ? 'disabled' : ''));
    if (data.error) return header + filters + `<section class="panel">${UI.empty('Нет данных для сравнения', data.error)}</section>`;
    const metrics = UI.metrics([
      { label: 'NPV на начало', context: UI.date(dates[view.from].date), value: UI.rub(data.start, true), help: 'npv' },
      { label: 'NPV на конец', context: UI.date(dates[view.to].date), value: UI.rub(data.end, true) },
      { label: 'Изменение NPV', context: 'Конец минус начало', value: UI.signedRub(data.difference), tone: UI.tone(data.difference),
        title: `Изменение относительно начала ${UI.signed(100 * data.difference / data.start, UI.pct)}` },
    ]);
    const bar = viewBar({ chart: 'График', factors: 'Вклады факторов' }, view.mode, 'analysis-view', 'Вид факторного анализа');
    const largest = data.factors.reduce((best, factor) => Math.abs(factor.contribution) > Math.abs(best.contribution) ? factor : best);
    const direction = UI.tone(largest.contribution);
    const driver = direction === 'neutral'
      ? 'Вклады всех факторов округляются до нуля.'
      : `Самый заметный вклад дал фактор «${UI.esc(largest.title)}». Он ${direction === 'positive' ? 'повысил' : 'снизил'} NPV.`;
    const content = view.mode === 'chart'
      ? `<p class="analysis-reading">${driver}</p><p class="view-hint">Слева от нуля — вклады в снижение NPV, справа — в рост. Нажмите на фактор, чтобы узнать, что изменилось.</p>${Charts.factorContributions(data)}`
      : factorTable(data);
    return header + filters + `<p class="analysis-scope">${Help.label('Модельный расчёт', 'model')} · ${UI.dealCount(data.count)}. Сравниваются два состояния одного набора тестовых сделок.</p>` + metrics + `<section class="panel work-panel analysis-panel">${bar}${content}</section>
      <details class="method panel" ${view.methodOpen ? 'open' : ''}><summary>Как рассчитаны вклады${UI.icon('down', 18)}</summary>
        <p>Для каждого фактора модель берёт значения на начало и конец периода. Она пересчитывает NPV для 32 сочетаний этих значений и усредняет эффект каждого фактора по всем порядкам изменения. Это метод Шепли.</p>
        <p>Необъяснённый остаток — итоговое изменение NPV минус сумма вкладов до округления. В этом сравнении он составляет <strong>${UI.signedRub(data.residual)}</strong>.</p>
      </details>`;
  }

  function cashflow(view, batch, deal, years, rows, pageSize) {
    const actions = `<div class="page-actions">${UI.button('Оценить по кривым', 'right', 'open-valuation')}
      ${UI.button('Загрузить CSV', 'upload', 'open-import', 'primary')}</div>`;
    const header = UI.heading('Денежные потоки', `${batch.source}.`, actions);
    const metrics = UI.metrics([
      { label: 'Начальный долг', value: UI.money(deal.opening_principal, true) },
      { label: 'Погашение тела', value: UI.money(deal.total_principal, true), help: 'principalRepaid' },
      { label: 'Проценты', value: UI.money(deal.total_interest, true) },
      { label: 'Конечный остаток', value: UI.money(deal.closing_balance, true) },
    ]);
    const flowCount = (n) => UI.count(n, 'строка', 'строки', 'строк');
    const checks = batch.warnings.length ? UI.count(batch.warnings.length, 'замечание', 'замечания', 'замечаний') : 'Суммы сверены со сводкой';
    const source = `<div class="cash-source">${UI.dealCount(batch.deals.length)} · ${flowCount(batch.rowCount)} выгрузки · <span class="${batch.warnings.length ? 'negative' : 'positive'}">${Help.label(checks, 'reconciliation')}</span></div>`;
    const warnings = batch.warnings.length ? `<details class="issues" ${view.issuesOpen ? 'open' : ''}><summary>Результаты сверки${UI.icon('down', 17)}</summary><ul>${batch.warnings.slice(0, 15).map((entry) => `<li>${UI.esc(entry)}</li>`).join('')}${batch.warnings.length > 15 ? `<li>Ещё ${batch.warnings.length - 15} замечаний.</li>` : ''}</ul></details>` : '';
    const filter = `<div class="cash-filter"><label>Сделка <select id="cash-id">${batch.deals.map(({ id }) => UI.option(id, `№ ${id}`, deal.id)).join('')}</select></label><span>${UI.count(deal.payments.length, 'платёжная дата', 'платёжные даты', 'платёжных дат')} · ${flowCount(deal.sourceCount)} в файле</span></div>`;
    const bar = viewBar({ dates: 'По датам', years: 'По годам' }, view.mode, 'cash-view', 'Вид денежных потоков', UI.button('Скачать все платежи', 'download', 'cash-export', 'secondary', deal.payments.length ? 'title="CSV за все годы выбранной сделки"' : 'disabled'));
    const detail = view.mode === 'years'
      ? `<p class="view-hint">Нажмите на год, чтобы открыть платежи по датам.</p>${Charts.yearly(years, view.year)}
        <div class="chart-legend"><span><i class="legend-dot principal"></i>Тело долга</span><span><i class="legend-dot interest"></i>Проценты</span></div>`
      : cashTable(view, years, rows, pageSize);
    return header + source + warnings + filter + metrics + `<section class="panel work-panel">${bar}${detail}</section>`;
  }

  function cashTable(view, years, rows, pageSize) {
    const page = Math.max(0, Math.min(view.page, Math.ceil(rows.length / pageSize) - 1));
    const yearFilter = `<div class="table-controls"><select id="cash-year" aria-label="Год платежа">${UI.option('all', 'Все годы', view.year)}${years.map(({ year }) => UI.option(year, year, view.year)).join('')}</select></div>
      <p class="view-hint">Записи за одну дату сведены в одну строку. «Итого» — погашение основного долга плюс проценты.</p>`;
    const payments = rows.slice(page * pageSize, (page + 1) * pageSize).map((payment) => `<tr><td>${UI.date(payment.date)}</td><td class="t-right">${UI.money(payment.principal, true)}</td><td class="t-right">${UI.money(payment.interest, true)}</td><td class="t-right amount">${UI.money(payment.total, true)}</td></tr>`).join('');
    const table = rows.length
      ? tableWrap('Таблица платежей', `<table class="payment-table"><thead><tr><th scope="col">Дата</th><th scope="col" class="t-right">Тело долга</th><th scope="col" class="t-right">Проценты</th><th scope="col" class="t-right">Итого</th></tr></thead><tbody>${payments}</tbody></table>`)
      : UI.empty('Платежей нет', 'Для этой сделки в выбранном году нет данных.');
    return yearFilter + table + `<div class="table-footer"><span>Суммы в единицах выгрузки</span>${UI.pager(page, rows.length, pageSize, 'cash-page')}</div>`;
  }

  function importDialog(custom) {
    return `<form id="import-form" class="import-form"><div class="dialog-head"><h2 id="import-title">Загрузить CSV</h2><button type="button" class="icon-button" data-action="close-import" aria-label="Закрыть">${UI.icon('close')}</button></div>
      <p class="dialog-note">Выберите два файла из одного запуска калькулятора команды 1.</p>
      <label class="file-field"><strong>Сводка по сделкам</strong><span>deal_summary.csv — итоги по каждой сделке</span><input type="file" name="summary" accept=".csv,text/csv" required></label>
      <label class="file-field"><strong>Денежные потоки</strong><span>cashflows.csv — отдельные платежи по датам</span><input type="file" name="flows" accept=".csv,text/csv" required></label>
      <label class="file-field"><strong>Вход калькулятора</strong><span>Необязательно. Нормализованный CSV помогает сверить состав и даты.</span><input type="file" name="input" accept=".csv,text/csv"></label>
      <div id="import-error" class="form-message error" role="alert" hidden></div>
      <div class="modal-actions">${custom ? UI.button('Вернуть пример', null, 'reset-cash') : UI.button('Отмена', null, 'close-import')}<button class="button primary" type="submit">${UI.icon('upload')}Загрузить файлы</button></div>
    </form>`;
  }

  function valuation(view, batch) {
    const header = UI.heading('Сценарная оценка',
      'Сравните стоимость одних и тех же платежей по базовой и стрессовым кривым.',
      UI.button('Загрузить совместный пример', null, 'valuation-example'));
    const curveInfo = view.curves
      ? `${view.fileName} · ${UI.date(view.curves.reportDate)}${view.curves.provenance ? ` · ${view.curves.provenance}` : ''}`
      : '';
    const scope = [UI.option('', 'Вся выгрузка', view.dealId),
      ...batch.deals.map((deal) => UI.option(deal.id, `Сделка № ${deal.id}`, view.dealId))].join('');
    const form = `<section class="panel scenario-panel" aria-label="Данные для оценки">
      <p class="scenario-source"><strong>Денежные потоки</strong> · ${UI.esc(batch.source)} · ${UI.dealCount(batch.deals.length)} <a class="link-button" href="#cashflows">Изменить выгрузку</a></p>
      <form id="valuation-form">
        <div class="analysis-filters scenario-fields">
          <label>Отчётная дата потоков<input type="date" name="reportDate" id="valuation-date" value="${UI.esc(view.reportDate)}" required aria-describedby="valuation-date-help"></label>
          <label>Сделки в расчёте<select name="dealId" id="valuation-deal">${scope}</select></label>
        </div>
        <p class="field-help" id="valuation-date-help">Возьмите дату из поля report_dttm входного файла калькулятора. На ту же дату нужны кривые.</p>
        <div class="file-field"><strong>Кривые команды 2</strong><span>CSV из интерфейса кривых или JSON готового расчёта</span>
          <div class="scenario-file-actions">${UI.button(view.curves ? 'Заменить файл' : 'Выбрать файл', 'upload', 'curve-picker', 'secondary', 'id="curve-picker"')}
            <span role="status">${UI.esc(curveInfo)}</span></div>
          <input id="curve-file" type="file" accept=".csv,.json,text/csv,application/json" hidden>
        </div>
        ${view.error ? `<p class="form-message error" role="alert" id="valuation-error">${UI.esc(view.error)}</p>` : ''}
        <button class="button primary" type="submit" id="valuation-submit" ${view.curves ? '' : 'disabled'}>Рассчитать PV</button>
      </form></section>`;
    if (!view.result) return header + form;
    const { results, reportDate, dealCount } = view.result;
    const rows = results.map(({ name, pv, delta }) => `<tr><th scope="row">${UI.esc(name)}</th>
      <td class="t-right amount">${UI.money(pv, true)}</td><td class="t-right amount ${UI.tone(delta)}">${UI.signed(delta, (x) => UI.money(x, true))}</td></tr>`).join('');
    const table = tableWrap('Стоимость по сценариям', `<table class="factor-table"><thead><tr>
      <th scope="col">Сценарий</th><th scope="col" class="t-right">PV, ₽</th><th scope="col" class="t-right">Δ к базе, ₽</th></tr></thead><tbody>${rows}</tbody></table>`);
    return header + form + `<section class="panel scenario-panel" id="valuation-results" aria-labelledby="scenario-result">
      <div class="scenario-result-head"><div><h2 id="scenario-result" tabindex="-1">Стоимость по сценариям</h2>
        <p class="field-help">${UI.date(reportDate)} · ${UI.dealCount(dealCount)}</p></div>
        ${UI.button('Скачать результаты', 'download', 'valuation-export')}</div>
      ${table}
      <p class="view-hint scenario-note">PV складывает дисконтированные платежи. Δ показывает стоимость сценария минус стоимость по базовой кривой.</p>
    </section>`;
  }

  return { labels, sidebar, generator, portfolio, dealTable, dealDialog, analysis, factorDialog, cashflow, importDialog, valuation };
})();

