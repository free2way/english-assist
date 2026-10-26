export type CsvCell = string | number | boolean | null | undefined;

const escapeCell = (cell: CsvCell) => {
  if (cell === null || cell === undefined) return '';
  const text = String(cell);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildCsv = (headers: string[], rows: CsvCell[][]) =>
  [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');

/** Local yyyy-mm-dd (toISOString would shift the date before 08:00 in UTC+8). */
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Downloads a UTF-8 CSV. The BOM keeps Excel (the common case for teachers on
 * Windows) from mangling Chinese characters.
 */
export const downloadCsv = (prefix: string, headers: string[], rows: CsvCell[][]) => {
  const blob = new Blob(['\uFEFF', buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${todayKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
