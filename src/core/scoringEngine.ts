import type { Job, ResumeProfile, UserContext } from '../../types';
import type {
  ActiveResumeSnapshot,
  DimensionKey,
  DimensionScore,
  ExtractedEvidence,
  HardFilterSettings,
  JobCardSnapshot,
  JobDetail,
  MatchLabel,
  MatchScore,
  ResumeMatchBreakdown,
  ResumeSkillCoverage,
  ScoringInput,
  ScoringRubric,
  ScoringRubricDimension,
  SkillEvidence,
} from './matchTypes';

export const SCORING_VERSION = 'phase4-scoring-v2.0';

export const DEFAULT_SCORING_RUBRIC: ScoringRubric = {
  version: 'rubric-v1.1',
  personaWeightCap: 0.15,
  dimensions: [
    { key: 'experience', label: 'Experience fit', weight: 0.2, enabled: true },
    { key: 'location', label: 'Location fit', weight: 0.1, enabled: true },
    { key: 'compensation', label: 'Compensation fit', weight: 0.1, enabled: true },
    { key: 'avoid_keywords', label: 'Avoid keywords', weight: 0.1, enabled: true },
    { key: 'skill', label: 'Skill match', weight: 0.25, enabled: true },
    { key: 'culture', label: 'Culture signal', weight: 0.1, enabled: true },
    { key: 'growth', label: 'Growth potential', weight: 0.15, enabled: true },
    { key: 'persona', label: 'Persona fit', weight: 0.0, enabled: true },
  ],
};

const UNKNOWN = undefined;

export function buildMatchScore(input: ScoringInput): MatchScore {
  const rubric = clampPersonaWeight(input.rubric ?? DEFAULT_SCORING_RUBRIC);
  const ruleDimensions = buildRuleDimensions(input.job, input.user, input.hardFilters ?? {});
  const evidenceDimensions = buildEvidenceDimensions(
    input.evidence,
    input.user.activeResumeId,
    input.user.resumes,
  );
  const dimensions = mergeDimensions(ruleDimensions, evidenceDimensions);
  const weighted = aggregateDimensions(dimensions, rubric.dimensions);
  const hardRejected = dimensions.some((dimension) => dimension.hardFail);
  const overall = hardRejected ? Math.min(weighted, 20) : weighted;
  const resumeBreakdown = computeResumeBreakdown(input.user, input.evidence);

  return {
    overall,
    label: labelForScore(overall),
    dimensions,
    hardRejected,
    rubricVersion: rubric.version,
    scoringVersion: SCORING_VERSION,
    providerId: input.providerId,
    modelId: input.modelId,
    createdAt: new Date().toISOString(),
    resumeBreakdown,
  };
}

/**
 * Phase 4.5 — cross-resume skill coverage.
 *
 * The LLM's Pass B evidence sees only the active resume in its prompt, so its
 * matched/missing/transferable categorisation is biased to that resume. We
 * extract just the *JD-required* skill names (the union of all three lists)
 * and re-check each user resume locally against its `structured.skills` fields.
 *
 * Limitation: we can only re-check against skills the LLM already surfaced. A
 * resume whose strongest skills weren't even mentioned in the JD-skill list
 * won't show as a winner. Acceptable for v1 — future iteration could change
 * the LLM contract to extract JD-skills independent of any resume.
 */
export function computeResumeBreakdown(
  user: UserContext,
  evidence?: ExtractedEvidence,
): ResumeMatchBreakdown | undefined {
  if (!evidence || user.resumes.length === 0) return undefined;

  const jdSkills = collectJdSkills(evidence);
  if (jdSkills.length === 0) return undefined;

  const totalJdSkills = jdSkills.length;
  const perResume: ResumeSkillCoverage[] = user.resumes.map((resume) => {
    const resumeSkillSet = collectResumeSkills(resume);
    const covered: string[] = [];
    const missing: string[] = [];
    for (const skill of jdSkills) {
      if (resumeSkillSet.has(lower(skill))) covered.push(skill);
      else missing.push(skill);
    }
    return {
      resumeId: resume.id,
      resumeLabel: resume.label,
      coveredSkills: covered,
      missingSkills: missing,
      coverageCount: covered.length,
      coverageRatio:
        totalJdSkills > 0 ? Math.round((covered.length / totalJdSkills) * 100) / 100 : 0,
    };
  });

  perResume.sort((a, b) => {
    if (b.coverageCount !== a.coverageCount) return b.coverageCount - a.coverageCount;
    return b.coverageRatio - a.coverageRatio;
  });

  return {
    bestResumeId: perResume[0].resumeId,
    activeResumeId: user.activeResumeId,
    totalJdSkills,
    perResume,
  };
}

function collectJdSkills(evidence: ExtractedEvidence): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sources = [
    ...evidence.matchedSkills,
    ...evidence.missingSkills,
    ...evidence.transferableSkills,
  ];
  for (const item of sources) {
    const skill = item.skill?.trim();
    if (!skill) continue;
    const key = lower(skill);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

export function collectResumeSkills(resume: ResumeProfile): Set<string> {
  const set = new Set<string>();
  const add = (value: string) => {
    const key = lower(value.trim());
    if (key) set.add(key);
  };
  const { skills, projects } = resume.structured;
  skills.hard.forEach(add);
  skills.soft.forEach(add);
  skills.tools.forEach(add);
  skills.languages.forEach(add);
  for (const project of projects) {
    project.tech.forEach(add);
  }
  return set;
}

export function aggregateDimensions(
  dimensions: DimensionScore[],
  rubricDimensions: ScoringRubricDimension[],
): number {
  const dimensionByKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  const eligible = rubricDimensions.filter((rubricDimension) => {
    const dimension = dimensionByKey.get(rubricDimension.key);
    return (
      rubricDimension.enabled && typeof dimension?.score === 'number' && rubricDimension.weight > 0
    );
  });

  const totalWeight = eligible.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (totalWeight <= 0) return 0;

  const weighted = eligible.reduce((sum, rubricDimension) => {
    const dimension = dimensionByKey.get(rubricDimension.key);
    return sum + ((dimension?.score ?? 0) * rubricDimension.weight) / totalWeight;
  }, 0);

  return roundScore(weighted);
}

export function buildRuleDimensions(
  job: Job | JobDetail | JobCardSnapshot,
  user: UserContext,
  hardFilters: HardFilterSettings = {},
): DimensionScore[] {
  const resumeSnapshot = getActiveResumeSnapshot(user);
  return [
    scoreExperience(job, resumeSnapshot, hardFilters.requireExperienceFit),
    scoreLocation(job, user, hardFilters.requireLocationFit),
    scoreCompensation(job, user, hardFilters.requireCompensationFit),
    scoreAvoidKeywords(job, user, hardFilters.rejectAvoidKeywords),
  ];
}

export function buildEvidenceDimensions(
  evidence?: ExtractedEvidence,
  activeResumeId?: string,
  allResumes: ResumeProfile[] = [],
): DimensionScore[] {
  if (!evidence) {
    return [
      unknownDimension('skill', 'Skill match', 'LLM skill evidence has not been extracted yet.'),
      unknownDimension(
        'culture',
        'Culture signal',
        'LLM culture evidence has not been extracted yet.',
      ),
      unknownDimension(
        'growth',
        'Growth potential',
        'LLM growth evidence has not been extracted yet.',
      ),
      unknownDimension('persona', 'Persona fit', 'Persona evidence has not been extracted yet.'),
    ];
  }

  return [
    scoreSkillEvidence(evidence, activeResumeId, allResumes),
    scoreDirectEvidence(
      'culture',
      'Culture signal',
      evidence.cultureScore,
      evidence.cultureSignals,
    ),
    scoreDirectEvidence('growth', 'Growth potential', evidence.growthScore, evidence.growthReasons),
    scoreDirectEvidence(
      'persona',
      'Persona fit',
      evidence.personaScore,
      evidence.personaReasons ?? [],
    ),
  ];
}

export function estimateResumeYears(resume?: ResumeProfile): ActiveResumeSnapshot {
  if (!resume) return { confidence: 'unknown' };

  const periods = resume.structured.experience
    .map((experience) => estimateYearsFromPeriod(experience.period))
    .filter((years): years is number => typeof years === 'number' && Number.isFinite(years));

  if (periods.length === 0) {
    return { resume, confidence: 'unknown' };
  }

  const estimatedYears = periods.reduce((sum, years) => sum + years, 0);
  return {
    resume,
    estimatedYears: Math.round(estimatedYears * 10) / 10,
    confidence: periods.length === resume.structured.experience.length ? 'medium' : 'low',
  };
}

function clampPersonaWeight(rubric: ScoringRubric): ScoringRubric {
  const cappedDimensions = rubric.dimensions.map((dimension) =>
    dimension.key === 'persona'
      ? { ...dimension, weight: Math.min(dimension.weight, rubric.personaWeightCap) }
      : dimension,
  );
  return { ...rubric, dimensions: cappedDimensions };
}

function mergeDimensions(ruleDimensions: DimensionScore[], evidenceDimensions: DimensionScore[]) {
  const merged = new Map<DimensionKey, DimensionScore>();
  [...ruleDimensions, ...evidenceDimensions].forEach((dimension) => {
    merged.set(dimension.key, dimension);
  });
  return [...merged.values()];
}

function getActiveResumeSnapshot(user: UserContext): ActiveResumeSnapshot {
  const activeResume = user.activeResumeId
    ? user.resumes.find((resume) => resume.id === user.activeResumeId)
    : undefined;
  return estimateResumeYears(activeResume);
}

function scoreExperience(
  job: Job | JobDetail | JobCardSnapshot,
  resumeSnapshot: ActiveResumeSnapshot,
  requireExperienceFit = false,
): DimensionScore {
  const text = jobText(job);
  const requiredYears = extractRequiredYears(text);

  if (requiredYears === undefined && !isSeniorityFlagged(text)) {
    return unknownDimension(
      'experience',
      'Experience fit',
      'No explicit seniority or years requirement found.',
    );
  }

  if (requiredYears === undefined && isSeniorityFlagged(text)) {
    // Seniority inferred from a title or snippet alone is weak evidence. Only
    // hard-fail when the resume gives us concrete counter-evidence (estimated
    // years well below a typical seniority floor); otherwise it's a warning so
    // we don't reject senior candidates browsing senior roles.
    const seniorityFloorYears = 3;
    const estimated = resumeSnapshot.estimatedYears;
    const evidenceLines = [
      'Title or snippet contains seniority language without an explicit year count.',
    ];

    if (typeof estimated !== 'number') {
      return {
        key: 'experience',
        label: 'Experience fit',
        score: 35,
        confidence: 'low',
        evidence: evidenceLines,
        warnings: [
          'Seniority is inferred from text and resume years are unknown — treat as a triage warning.',
        ],
        hardFail: false,
      };
    }

    evidenceLines.push(`Estimated resume years: ${estimated}`);
    if (estimated >= seniorityFloorYears) {
      return {
        key: 'experience',
        label: 'Experience fit',
        score: 80,
        confidence: 'medium',
        evidence: evidenceLines,
        warnings: [
          'Seniority is inferred from text; recheck the JD for explicit year requirements.',
        ],
        hardFail: false,
      };
    }

    return {
      key: 'experience',
      label: 'Experience fit',
      score: clampScore(((estimated + 0.5) / seniorityFloorYears) * 100),
      confidence: 'medium',
      evidence: evidenceLines,
      warnings: ['Resume years are below the typical seniority floor for this title.'],
      hardFail: requireExperienceFit,
    };
  }

  if (resumeSnapshot.estimatedYears === undefined) {
    return {
      key: 'experience',
      label: 'Experience fit',
      score: UNKNOWN,
      confidence: 'unknown',
      evidence: [`JD appears to require ${requiredYears} years, but resume years are unknown.`],
      warnings: ['Resume review should confirm total years before treating this as a hard filter.'],
      hardFail: false,
    };
  }

  const score =
    resumeSnapshot.estimatedYears >= requiredYears
      ? 100
      : clampScore(((resumeSnapshot.estimatedYears + 0.5) / requiredYears) * 100);
  const hardFail = requireExperienceFit && score < 50;

  return {
    key: 'experience',
    label: 'Experience fit',
    score,
    confidence: resumeSnapshot.confidence,
    evidence: [
      `JD required years: ${requiredYears}`,
      `Estimated resume years: ${resumeSnapshot.estimatedYears}`,
    ],
    warnings: score < 60 ? ['Experience gap is material and should be marked in UI.'] : [],
    hardFail,
  };
}

function scoreLocation(
  job: Job | JobDetail | JobCardSnapshot,
  user: UserContext,
  requireLocationFit = false,
): DimensionScore {
  const preferredLocations = user.preferences.preferredLocations.filter(Boolean);
  const explicitLocation = firstNonEmpty((job as JobCardSnapshot).locationText);
  const fallbackText = jobText(job);
  const fallbackMentionsPreferredLocation = preferredLocations.some((location) =>
    lower(fallbackText).includes(lower(location)),
  );
  const locationSourceText =
    explicitLocation || (fallbackMentionsPreferredLocation ? fallbackText : '');
  const locationText = lower(locationSourceText);

  if (preferredLocations.length === 0) {
    return unknownDimension('location', 'Location fit', 'User has not set preferred locations.');
  }

  if (!locationText) {
    return unknownDimension('location', 'Location fit', 'JD card/detail has no location text.');
  }

  const matched = preferredLocations.find((location) => locationText.includes(lower(location)));
  if (matched) {
    return {
      key: 'location',
      label: 'Location fit',
      score: 100,
      confidence: 'high',
      evidence: [`JD location matches preferred location: ${matched}`],
      warnings: [],
    };
  }

  return {
    key: 'location',
    label: 'Location fit',
    score: 35,
    confidence: 'medium',
    evidence: [`JD location/source text: ${truncate(locationSourceText)}`],
    warnings: ['Location does not match current preferred locations.'],
    hardFail: requireLocationFit,
  };
}

function scoreCompensation(
  job: Job | JobDetail | JobCardSnapshot,
  user: UserContext,
  requireCompensationFit = false,
): DimensionScore {
  const preferredSalary = user.preferences.salaryRange;
  const salaryText = salarySourceText(job);
  const jdSalary = parseSalaryRange(salaryText);

  if (!preferredSalary) {
    return unknownDimension('compensation', 'Compensation fit', 'User has not set a salary range.');
  }

  if (!jdSalary) {
    return unknownDimension(
      'compensation',
      'Compensation fit',
      'JD has no parseable salary range.',
    );
  }

  const overlap = Math.max(
    0,
    Math.min(jdSalary[1], preferredSalary[1]) - Math.max(jdSalary[0], preferredSalary[0]),
  );
  const userSpan = Math.max(1, preferredSalary[1] - preferredSalary[0]);
  const score = clampScore((overlap / userSpan) * 100);

  return {
    key: 'compensation',
    label: 'Compensation fit',
    score,
    confidence: 'medium',
    evidence: [
      `JD salary range: ${jdSalary[0]}-${jdSalary[1]}`,
      `User range: ${preferredSalary[0]}-${preferredSalary[1]}`,
    ],
    warnings: score < 50 ? ['Salary overlap is low.'] : [],
    hardFail: requireCompensationFit && score < 50,
  };
}

function scoreAvoidKeywords(
  job: Job | JobDetail | JobCardSnapshot,
  user: UserContext,
  rejectAvoidKeywords = false,
): DimensionScore {
  const avoidKeywords = user.preferences.avoidKeywords.filter(Boolean);
  if (avoidKeywords.length === 0) {
    return unknownDimension('avoid_keywords', 'Avoid keywords', 'User has not set avoid keywords.');
  }

  const text = lower(jobText(job));
  const hits = avoidKeywords.filter((keyword) => text.includes(lower(keyword)));

  if (hits.length === 0) {
    return {
      key: 'avoid_keywords',
      label: 'Avoid keywords',
      score: 100,
      confidence: 'high',
      evidence: ['No avoid keywords found.'],
      warnings: [],
    };
  }

  return {
    key: 'avoid_keywords',
    label: 'Avoid keywords',
    score: 0,
    confidence: 'high',
    evidence: hits.map((hit) => `Matched avoid keyword: ${hit}`),
    warnings: ['JD contains user-defined avoid keywords.'],
    hardFail: rejectAvoidKeywords,
  };
}

function scoreSkillEvidence(
  evidence: ExtractedEvidence,
  activeResumeId?: string,
  allResumes: ResumeProfile[] = [],
): DimensionScore {
  const matched = weightedSkillCount(evidence.matchedSkills, 1, activeResumeId, allResumes, true);
  const transferable = weightedSkillCount(
    evidence.transferableSkills,
    0.5,
    activeResumeId,
    allResumes,
    true,
  );
  const matchedDenominator = weightedSkillCount(evidence.matchedSkills, 1);
  const transferableDenominator = weightedSkillCount(evidence.transferableSkills, 0.5);
  const missing = weightedSkillCount(evidence.missingSkills, 1);
  const denominator = matchedDenominator + transferableDenominator + missing;

  if (denominator <= 0) {
    return unknownDimension('skill', 'Skill match', 'LLM returned no skill evidence.');
  }

  const unionPenaltyCount = [
    ...applyUnionWeightPenalty(evidence.matchedSkills, activeResumeId, allResumes),
    ...applyUnionWeightPenalty(evidence.transferableSkills, activeResumeId, allResumes),
  ].filter((multiplier) => multiplier < 1).length;

  const score = clampScore(((matched + transferable) / denominator) * 100);
  return {
    key: 'skill',
    label: 'Skill match',
    score,
    confidence: 'medium',
    evidence: [
      ...formatSkills('Matched', evidence.matchedSkills),
      ...formatSkills('Transferable', evidence.transferableSkills),
      ...formatSkills('Missing', evidence.missingSkills),
    ],
    warnings: [
      ...(evidence.missingSkills.some((skill) => skill.priority === 'must')
        ? ['Missing at least one must-have skill.']
        : []),
      ...(unionPenaltyCount > 0
        ? ['Some matched skills only appear in non-active resumes and were discounted.']
        : []),
    ],
  };
}

function scoreDirectEvidence(
  key: DimensionKey,
  label: string,
  score: number | undefined,
  evidence: string[],
): DimensionScore {
  if (typeof score !== 'number') {
    if (evidence.length > 0) {
      return {
        key,
        label,
        score: 60,
        confidence: 'low',
        evidence,
        warnings: [`${label} score was not returned; using a low-confidence evidence fallback.`],
      };
    }

    return unknownDimension(
      key,
      label,
      `${label} score was not returned by LLM evidence extraction.`,
    );
  }

  return {
    key,
    label,
    score: clampScore(score),
    confidence: evidence.length > 0 ? 'medium' : 'low',
    evidence,
    warnings: score < 50 ? [`${label} is weak.`] : [],
  };
}

function weightedSkillCount(
  skills: SkillEvidence[],
  baseWeight: number,
  activeResumeId?: string,
  allResumes: ResumeProfile[] = [],
  useUnionPenalty = false,
): number {
  const unionMultipliers = useUnionPenalty
    ? applyUnionWeightPenalty(skills, activeResumeId, allResumes)
    : [];

  return skills.reduce((sum, skill, index) => {
    const priorityWeight =
      skill.priority === 'must' ? 1.25 : skill.priority === 'preferred' ? 0.75 : 1;
    return sum + baseWeight * priorityWeight * (unionMultipliers[index] ?? 1);
  }, 0);
}

export function applyUnionWeightPenalty(
  skills: SkillEvidence[],
  activeResumeId?: string,
  allResumes: ResumeProfile[] = [],
): number[] {
  if (!activeResumeId) return skills.map(() => 1);

  const knownResumeIds = new Set(allResumes.map((resume) => resume.id));
  return skills.map((skill) => {
    if (!skill.sourceResumeIds || skill.sourceResumeIds.length === 0) return 1;

    const sourceIds = skill.sourceResumeIds
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && (knownResumeIds.size === 0 || knownResumeIds.has(id)));

    if (sourceIds.length === 0) return 1;
    return sourceIds.includes(activeResumeId) ? 1 : 0.5;
  });
}

function formatSkills(prefix: string, skills: SkillEvidence[]): string[] {
  return skills.map(
    (skill) =>
      `${prefix}: ${skill.skill}${skill.priority === 'unknown' ? '' : ` (${skill.priority})`}`,
  );
}

function unknownDimension(key: DimensionKey, label: string, reason: string): DimensionScore {
  return {
    key,
    label,
    score: UNKNOWN,
    confidence: 'unknown',
    evidence: [reason],
    warnings: [],
  };
}

function labelForScore(score: number): MatchLabel {
  if (score >= 85) return 'strong_fit';
  if (score >= 70) return 'good_fit';
  if (score >= 55) return 'stretch';
  if (score >= 40) return 'investigate';
  return 'low_fit';
}

function extractRequiredYears(text: string): number | undefined {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:年|年以上|年经验)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function isSeniorityFlagged(text: string): boolean {
  return /\b(senior|lead|principal|staff|manager|director|head)\b/i.test(text);
}

function estimateYearsFromPeriod(period: string): number | undefined {
  // Prefer YYYY-MM / YYYY.MM / YYYY/MM patterns so a short stint
  // (e.g. a 3-month internship) isn't rounded up to a full year.
  const monthMatches = [...period.matchAll(/(\d{4})[-./](\d{1,2})(?!\d)/g)]
    .map((match) => ({ year: Number(match[1]), month: Number(match[2]) }))
    .filter((entry) => entry.month >= 1 && entry.month <= 12);

  if (monthMatches.length >= 2) {
    const [start, end] = monthMatches;
    const months = (end.year - start.year) * 12 + (end.month - start.month);
    if (months < 0) return undefined;
    return Math.max(0.1, Math.round((months / 12) * 10) / 10);
  }

  // Year-only fallback (legacy behaviour).
  const years = period.match(/\d{4}/g)?.map(Number) ?? [];
  if (years.length < 1) return undefined;
  const startYear = years[0];
  const endYear = years.length > 1 ? years[1] : new Date().getFullYear();
  if (endYear < startYear) return undefined;
  return Math.max(0.1, endYear - startYear);
}

function parseSalaryRange(text: string): [number, number] | undefined {
  const numbers = [...text.replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)\s*([kKmM万千]?)/g)]
    .map((match) => {
      const base = Number(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'k' || unit === '千') return base * 1000;
      if (unit === 'm') return base * 1000000;
      if (unit === '万') return base * 10000;
      return base;
    })
    .filter((value) => Number.isFinite(value));

  if (!numbers || numbers.length === 0) return undefined;
  if (numbers.length === 1) return [numbers[0], numbers[0]];
  return [Math.min(numbers[0], numbers[1]), Math.max(numbers[0], numbers[1])];
}

function jobText(job: Job | JobDetail | JobCardSnapshot): string {
  return [
    job.title,
    (job as JobCardSnapshot).company,
    (job as JobCardSnapshot).locationText,
    (job as JobCardSnapshot).salaryText,
    (job as JobCardSnapshot).snippet,
    (job as Job).content,
    (job as Job).salaryText,
    (job as Job).salary_text,
    (job as Job).workMode,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n');
}

function salarySourceText(job: Job | JobDetail | JobCardSnapshot): string {
  const explicitSalary = firstNonEmpty(
    (job as JobCardSnapshot).salaryText,
    (job as Job).salaryText,
    (job as Job).salary_text,
  );
  if (explicitSalary) return explicitSalary;

  const text = jobText(job);
  return /\b(salary|compensation|pay|monthly|month|annual|annum|sgd|usd|rmb|rm)\b|\$|薪|工资|月薪|年薪/i.test(
    text,
  )
    ? text
    : '';
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
}

function truncate(text: string, maxLength = 160): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, roundScore(score)));
}

function roundScore(score: number): number {
  return Math.round(score * 10) / 10;
}

function lower(text: string): string {
  return text.toLowerCase();
}
