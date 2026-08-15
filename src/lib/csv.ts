/**
 * Minimal CSV export helpers (RFC 4180-ish).
 *
 * Reports and the Settings → Data & export tab both use these. The browser
 * downloads the file directly; no server round-trip needed.
 */

/**
 * Quote a single field for CSV (handles commas, quotes, and newlines).
 *
 * Also guards against spreadsheet formula injection: untrusted text that
 * starts with `=`, `+`, or `@` is prefixed with a single quote so Excel,
 * Sheets, and Numbers treat it as text instead of executing it. Numbers pass
 * through untouched so negative amounts stay numeric. (`-` is deliberately
 * not guarded because it collides with legitimate negative money values; a
 * bare leading `-` is not a practical injection vector the way `=`/`+`/`@` are.)
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let s = String(value);
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Serialize rows (first row = headers) to a CSV string. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

/** Trigger a browser download of a CSV file. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const blob = new Blob(["\uFEFF", toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print a report to PDF via the browser's print dialog. Opens a small,
 * print-styled window with an HTML table so the user can "Save as PDF".
 */
export function printReport(title: string, rows: (string | number | null | undefined)[][]): void {
  const head = rows[0] ?? [];
  const body = rows.slice(1);
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #1c1917; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p.sub { font-size: 12px; color: #78716c; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e7e5e4; }
    th { background: #f5f5f4; font-weight: 600; }
    td.num, th.num { text-align: right; }
    tr.total td { font-weight: 700; border-top: 2px solid #a8a29e; }
    @media print { body { margin: 8mm; } }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="sub">Generated ${esc(new Date().toLocaleString())}</p>
  <table>
    <thead><tr>${head.map((h) => `<th class="num">${esc(String(h))}</th>`).join("")}</tr></thead>
    <tbody>
      ${body
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td class="num">${esc(String(c ?? ""))}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    throw new Error("Your browser blocked the print window. Allow pop-ups and try again.");
  }
  win.document.write(html);
  win.document.close();
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
