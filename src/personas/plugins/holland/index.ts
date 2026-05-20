import type { PersonaPlugin } from '../../PersonaPlugin';
import { HollandForm } from './HollandForm';
import {
  HOLLAND_DESCRIPTIONS,
  HOLLAND_LETTERS,
  HOLLAND_SHORT_LABEL,
  HollandDataSchema,
  hollandCode,
  type HollandData,
  type HollandLetter,
} from './schema';

export type HollandLetterScores = Record<HollandLetter, number>;

const EMPTY_SCORES = (): HollandLetterScores => ({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 });

/**
 * Resolve a HollandData blob to raw-score weights per letter.
 *
 * - If the user supplied scores from a real test (O*NET / SDS / any RIASEC
 *   instrument) with at least one positive value, those are used as-is.
 * - Otherwise we fall back to 3:2:1 raw weights derived from
 *   primary / secondary / tertiary picks. Letters not picked stay at 0.
 *
 * Output is always a complete `Record<HollandLetter, number>` so callers
 * can iterate `HOLLAND_LETTERS` without undefined checks.
 */
export function deriveHollandRawScores(data: HollandData): HollandLetterScores {
  const raw = EMPTY_SCORES();
  let hasUserScores = false;
  if (data.scores) {
    for (const letter of HOLLAND_LETTERS) {
      const v = data.scores[letter];
      if (typeof v === 'number' && v > 0) {
        raw[letter] = v;
        hasUserScores = true;
      }
    }
  }
  if (hasUserScores) return raw;

  if (data.primary) raw[data.primary] = 3;
  if (data.secondary) raw[data.secondary] = 2;
  if (data.tertiary) raw[data.tertiary] = 1;
  return raw;
}

/**
 * Convert raw scores into percentages of the total. Rounded to nearest integer.
 * Sum may drift ±1-2 from 100 due to rounding — acceptable for prompt display.
 */
export function hollandPercentages(raw: HollandLetterScores): HollandLetterScores {
  const total = HOLLAND_LETTERS.reduce((sum, l) => sum + raw[l], 0);
  if (total === 0) return EMPTY_SCORES();
  const pct = EMPTY_SCORES();
  for (const letter of HOLLAND_LETTERS) {
    pct[letter] = Math.round((raw[letter] / total) * 100);
  }
  return pct;
}

/** Did the user supply at least one positive score in their scores blob? */
export function hasUserScores(data: HollandData): boolean {
  if (!data.scores) return false;
  return HOLLAND_LETTERS.some((l) => {
    const v = data.scores?.[l];
    return typeof v === 'number' && v > 0;
  });
}

export function hollandPromptFragment(data: HollandData): string {
  const lines = ['## Holland 职业兴趣类型（RIASEC）'];
  lines.push(`- 主导: **${data.primary}** (${HOLLAND_DESCRIPTIONS[data.primary]})`);
  if (data.secondary) {
    lines.push(`- 次要: ${data.secondary} (${HOLLAND_DESCRIPTIONS[data.secondary]})`);
  }
  if (data.tertiary) {
    lines.push(`- 第三: ${data.tertiary} (${HOLLAND_DESCRIPTIONS[data.tertiary]})`);
  }
  lines.push(`- 综合编码: ${hollandCode(data)}`);

  const raw = deriveHollandRawScores(data);
  const pct = hollandPercentages(raw);
  const userProvided = hasUserScores(data);

  // 6-dim strength line, sorted high-to-low for readability.
  const ranked = [...HOLLAND_LETTERS].sort((a, b) => pct[b] - pct[a]);
  const strengthCells = ranked
    .filter((l) => pct[l] > 0)
    .map((l) => `${l}=${pct[l]}%`)
    .join(' · ');

  if (strengthCells) {
    lines.push(`- 6 维强度（占比）: ${strengthCells}`);
    if (userProvided) {
      const rawCells = ranked
        .filter((l) => raw[l] > 0)
        .map((l) => `${l}=${raw[l]}`)
        .join(' · ');
      lines.push(`  - 原始分: ${rawCells}（来源: 用户提供的 RIASEC 测评分数）`);
    } else {
      lines.push('  - 来源: 按 3:2:1 默认权重从主/次/三映射推断（用户未填完整 6 维量表）');
    }
  }

  const note = data.note?.trim();
  if (note) lines.push(`- 用户备注: ${note}`);
  return lines.join('\n');
}

export const hollandPlugin: PersonaPlugin<HollandData> = {
  id: 'holland',
  name: 'Holland 职业兴趣（RIASEC）',
  description:
    '6 维兴趣模型，3 字母编码（如 IAS）。可选填完整 6 维原始分；未填时按 3:2:1 默认权重映射。',
  category: 'core',
  schema: HollandDataSchema,
  emptyData: () => ({ primary: 'I' }),
  formComponent: HollandForm,
  promptFragment: hollandPromptFragment,
};

export { HOLLAND_SHORT_LABEL };
