import { beforeEach, describe, expect, it } from 'vitest';
import type { PersonaInstance, UserContext } from '../../types';
import { hollandPlugin } from './plugins/holland';
import { mbtiPlugin } from './plugins/mbti';
import { assemblePersonaPrompt } from './promptAssembly';
import { __resetPersonaRegistry, registerPersona } from './registry';

const BASE_CTX: UserContext = {
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

function mkInstance(type: string, data: Record<string, unknown>): PersonaInstance {
  return { id: type, type, label: type, data, createdAt: '2026-01-01T00:00:00.000Z' };
}

beforeEach(() => {
  __resetPersonaRegistry();
  registerPersona(mbtiPlugin);
  registerPersona(hollandPlugin);
});

describe('assemblePersonaPrompt', () => {
  it('returns empty string when no personas active', () => {
    expect(assemblePersonaPrompt(BASE_CTX)).toBe('');
  });

  it('renders one fragment per active persona, in activeIds order', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [mkInstance('mbti', { type: 'INTJ' }), mkInstance('holland', { primary: 'I' })],
      activePersonaIds: ['mbti', 'holland'],
    };
    const out = assemblePersonaPrompt(ctx);
    expect(out).toContain('MBTI');
    expect(out).toContain('Holland');
    expect(out.indexOf('MBTI')).toBeLessThan(out.indexOf('Holland'));
  });

  it('honours order in activePersonaIds', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [mkInstance('mbti', { type: 'INTJ' }), mkInstance('holland', { primary: 'I' })],
      activePersonaIds: ['holland', 'mbti'],
    };
    const out = assemblePersonaPrompt(ctx);
    expect(out.indexOf('Holland')).toBeLessThan(out.indexOf('MBTI'));
  });

  it('skips personas whose id is not in activePersonaIds', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [mkInstance('mbti', { type: 'INTJ' })],
      activePersonaIds: [],
    };
    expect(assemblePersonaPrompt(ctx)).toBe('');
  });

  it('skips activeIds with no matching instance', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [],
      activePersonaIds: ['mbti'],
    };
    expect(assemblePersonaPrompt(ctx)).toBe('');
  });

  it('skips personas whose plugin is not registered', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [mkInstance('unknown', { x: 1 })],
      activePersonaIds: ['unknown'],
    };
    expect(assemblePersonaPrompt(ctx)).toBe('');
  });

  it('skips personas whose data fails schema validation', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [mkInstance('mbti', { type: 'NOT_A_TYPE' })],
      activePersonaIds: ['mbti'],
    };
    expect(assemblePersonaPrompt(ctx)).toBe('');
  });

  it('joins multiple fragments with a blank line in between', () => {
    const ctx: UserContext = {
      ...BASE_CTX,
      personas: [mkInstance('mbti', { type: 'INTJ' }), mkInstance('holland', { primary: 'I' })],
      activePersonaIds: ['mbti', 'holland'],
    };
    expect(assemblePersonaPrompt(ctx)).toMatch(/MBTI[\s\S]*\n\n[\s\S]*Holland/);
  });
});
