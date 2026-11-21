const Csv = (() => {
  function parse(input, required, fileName) {
    const text = input.replace(/^\uFEFF/, '');
    const firstLine = text.trimStart().split(/\r?\n/, 1)[0];
    const delimiter = [',', ';', '\t'].find((mark) => firstLine.includes(mark)) ?? ',';
    const records = [];
    let row = [], value = '', quoted = false, closed = false;
    const finishCell = () => { row.push(value); value = ''; closed = false; };
    const finishRow = () => {
      finishCell();
      if (row.some((cell) => cell.trim() !== '')) records.push(row);
      row = [];
    };
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') { value += '"'; i += 1; }
          else { quoted = false; closed = true; }
        } else value += char;
      } else if (char === delimiter) finishCell();
      else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        finishRow();
      } else if (char === '"' && !value && !closed) quoted = true;
      else if (!closed && char !== '"') value += char;
      else if (char !== ' ' && char !== '\t') throw new Error(`${fileName}: проверьте кавычки рядом со строкой ${records.length + 1}.`);
    }
    if (quoted) throw new Error(`${fileName}: незакрытые кавычки в CSV.`);
    finishRow();
    const header = records.shift()?.map((name) => name.trim().toLowerCase()) ?? [];
    const missing = required.filter((name) => !header.includes(name));
    if (missing.length) throw new Error(`${fileName}: нет полей ${missing.join(', ')}.`);
    if (new Set(header).size !== header.length) throw new Error(`${fileName}: в заголовке есть повторяющиеся поля.`);
    if (!records.length) throw new Error(`${fileName}: добавьте хотя бы одну строку данных.`);
    return records.map((cells, i) => {
      if (cells.length !== header.length) throw new Error(`${fileName}: строка ${i + 2} содержит ${cells.length} полей вместо ${header.length}.`);
      return Object.fromEntries(header.map((key, j) => [key, cells[j].trim()]));
    });
  }

  function serialize(rows) {
    const cell = (value) => {
      let string = String(value ?? '');
      if (typeof value === 'string' && /^[\s]*[=+@-]/.test(string) && !/^[+-]?\d+(?:[.,]\d+)?$/.test(string)) string = `'${string}`;
      return /[";,\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
    };
    return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  function download(name, data, mediaType = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([data], { type: mediaType }));
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { parse, serialize, download };
})();
