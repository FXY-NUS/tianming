import { describe, expect, it } from 'vitest';
import type { UserContext } from '../types';
import { buildResponseSchema, buildSystemPrompt } from './matchPromptBuilder';

const ctx: UserContext = {
  personas: [],
  resumes: [],
  preferences: {
    displayName: '',
    backgroundSummary: '',
    astrologyProfile: '',
    jobPreferences: '',
    preferredLocations: [],
    avoidKeywords: [],
  },
  activePersonaIds: [],
};

describe('matchPromptBuilder', () => {
  it('keeps triage prompts evidence-only', () => {
    const prompt = buildSystemPrompt(ctx, 'triage');

    expect(prompt).toContain('Do not output or infer the final overall match score');
  });

  it('keeps audit schema free of LLM-owned final score and judgment fields', () => {
    const schema = buildResponseSchema('audit') as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.properties.score).toBeUndefined();
    expect(schema.properties.judgment).toBeUndefined();
    expect(schema.required).not.toContain('score');
    expect(schema.required).not.toContain('judgment');
  });
});
