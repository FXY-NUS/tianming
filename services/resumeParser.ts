import { Type } from '@google/genai';
import { ResumeStructured } from '../types';
import { RESUME_PARSE_PROMPT } from '../constants';
import { generateContent } from './llmClient';
import { DOCX_MIME, extractResumeText, PDF_MIME } from './resumeTextExtractor';

const SUPPORTED_MIMES = [
  PDF_MIME,
  DOCX_MIME,
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
];

type ParseErrorKind = 'unsupported_mime' | 'gemini_error' | 'schema_violation' | 'empty_response';

type ParseResult =
  | { status: 'ok'; data: ResumeStructured }
  | { status: 'error'; kind: ParseErrorKind; message: string };

const defineResumeSchema = () => ({
  type: Type.OBJECT,
  properties: {
    basic: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        location: { type: Type.STRING },
      },
    },
    summary: { type: Type.STRING },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          school: { type: Type.STRING },
          degree: { type: Type.STRING },
          major: { type: Type.STRING },
          gpa: { type: Type.STRING },
          years: { type: Type.STRING },
        },
        required: ['school', 'degree', 'major', 'years'],
      },
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          title: { type: Type.STRING },
          period: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['company', 'title', 'period', 'bullets'],
      },
    },
    skills: {
      type: Type.OBJECT,
      properties: {
        hard: { type: Type.ARRAY, items: { type: Type.STRING } },
        soft: { type: Type.ARRAY, items: { type: Type.STRING } },
        languages: { type: Type.ARRAY, items: { type: Type.STRING } },
        tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['hard', 'soft', 'languages', 'tools'],
    },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          tech: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['name', 'role', 'bullets', 'tech'],
      },
    },
    certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
    rawHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['basic', 'education', 'experience', 'skills', 'projects'],
});

function isValidResumeStructured(obj: unknown): obj is ResumeStructured {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (!o.basic || typeof o.basic !== 'object') return false;
  if (!Array.isArray(o.education)) return false;
  if (!Array.isArray(o.experience)) return false;
  if (!o.skills || typeof o.skills !== 'object') return false;
  const s = o.skills as Record<string, unknown>;
  if (
    !Array.isArray(s.hard) ||
    !Array.isArray(s.soft) ||
    !Array.isArray(s.languages) ||
    !Array.isArray(s.tools)
  ) {
    return false;
  }
  if (!Array.isArray(o.projects)) return false;
  return true;
}

const safeParse = (text: string | undefined): ResumeStructured | null => {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    if (!isValidResumeStructured(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export async function parseResumeFile(file: File): Promise<ParseResult> {
  const mime = file.type || getMimeFromExtension(file.name);

  if (!SUPPORTED_MIMES.includes(mime)) {
    return {
      status: 'error',
      kind: 'unsupported_mime',
      message: `Unsupported file type: ${mime || file.type || 'unknown'}. Supported: PDF, DOCX, PNG, JPG, WEBP, TXT`,
    };
  }

  // 先在浏览器里转成文字：哪家模型都能读，也省掉把整份文件传给模型。
  let text: string | null = null;
  try {
    text = await extractResumeText(file, mime);
  } catch {
    text = null; // 文件损坏或加密：退回到把文件交给模型
  }
  if (text) return parseResumeText(text);
  if (mime === 'text/plain' || mime === DOCX_MIME) {
    return {
      status: 'error',
      kind: 'empty_response',
      message: '没能从文件里读出文字，请把简历内容粘贴到下面。',
    };
  }

  // 图片或扫描件读不出文字：把文件交给模型（只有 Gemini 支持）。
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];

      if (!base64) {
        resolve({ status: 'error', kind: 'empty_response', message: 'File is empty' });
        return;
      }

      try {
        const result = await callGeminiWithMultimodal(mime, base64);
        resolve(result);
      } catch (err) {
        resolve({ status: 'error', kind: 'gemini_error', message: describeLlmError(err) });
      }
    };

    reader.onerror = () => {
      resolve({ status: 'error', kind: 'gemini_error', message: 'FileReader error' });
    };

    reader.readAsDataURL(file);
  });
}

/** 代理换成只读文字的模型时，图片 / 扫描件会被拒（UNSUPPORTED_INPUT），给一句能照做的提示。 */
function describeLlmError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Gemini API error';
  if (message.includes('UNSUPPORTED_INPUT')) {
    return '当前模型只能读文字，这份简历是图片或扫描件，读不出文字。请换成能复制文字的 PDF / Word，或把简历内容粘贴到下面。';
  }
  return message;
}

export async function parseResumeText(text: string): Promise<ParseResult> {
  if (!text || !text.trim()) {
    return { status: 'error', kind: 'empty_response', message: 'Resume text is empty' };
  }

  try {
    const result = await callGeminiWithText(text);
    return result;
  } catch (err) {
    return { status: 'error', kind: 'gemini_error', message: describeLlmError(err) };
  }
}

async function callGeminiWithMultimodal(mime: string, base64: string): Promise<ParseResult> {
  const response = await generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mime,
              data: base64,
            },
          },
          {
            text: RESUME_PARSE_PROMPT,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: defineResumeSchema(),
      thinkingConfig: { thinkingBudget: 4096 },
    },
  });

  const parsed = safeParse(response.text);

  if (!parsed) {
    return {
      status: 'error',
      kind: 'schema_violation',
      message: 'Response JSON does not match schema',
    };
  }

  return { status: 'ok', data: parsed };
}

async function callGeminiWithText(text: string): Promise<ParseResult> {
  const response = await generateContent({
    model: 'gemini-3-pro-preview',
    contents: `${RESUME_PARSE_PROMPT}\n\n【用户简历】：\n${text}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: defineResumeSchema(),
      thinkingConfig: { thinkingBudget: 4096 },
    },
  });

  const parsed = safeParse(response.text);

  if (!parsed) {
    return {
      status: 'error',
      kind: 'schema_violation',
      message: 'Response JSON does not match schema',
    };
  }

  return { status: 'ok', data: parsed };
}

function getMimeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    txt: 'text/plain',
  };
  return mimeMap[ext || ''] || '';
}
