const App = (() => {
  const pageSize = 10;
  const storageKey = 'spectrum:portfolio:v1';
  const main = document.getElementById('main-content');
  const sidebar = document.getElementById('sidebar');
  const modal = document.getElementById('import-modal');
  const factorModal = document.getElementById('factor-modal');
  const dealModal = document.getElementById('deal-modal');
  const helpModal = document.getElementById('help-modal');
  const toastBox = document.getElementById('toast');
  const initialDemo = Portfolio.generate(Portfolio.defaults);
  const originalCash = Cashflows.fromCsv(TeamOneFiles.summary, TeamOneFiles.cashflows, 'Встроенный пример выгрузки калькулятора команды 1');

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.version === 1 && Portfolio.validate(saved.settings).valid) return Portfolio.generate(saved.settings);
    } catch { /* Some browsers disable storage for local files. The settings can still be exported. */ }
    return initialDemo;
  }

  const saved = restore();
  const dealFilters = { query: '', paymentFilter: '', rateFilter: '', termFilter: '' };
  const analysisDefaults = { mode: 'chart', from: 1, to: 2, segment: 'all' };
  const state = {
    route: '', result: saved, stats: Portfolio.statistics(saved),
    generator: { form: { ...saved.settings }, errors: {}, distributionOpen: false, advancedOpen: false, message: null },
    portfolio: { mode: 'deals', page: 0, sortKey: 'id', sortDirection: 1, ...dealFilters },
    analysis: { ...analysisDefaults, source: saved === initialDemo ? 'demo' : 'generated', methodOpen: false },
    cash: { mode: 'dates', batch: originalCash, id: originalCash.deals[0].id, year: 'all', page: 0, issuesOpen: false },
  };
  let cache;
  let toastTimer;

  function toast(text) {
    clearTimeout(toastTimer);
    toastBox.hidden = false;
    toastBox.innerHTML = `${UI.icon('info', 17)}<span>${UI.esc(text)}</span>`;
    toastTimer = setTimeout(() => { toastBox.hidden = true; }, 3400);
  }

  function activeAnalysis() {
    const a = state.analysis;
    const portfolio = a.source === 'generated' ? state.result : initialDemo;
    const key = `${a.from}/${a.to}/${a.segment}`;
    if (cache?.portfolio !== portfolio || cache?.key !== key) {
      cache = { portfolio, key, result: RiskAnalysis.compare(portfolio, a.from, a.to, a.segment) };
    }
    return { portfolio, result: cache.result, dates: RiskAnalysis.periods(portfolio.settings.valuationDate) };
  }

  function activeDeal() {
    return state.cash.batch.deals.find((deal) => deal.id === state.cash.id) ?? state.cash.batch.deals[0];
  }

  function portfolioSubtitle() {
    const draft = Portfolio.validate(state.generator.form);
    const applied = draft.valid && Object.keys(state.result.settings).every((key) => state.result.settings[key] === draft.settings[key]);
    if (!applied) return 'Показан последний портфель. Чтобы применить новые настройки, запустите генерацию.';
    return state.result === initialDemo
      ? 'Готовый пример с тестовыми сделками.'
      : 'Посмотрите сделки или откройте портфель в анализе, чтобы сравнить его стоимость на две даты.';
  }

  function render(keepFocus = true) {
    const focused = document.activeElement;
    const identity = keepFocus && main.contains(focused) ? (focused.id ? { id: focused.id } : { key: focused.dataset.focusKey }) : null;
    const tableOffset = keepFocus ? main.querySelector('.table-scroll')?.scrollLeft : 0;
    document.body.dataset.route = state.route;
    if (state.route === 'generator') main.innerHTML = Views.generator(state.generator);
    else if (state.route === 'portfolio') main.innerHTML = Views.portfolio(state.portfolio, state.result, state.stats, pageSize, portfolioSubtitle());
    else if (state.route === 'cashflows') {
      const deal = activeDeal();
      const rows = state.cash.year === 'all' ? deal.payments : deal.payments.filter((payment) => payment.date.startsWith(`${state.cash.year}-`));
      main.innerHTML = Views.cashflow(state.cash, state.cash.batch, deal, Cashflows.byYear(deal.payments), rows, pageSize);
    } else {
      const { result, dates } = activeAnalysis();
      main.innerHTML = Views.analysis(state.analysis, result, dates, state.result !== initialDemo);
    }
    const scroller = main.querySelector('.table-scroll');
    if (scroller && tableOffset) scroller.scrollLeft = tableOffset;
    if (identity?.id) focusUpdated(document.getElementById(identity.id));
    if (identity?.key) focusUpdated(main.querySelector(`[data-focus-key="${CSS.escape(identity.key)}"]`));
  }

  function focusUpdated(target) {
    if (target?.disabled && target.dataset.page !== undefined) {
      target = target.closest('.pagination')?.querySelector('button:not(:disabled)');
    }
    target?.focus({ preventScroll: true });
  }

  function setRoute({ focus = true } = {}) {
    const hash = location.hash.slice(1);
    if (hash === 'main-content' && state.route) return;
    const name = Object.hasOwn(Views.labels, hash) ? hash : 'generator';
    if (state.route === name) return;
    if (helpModal.open) helpModal.close();
    if (factorModal.open) factorModal.close();
    if (dealModal.open) dealModal.close();
    if (modal.open) modal.close();
    state.route = name;
    const active = document.activeElement?.getAttribute('href');
    sidebar.innerHTML = Views.sidebar(name);
    if (active === `#${name}`) sidebar.querySelector(`nav a[href="#${name}"]`)?.focus({ preventScroll: true });
    document.title = `${Views.labels[name]} · Спектр`;
    render(false);
    window.scrollTo(0, 0);
    if (focus) document.getElementById('page-title')?.focus({ preventScroll: true });
  }

  function updateDealTable() {
    const table = document.getElementById('deal-table');
    if (!table) return;
    const focusKey = document.activeElement?.dataset.focusKey;
    const tableOffset = table.querySelector('.table-scroll')?.scrollLeft;
    table.innerHTML = Views.dealTable(state.portfolio, state.result, state.stats, pageSize);
    const scroller = table.querySelector('.table-scroll');
    if (scroller && tableOffset) scroller.scrollLeft = tableOffset;
    if (focusKey) focusUpdated(table.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`));
  }

  function generate(form) {
    const g = state.generator;
    g.form = Object.fromEntries(new FormData(form));
    const result = Portfolio.generate(g.form);
    if (result.errors) {
      g.errors = result.errors;
      g.message = { type: 'error', text: 'Проверьте выделенные настройки.' };
      render(false);
      const error = Object.keys(g.errors)[0];
      const focus = { paymentShares: 'annuity', rateShares: 'fixed' }[error] ?? error;
      const input = document.getElementById(`gen-${focus}`);
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ block: 'center' });
      return;
    }
    state.result = result;
    state.stats = Portfolio.statistics(result);
    Object.assign(state.analysis, analysisDefaults, { source: 'generated' });
    Object.assign(g, { form: { ...result.settings }, errors: {}, message: null });
    Object.assign(state.portfolio, dealFilters, { mode: 'deals', page: 0 });
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, settings: result.settings })); } catch { /* Export remains available. */ }
    location.hash = 'portfolio';
    toast(`Портфель готов · ${UI.dealCount(result.deals.length)}`);
  }

  function applySettings(settings, message) {
    Object.assign(state.generator, { form: { ...settings }, errors: {}, message: { type: 'normal', text: message } });
    render();
  }

  function openFactor(button) {
    const { result, dates } = activeAnalysis();
    const factor = result.factors?.find(({ key }) => key === button.dataset.factor);
    if (!factor) return;
    button.focus({ preventScroll: true });
    const { from, to } = state.analysis;
    factorModal.innerHTML = Views.factorDialog(factor, result, dates[from].date, dates[to].date);
    factorModal.showModal();
  }

  function openImport(button) {
    button.focus({ preventScroll: true });
    modal.innerHTML = Views.importDialog(state.cash.batch !== originalCash);
    modal.showModal();
    modal.querySelector('input').focus();
  }

  function setCash(batch) {
    Object.assign(state.cash, { mode: 'dates', batch, id: batch.deals[0].id, year: 'all', page: 0, issuesOpen: false });
    if (modal.open) modal.close();
    render(false);
    main.querySelector('[data-action="open-import"]')?.focus({ preventScroll: true });
  }

  async function importCash(form) {
    if (form.dataset.busy) return;
    const files = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const box = document.getElementById('import-error');
    form.dataset.busy = 'true';
    box.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Проверяем файлы…';
    try {
      const [summary, flows] = await Promise.all([files.get('summary').text(), files.get('flows').text()]);
      const batch = Cashflows.fromCsv(summary, flows, 'Загруженная выгрузка');
      if (!modal.open || !form.isConnected) return;
      setCash(batch);
      toast(batch.warnings.length ? 'Файлы загружены. Посмотрите результаты сверки.' : 'Файлы загружены, суммы сверены.');
    } catch (error) {
      if (!modal.open || !form.isConnected) return;
      box.hidden = false;
      box.textContent = error.message;
      submit.disabled = false;
      submit.innerHTML = `${UI.icon('upload')}Загрузить файлы`;
      delete form.dataset.busy;
    }
  }

  function exportAnalysis() {
    const { result, dates } = activeAnalysis();
    if (result.error) return;
    const { from, to } = state.analysis;
    const a = dates[from].date, b = dates[to].date;
    const rows = [['period_from', 'period_to', 'segment', 'source', 'metric', 'factor', 'amount_rub']];
    const add = (metric, factor, amount) => rows.push([a, b, result.segment, 'spectrum_demo_model', metric, factor, Number(amount.toFixed(2))]);
    add('NPV на начало', '', result.start);
    add('NPV на конец', '', result.end);
    add('Изменение NPV', '', result.difference);
    add('Необъяснённый остаток', '', result.residual);
    result.factors.forEach((f) => add('Вклад', f.title, f.contribution));
    Csv.download(`npv_${a}_${b}.csv`, Csv.serialize(rows));
    toast('Отчёт NPV скачан.');
  }

  const actions = {
    report: exportAnalysis,
    'open-help': (button) => {
      const content = Help.content(button.dataset.help);
      if (!content) return;
      button.focus({ preventScroll: true });
      helpModal.innerHTML = content;
      helpModal.showModal();
    },
    'close-help': () => helpModal.close(),
    'portfolio-export': () => {
      Csv.download('synthetic_deals.csv', Csv.serialize(Portfolio.exportRows(state.result)));
      toast('Портфель скачан в CSV.');
    },
    'settings-export': () => {
      Csv.download('portfolio_settings.json', JSON.stringify({ version: 1, settings: state.result.settings }, null, 2), 'application/json');
      toast('Скачаны настройки последнего сгенерированного портфеля.');
    },
    'settings-picker': () => document.getElementById('settings-file').click(),
    'analyze-portfolio': () => {
      Object.assign(state.analysis, analysisDefaults, { source: state.result === initialDemo ? 'demo' : 'generated' });
      location.hash = 'analysis';
    },
    'portfolio-view': (button) => { state.portfolio.mode = button.dataset.view; render(); },
    'distribution-filter': (button) => {
      const { field, value } = button.dataset;
      Object.assign(state.portfolio, dealFilters, { mode: 'deals', page: 0, [field]: value });
      render(false);
      main.querySelector(`[data-portfolio-filter="${field}"]`).focus();
    },
    'clear-deal-filters': () => {
      Object.assign(state.portfolio, dealFilters, { page: 0 });
      render(false);
      document.getElementById('deal-search').focus();
    },
    'selection-export': () => {
      const deals = Portfolio.selectDeals(state.result.deals, state.portfolio, state.stats.terms);
      if (!deals.length) return;
      Csv.download('synthetic_deals_selection.csv', Csv.serialize(Portfolio.exportRows({ deals })));
      toast(`Выборка скачана · ${UI.dealCount(deals.length)}`);
    },
    'open-deal': (button) => {
      const deal = state.result.deals.find(({ id }) => id === button.dataset.deal);
      if (!deal) return;
      button.focus({ preventScroll: true });
      dealModal.innerHTML = Views.dealDialog(deal);
      dealModal.showModal();
    },
    'close-deal': () => dealModal.close(),
    'analysis-view': (button) => { state.analysis.mode = button.dataset.view; render(); },
    'cash-view': (button) => { state.cash.mode = button.dataset.view; render(); },
    'deal-page': (button) => { state.portfolio.page = Number(button.dataset.page); updateDealTable(); },
    'cash-page': (button) => { state.cash.page = Number(button.dataset.page); render(); },
    'sort-deals': (button) => {
      const view = state.portfolio;
      const key = button.dataset.sort;
      view.sortDirection = key === view.sortKey ? -view.sortDirection : 1;
      view.sortKey = key;
      view.page = 0;
      updateDealTable();
    },
    'choose-factor': openFactor,
    'close-factor': () => factorModal.close(),
    'choose-year': (button) => {
      state.cash.year = button.dataset.year;
      state.cash.page = 0;
      state.cash.mode = 'dates';
      render(false);
      document.getElementById('cash-year').focus();
    },
    'open-import': openImport,
    'close-import': () => modal.close(),
    'reset-cash': () => { setCash(originalCash); toast('Снова открыта выгрузка команды 1.'); },
    'cash-export': () => {
      Csv.download('payment_schedule.csv', Csv.serialize(Cashflows.exportRows(activeDeal())));
      toast('Платежи выбранной сделки скачаны в CSV.');
    },
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) actions[button.dataset.action]?.(button);
  });
  document.addEventListener('keydown', (event) => {
    const button = event.target.closest('g[role="button"][data-action]');
    if (button && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      actions[button.dataset.action]?.(button);
    }
  });
  document.addEventListener('submit', (event) => {
    if (event.target.id === 'generator-form') { event.preventDefault(); generate(event.target); }
    if (event.target.id === 'import-form') { event.preventDefault(); void importCash(event.target); }
  });
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.id === 'deal-search') {
      Object.assign(state.portfolio, { query: el.value, page: 0 });
      updateDealTable();
    }
    if (el.name && (el.matches('#generator-form input[name]') || el.matches('#generator-form select[name]'))) {
      state.generator.form[el.name] = el.value;
    }
  });
  document.addEventListener('change', async (event) => {
    const el = event.target;
    if (el.dataset.analysis) {
      const key = el.dataset.analysis;
      state.analysis[key] = key === 'from' || key === 'to' ? Number(el.value) : el.value;
      render();
    }
    if (el.id === 'preset-select' && Portfolio.presets[el.value]) {
      applySettings(Portfolio.presets[el.value], `Применён профиль «${el.selectedOptions[0].textContent}».`);
    }
    if (el.dataset.portfolioFilter) {
      Object.assign(state.portfolio, { [el.dataset.portfolioFilter]: el.value, page: 0 });
      updateDealTable();
    }
    if (el.id === 'cash-id') { Object.assign(state.cash, { id: el.value, year: 'all', page: 0 }); render(); }
    if (el.id === 'cash-year') { Object.assign(state.cash, { year: el.value, page: 0 }); render(); }
    if (el.id === 'settings-file' && el.files[0]) {
      try {
        const saved = JSON.parse(await el.files[0].text());
        if (saved?.version !== 1 || !Portfolio.validate(saved.settings).valid) throw new Error();
        applySettings(saved.settings, 'Настройки загружены. Нажмите «Сгенерировать портфель».');
      } catch { toast('Не удалось прочитать настройки портфеля. Выберите JSON из «Скачать настройки».'); }
      el.value = '';
    }
  });
  document.addEventListener('toggle', (event) => {
    const el = event.target;
    if (!el.isConnected) return;
    if (el.dataset.generatorOpen) state.generator[el.dataset.generatorOpen] = el.open;
    if (el.matches('.method')) state.analysis.methodOpen = el.open;
    if (el.matches('.issues')) state.cash.issuesOpen = el.open;
  }, true);
  window.addEventListener('hashchange', () => setRoute());
  setRoute({ focus: false });
})();
