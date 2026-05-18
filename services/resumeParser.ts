import { GoogleGenAI, Type } from '@google/genai';
import { ResumeStructured } from '../types';
import { RESUME_PARSE_PROMPT } from '../constants';

const getApiKey = (): string => {
  const fromLocal = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  const fromEnv = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  return fromLocal || fromEnv || '';
};

const SUPPORTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

const safeParse = (text: string | undefined): ResumeStructured | null => {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText) as ResumeStructured;
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
        resolve({
          status: 'error',
          kind: 'gemini_error',
          message: err instanceof Error ? err.message : 'Gemini API error',
        });
      }
    };

    reader.onerror = () => {
      resolve({ status: 'error', kind: 'gemini_error', message: 'FileReader error' });
    };

    reader.readAsDataURL(file);
  });
}

export async function parseResumeText(text: string): Promise<ParseResult> {
  if (!text || !text.trim()) {
    return { status: 'error', kind: 'empty_response', message: 'Resume text is empty' };
  }

  try {
    const result = await callGeminiWithText(text);
    return result;
  } catch (err) {
    return {
      status: 'error',
      kind: 'gemini_error',
      message: err instanceof Error ? err.message : 'Gemini API error',
    };
  }
}

async function callGeminiWithMultimodal(mime: string, base64: string): Promise<ParseResult> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const response = await ai.models.generateContent({
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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const response = await ai.models.generateContent({
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
