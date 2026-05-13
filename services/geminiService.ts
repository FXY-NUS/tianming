import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserContext } from "../types";
import { FLASH_FILTER_PROMPT, PRO_AUDIT_PROMPT, CHAT_SYSTEM_PROMPT } from "../constants";

const getApiKey = (): string => {
  const fromLocal = typeof window !== "undefined" ? localStorage.getItem("GEMINI_API_KEY") : null;
  const fromEnv = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  return fromLocal || fromEnv || "";
};

const safeParse = (text: string | undefined) => {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error:", text);
    return null;
  }
};

export const batchScreenJobs = async (jobs: Job[], ctx: UserContext) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const chunkedJobs = jobs.map(j => ({
    id: j.id,
    title: j.title,
    company: j.company,
    snippet: j.content.substring(0, 800)
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `执行初筛：${JSON.stringify(chunkedJobs)}`,
    config: {
      systemInstruction: FLASH_FILTER_PROMPT(ctx),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            score: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["id", "score", "reason"]
        }
      }
    }
  });

  return safeParse(response.text) || [];
};

export const deepAuditJob = async (job: Job, ctx: UserContext) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `启动天命深度审计。公司：${job.company}。职位：${job.title}。JD原文：${job.content}`,
    config: {
      systemInstruction: PRO_AUDIT_PROMPT(ctx),
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 32768 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          hexagram: { type: Type.STRING },
          judgment: { type: Type.STRING },
          detailed_analysis: {
            type: Type.OBJECT,
            properties: {
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["pros", "cons"]
          },
          cruel_truth_2026: { type: Type.STRING },
          career_growth: { type: Type.STRING },
          interview_tactics: { type: Type.STRING },
          contract_red_flags: { type: Type.STRING }
        },
        required: ["score", "summary", "hexagram", "judgment", "detailed_analysis", "cruel_truth_2026", "career_growth", "interview_tactics", "contract_red_flags"]
      }
    }
  });

  const parsed = safeParse(response.text);
  if (!parsed) throw new Error("Pro Audit Parse Error");
  return parsed;
};

export const sendMessageToJobConsultant = async (job: Job, ctx: UserContext, message: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: CHAT_SYSTEM_PROMPT(job.title, job.company, ctx),
    },
  });

  const response = await chat.sendMessage({
    message: `Context: ${job.content.substring(0, 2000)}\nUser: ${message}`
  });
  return response.text;
};
