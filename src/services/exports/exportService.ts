import { buildCsv } from "../../utils/csv";

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const content = buildCsv(headers, rows, ";");

  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printReport(title: string, content: HTMLElement | null) {
  if (!content) return;
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Poppins, sans-serif; color: #243127; padding: 24px; }
          h1 { color: #A8C686; margin-bottom: 8px; }
          h2 { margin: 18px 0 6px; }
          table { border-collapse: collapse; width: 100%; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
          th { background: #A8C68622; }
          .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Rejet Corp — ${title}</h1>
        <p>Emitido em ${new Date().toLocaleString("pt-BR")}</p>
        <div>${content.innerHTML}</div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
