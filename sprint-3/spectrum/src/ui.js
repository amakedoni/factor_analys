const UI = (() => {
  const numbers = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const decimals = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const detail = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const plurals = new Intl.PluralRules('ru-RU');
  const icons = {
    analysis: '<path d="M4 20v-6m5 6V9m5 11V5m5 15V3"/>',
    generator: '<path d="M13.5 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 3v6h6M8 13h8m-8 4h5"/>',
    portfolio: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    cashflows: '<ellipse cx="15" cy="5" rx="6" ry="2.5"/><path d="M9 5v4m0 0c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5m0 4v4c0 1.4-2.7 2.5-6 2.5h-1.5"/><ellipse cx="8" cy="13" rx="5" ry="2.5"/><path d="M3 13v6c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-6m-10 3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
    right: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    next: '<path d="m10 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    sort: '<path d="m8 9 4-4 4 4m-8 6 4 4 4-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    search: '<circle cx="10.5" cy="10.5" r="5.9"/><path d="m15 15 4 4"/>',
    team: '<path d="m3 8 9-5 9 5ZM4 20h16M7 11v6m5-6v6m5-6v6"/>',
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? ''}</svg>`;
  const int = (value) => numbers.format(value);
  const count = (value, one, few, many) => `${int(value)} ${ { one, few, many }[plurals.select(value)] ?? many}`;
  const dealCount = (value) => count(value, 'сделка', 'сделки', 'сделок');
  const money = (value, cents = false) => (cents ? decimals : numbers).format(value);
  const rub = (value, cents = false) => `${money(value, cents)}\u00a0₽`;
  const decimal = (value) => detail.format(value);
  const signed = (value, formatter = money) => `${value < -0.00001 ? '−' : value > 0.00001 ? '+' : ''}${formatter(Math.abs(value))}`;
  const signedRub = (value) => signed(Math.abs(value) < 0.005 ? 0 : value, (amount) => rub(amount, true));
  const pct = (value) => `${decimal(value)}%`;
  const date = (value) => value?.split('-').reverse().join('.') ?? '—';
  const tone = (value) => value < -0.005 ? 'negative' : value > 0.005 ? 'positive' : 'neutral';

  function shortRub(value) {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${decimal(value / 1e9)}\u00a0млрд\u00a0₽`;
    if (abs >= 1e6) return `${Math.abs(value) < 1e7 ? decimals.format(value / 1e6) : decimal(value / 1e6)}\u00a0млн\u00a0₽`;
    if (abs >= 1e3) return `${decimal(value / 1e3)}\u00a0тыс.\u00a0₽`;
    return rub(value, true);
  }

  function option(value, label, selected) {
    return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`;
  }

  function button(label, iconName, action, variant = 'secondary', attributes = '') {
    return `<button type="button" class="button ${variant}" data-action="${action}" ${attributes}>${iconName ? icon(iconName) : ''}<span>${esc(label)}</span></button>`;
  }

  function heading(title, subtitle, action = '') {
    return `<header class="page-head"><div><h1 id="page-title" tabindex="-1">${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</header>`;
  }

  function metrics(rows) {
    return `<dl class="metric-band">${rows.map((row) => `<div class="metric">
      <dt>${row.help ? Help.label(row.label, row.help) : esc(row.label)}${row.context ? `<span class="metric-context">${esc(row.context)}</span>` : ''}</dt>
      <dd class="${row.tone ?? ''}" ${row.title ? `title="${esc(row.title)}"` : ''}>${row.value}</dd>
    </div>`).join('')}</dl>`;
  }

  function pager(page, total, size, action) {
    const pages = Math.max(1, Math.ceil(total / size));
    if (!total) return '';
    const first = page * size + 1;
    return `<div class="pagination" aria-label="Страницы"><span>${int(first)}–${int(Math.min(total, first + size - 1))} из ${int(total)}</span>
      <button type="button" class="icon-button" data-action="${action}" data-page="${page - 1}" data-focus-key="prev-${action}" aria-label="Предыдущая страница" ${page <= 0 ? 'disabled' : ''}>${icon('left', 16)}</button>
      <button type="button" class="icon-button" data-action="${action}" data-page="${page + 1}" data-focus-key="next-${action}" aria-label="Следующая страница" ${page >= pages - 1 ? 'disabled' : ''}>${icon('next', 16)}</button></div>`;
  }

  function empty(title, detailText) {
    return `<div class="empty">${icon('info', 25)}<h2>${esc(title)}</h2><p>${esc(detailText)}</p></div>`;
  }

  return { esc, icon, int, count, dealCount, money, rub, decimal, signed, signedRub, pct, date, tone, shortRub, option, button, heading, metrics, pager, empty };
})();
