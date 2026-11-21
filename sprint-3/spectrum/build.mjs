import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const modules = ['portfolio', 'analysis', 'csv', 'cashflows', 'ui', 'help', 'charts', 'views', 'app'];
const [template, css, summary, cashflows, code] = await Promise.all([
  read('src/index.template.html'), read('src/styles.css'), read('data/deal_summary.csv'), read('data/cashflows.csv'),
  Promise.all(modules.map((file) => read(`src/${file}.js`))),
]);
const files = JSON.stringify({ summary, cashflows });
const script = `(() => {\n'use strict';\nconst TeamOneFiles = ${files};\n${code.join('\n\n')}\n})();`;
const html = template
  .replace(/\s*<!-- @template-help:begin -->[\s\S]*?<!-- @template-help:end -->\s*/, '')
  .replace('<!-- @style -->', () => `<style>${css}</style>`)
  .replace('<!-- @script -->', () => `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`);
await writeFile(new URL('index.html', root), html);
console.log('Готово: index.html');
