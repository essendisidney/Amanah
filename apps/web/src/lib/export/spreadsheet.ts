/** Escape cell for SpreadsheetML / CSV-safe text. */
function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Excel 2003 XML (.xls) — opens in Excel / LibreOffice without extra deps. */
export function toSpreadsheetMl(sheetName: string, rows: string[][]): string {
  const safeName = sheetName.replace(/[^\w\s-]/g, '').slice(0, 31) || 'Sheet1';
  const tableRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell ?? '')}</Data></Cell>`)
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(safeName)}">
  <Table>${tableRows}</Table>
 </Worksheet>
</Workbook>`;
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
