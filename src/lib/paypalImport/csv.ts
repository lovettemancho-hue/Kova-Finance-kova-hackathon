// Small, dependency-free CSV parser. Handles BOMs, quoted fields, escaped quotes,
// commas/newlines inside quotes, CRLF line endings and ; or tab delimiters.

function detectDelimiter(firstLines: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    // count delimiters outside quotes on the first line that has content
    let inQuotes = false;
    let count = 0;
    for (const ch of firstLines) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === '\n') break;
      else if (!inQuotes && ch === d) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

export function parseCsv(input: string): string[][] {
  let text = input.replace(/^\uFEFF/, ''); // strip BOM
  if (!text.trim()) return [];

  const delimiter = detectDelimiter(text.slice(0, 4000));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  // last field / row
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  return rows;
}
