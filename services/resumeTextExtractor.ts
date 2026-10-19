/**
 * 简历文件 → 纯文字，全程在浏览器里完成，原文件不离开本机（D6）。
 * 转成文字后哪家模型都能读（DeepSeek / Kimi 不收文件）；读不出文字的（图片、扫描件）返回 null，
 * 由 resumeParser 退回到把文件交给模型（只有 Gemini 能读）。
 * pdf.js / mammoth 体积大，按需动态加载，不进首屏包。
 */

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** 少于这么多个非空白字符就当作没读出文字（扫描件 PDF 常见只剩页码）。 */
export const MIN_RESUME_TEXT_CHARS = 50;

export async function extractResumeText(file: File, mime: string): Promise<string | null> {
  let text: string;
  if (mime === 'text/plain') text = await file.text();
  else if (mime === PDF_MIME) text = await extractPdfText(await file.arrayBuffer());
  else if (mime === DOCX_MIME) text = await extractDocxText(await file.arrayBuffer());
  else return null;

  const normalized = text
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.replace(/\s/g, '').length >= MIN_RESUME_TEXT_CHARS ? normalized : null;
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = '';
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n');
  } finally {
    await doc.destroy();
  }
}

export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: data });
  return value;
}
