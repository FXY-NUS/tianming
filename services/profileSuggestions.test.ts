import { describe, expect, it } from 'vitest';
import type { ResumeStructured, UserPreferences } from '../types';
import { applyProfileSuggestions, buildProfileSuggestions } from './profileSuggestions';

const resume: ResumeStructured = {
  basic: { name: 'Ada Lovelace', location: 'Singapore' },
  summary: 'Data analyst with product analytics experience.',
  education: [{ school: 'NUS', degree: 'MSc', major: 'Analytics', years: '2025-2026' }],
  experience: [{ company: 'Acme', title: 'Data Intern', period: '2025.01 - 2025.06', bullets: [] }],
  skills: {
    hard: ['SQL', 'Python'],
    soft: ['stakeholder communication'],
    languages: ['English'],
    tools: ['Tableau'],
  },
  projects: [],
};

const preferences: UserPreferences = {
  displayName: '',
  backgroundSummary: '',
  astrologyProfile: '',
  jobPreferences: '',
  preferredLocations: [],
  avoidKeywords: [],
};

describe('profileSuggestions', () => {
  it('suggests profile fields from a structured resume without mutating preferences', () => {
    const suggestions = buildProfileSuggestions(resume, preferences);

    expect(suggestions.map((suggestion) => suggestion.key)).toEqual([
      'displayName',
      'backgroundSummary',
      'preferredLocations',
    ]);
    expect(preferences.displayName).toBe('');
  });

  it('does not suggest fields the user has already filled manually', () => {
    const suggestions = buildProfileSuggestions(resume, {
      ...preferences,
      displayName: 'Manual Name',
      backgroundSummary: 'Manual summary',
      preferredLocations: ['Shanghai'],
    });

    expect(suggestions).toEqual([]);
  });

  it('applies suggestions only into empty fields and merges location arrays', () => {
    const suggestions = buildProfileSuggestions(resume, preferences);
    const applied = applyProfileSuggestions(preferences, suggestions);

    expect(applied.displayName).toBe('Ada Lovelace');
    expect(applied.backgroundSummary).toContain('SQL');
    expect(applied.preferredLocations).toEqual(['Singapore']);
  });
});
