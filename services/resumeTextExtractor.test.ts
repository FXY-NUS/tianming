// @vitest-environment node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { DOCX_MIME, extractResumeText, PDF_MIME } from './resumeTextExtractor';

// 测试跑在 Node：pdf.js 换成它的 Node 版本，mammoth 换成浏览器包（与 Vite 打包时取的 browser 入口同源，收 arrayBuffer）。
vi.mock('pdfjs-dist', () => import('pdfjs-dist/legacy/build/pdf.mjs'));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: pathToFileURL(
    createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href,
}));
vi.mock('mammoth', () => ({
  default: createRequire(import.meta.url)('mammoth/mammoth.browser.js'),
}));

const LONG = 'Python SQL Tableau data analyst intern at Acme Corp, built dashboards';

/** 手写一页 PDF：一行 Helvetica 文字，交叉引用表按实际字节偏移生成。 */
function makePdf(line: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

async function makeDocx(paragraph: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'uint8array' });
}

const fileOf = (data: BlobPart, name: string, type: string) => new File([data], name, { type });

describe('extractResumeText', () => {
  it('reads plain text and collapses blank runs', async () => {
    const text = await extractResumeText(
      fileOf(`${LONG}\n\n\n\nSkills:   Python`, 'r.txt', 'text/plain'),
      'text/plain',
    );
    expect(text).toBe(`${LONG}\n\nSkills: Python`);
  });

  it('returns null when there is too little text (scanned PDF, near-empty file)', async () => {
    expect(
      await extractResumeText(fileOf('page 1', 'r.txt', 'text/plain'), 'text/plain'),
    ).toBeNull();
  });

  it('returns null for images so the caller can fall back to the model', async () => {
    expect(await extractResumeText(fileOf('img', 'r.png', 'image/png'), 'image/png')).toBeNull();
  });

  it('extracts text from a PDF in the browser', async () => {
    const text = await extractResumeText(fileOf(makePdf(LONG), 'r.pdf', PDF_MIME), PDF_MIME);
    expect(text).toContain('data analyst intern at Acme Corp');
  });

  it('extracts text from a DOCX in the browser', async () => {
    const docx = await makeDocx(LONG);
    const text = await extractResumeText(fileOf(docx, 'r.docx', DOCX_MIME), DOCX_MIME);
    expect(text).toBe(LONG);
  });
});
