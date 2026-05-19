import type { ResumeStructured, UserPreferences } from '../types';

export type ProfileSuggestionKey = 'displayName' | 'backgroundSummary' | 'preferredLocations';

export interface ProfileSuggestion {
  key: ProfileSuggestionKey;
  label: string;
  value: string | string[];
  reason: string;
}

export function buildProfileSuggestions(
  resume: ResumeStructured,
  preferences: UserPreferences,
): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];
  const name = resume.basic.name?.trim();
  const location = resume.basic.location?.trim();
  const backgroundSummary = buildBackgroundSummary(resume);

  if (!preferences.displayName.trim() && name) {
    suggestions.push({
      key: 'displayName',
      label: '姓名',
      value: name,
      reason: '来自简历基础信息。',
    });
  }

  if (!preferences.backgroundSummary.trim() && backgroundSummary) {
    suggestions.push({
      key: 'backgroundSummary',
      label: '背景摘要',
      value: backgroundSummary,
      reason: '由简历摘要、教育、经验和技能生成。',
    });
  }

  if (preferences.preferredLocations.length === 0 && location) {
    suggestions.push({
      key: 'preferredLocations',
      label: '偏好地点',
      value: [location],
      reason: '来自简历所在地，可手动调整。',
    });
  }

  return suggestions;
}

export function applyProfileSuggestions(
  preferences: UserPreferences,
  suggestions: ProfileSuggestion[],
): UserPreferences {
  return suggestions.reduce<UserPreferences>((next, suggestion) => {
    if (suggestion.key === 'preferredLocations') {
      return {
        ...next,
        preferredLocations: mergeUnique(next.preferredLocations, asStringArray(suggestion.value)),
      };
    }

    if (suggestion.key === 'displayName' && !next.displayName.trim()) {
      return { ...next, displayName: String(suggestion.value) };
    }

    if (suggestion.key === 'backgroundSummary' && !next.backgroundSummary.trim()) {
      return { ...next, backgroundSummary: String(suggestion.value) };
    }

    return next;
  }, preferences);
}

function buildBackgroundSummary(resume: ResumeStructured): string {
  const parts = [
    resume.summary?.trim(),
    formatEducation(resume),
    formatExperience(resume),
    formatSkills(resume),
  ].filter((part): part is string => Boolean(part));

  return parts.join(' | ');
}

function formatEducation(resume: ResumeStructured): string | undefined {
  const latest = resume.education[0];
  if (!latest) return undefined;
  return [latest.school, latest.degree, latest.major].filter(Boolean).join(' ');
}

function formatExperience(resume: ResumeStructured): string | undefined {
  const latest = resume.experience[0];
  if (!latest) return undefined;
  return [latest.title, latest.company, latest.period].filter(Boolean).join(' ');
}

function formatSkills(resume: ResumeStructured): string | undefined {
  const skills = [
    ...resume.skills.hard,
    ...resume.skills.tools,
    ...resume.skills.languages,
    ...resume.skills.soft,
  ]
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 12);

  return skills.length > 0 ? `核心技能: ${skills.join(', ')}` : undefined;
}

function asStringArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function mergeUnique(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((item) => item.toLowerCase()));
  const merged = [...current];
  incoming.forEach((item) => {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    merged.push(trimmed);
  });
  return merged;
}
