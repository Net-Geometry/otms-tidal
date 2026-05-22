import JSZip from 'jszip';

type ExportHeader = { key: string; label: string };
type ExportMetadata = { reportName?: string; period?: string; generatedDate?: string };

export async function buildXLSXBlob(
  data: Record<string, unknown>[],
  headers: ExportHeader[],
  metadata?: ExportMetadata
): Promise<Blob> {
  const rows = buildRows(data, headers, metadata);
  const strings: string[] = [];
  const stringIndexes = new Map<string, number>();

  const getStringIndex = (value: string) => {
    if (!stringIndexes.has(value)) {
      stringIndexes.set(value, strings.length);
      strings.push(value);
    }

    return stringIndexes.get(value)!;
  };

  const sheetRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => {
      const cellRef = `${columnName(columnIndex + 1)}${rowNumber}`;

      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${cellRef}"><v>${value}</v></c>`;
      }

      const sharedStringIndex = getStringIndex(value == null ? '' : String(value));
      return `<c r="${cellRef}" t="s"><v>${sharedStringIndex}</v></c>`;
    }).join('');

    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml());
  zip.folder('_rels')?.file('.rels', rootRelsXml());
  zip.folder('xl')?.file('workbook.xml', workbookXml());
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', workbookRelsXml());
  zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', worksheetXml(sheetRows));
  zip.folder('xl')?.file('sharedStrings.xml', sharedStringsXml(strings));
  zip.folder('xl')?.file('styles.xml', stylesXml());

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function exportToXLSX(
  data: Record<string, unknown>[],
  filename: string,
  headers: ExportHeader[],
  metadata?: ExportMetadata
) {
  const blob = await buildXLSXBlob(data, headers, metadata);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildRows(data: Record<string, unknown>[], headers: ExportHeader[], metadata?: ExportMetadata) {
  const rows: unknown[][] = [];

  if (metadata) {
    if (metadata.reportName) rows.push(['Report', metadata.reportName]);
    if (metadata.period) rows.push(['Period', metadata.period]);
    if (metadata.generatedDate) rows.push(['Generated', metadata.generatedDate]);
    rows.push([]);
  }

  rows.push(headers.map((header) => header.label));
  rows.push(...data.map((row) => headers.map((header) => row[header.key])));

  return rows;
}

function columnName(columnNumber: number): string {
  let name = '';
  let number = columnNumber;

  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }

  return name;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function worksheetXml(sheetRows: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function sharedStringsXml(strings: string[]) {
  const items = strings
    .map((value) => `<si><t>${xmlEscape(value)}</t></si>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf xfId="0"/></cellXfs>
</styleSheet>`;
}
