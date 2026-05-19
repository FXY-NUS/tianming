import type { PersonaPlugin } from '../../PersonaPlugin';
import { ZiweiForm } from './ZiweiForm';
import {
  OPPOSING_PALACE_LABEL,
  PALACE_LABEL,
  SCHEMA_PALACE_OPPOSITE,
  ZIWEI_MAIN_STARS,
  ZIWEI_SIHUA,
  ZIWEI_STRENGTH,
  ZiweiDataSchema,
  emptyPalace,
  type OpposingPalaceKey,
  type PalaceKey,
  type ZiweiData,
  type ZiweiMainStar,
  type ZiweiPalace,
  type ZiweiSihua,
  type ZiweiStrength,
} from './schema';

const MAIN_STAR_SET: ReadonlySet<string> = new Set(ZIWEI_MAIN_STARS);
const SIHUA_SET: ReadonlySet<string> = new Set(ZIWEI_SIHUA);
const STRENGTH_SET: ReadonlySet<string> = new Set(ZIWEI_STRENGTH);
const PALACE_KEYS: readonly PalaceKey[] = ['ming', 'guanlu', 'caibo', 'fuqi', 'shen', 'liunian'];
const OPPOSING_PALACE_KEYS: readonly OpposingPalaceKey[] = [
  'qianyi',
  'fude',
  'xiongdi',
  'jiaoyou',
  'fumu',
  'jie',
  'tianzhai',
  'zinv',
];

function formatMainStars(palace: ZiweiPalace): string {
  const stars = palace.mainStars;
  const strengths = palace.mainStarStrengths;
  const showStrength = strengths !== undefined && strengths.length === stars.length;
  return stars.map((star, i) => (showStrength ? `${star}[${strengths![i]}]` : star)).join(' + ');
}

function renderPalace(palace: ZiweiPalace, contextLabel: string): string {
  const stars = formatMainStars(palace);
  const sihua = palace.sihua === '无' ? '' : ` + ${palace.sihua}`;
  const note = palace.note?.trim() ? ` [${palace.note.trim()}]` : '';
  return `- ${contextLabel}：**${stars}**${sihua}${note}`;
}

const CONTEXT_LABEL: Record<PalaceKey, string> = {
  ming: '命宫（三合·人生主轴）',
  guanlu: '官禄宫（本宫·事业核心）',
  caibo: '财帛宫（三合·金钱观）',
  fuqi: '夫妻宫（对宫·合伙互动）',
  shen: '身宫（后天倾向）',
  liunian: '流年宫',
};

function isEmptyPalace(palace: ZiweiPalace): boolean {
  return palace.mainStars.length === 1 && palace.mainStars[0] === '空宫';
}

function renderOpposingForSchemaPalace(schemaKey: PalaceKey, data: ZiweiData): string | undefined {
  const opposingKey = SCHEMA_PALACE_OPPOSITE[schemaKey];
  if (!opposingKey) return undefined;
  const opposing = data.opposingPalaces?.[opposingKey];
  if (!opposing) return undefined;

  const opposingLabel = OPPOSING_PALACE_LABEL[opposingKey];
  const stars = formatMainStars(opposing);
  const sihua = opposing.sihua === '无' ? '' : ` + ${opposing.sihua}`;

  const schemaPalace = data[schemaKey];
  // 紫微"借星"专指空宫向对宫借主星 — encode that fact deterministically so
  // Gemini cannot invent "借同宫副星" type errors.
  if (schemaPalace && isEmptyPalace(schemaPalace)) {
    return `- ${PALACE_LABEL[schemaKey]}空宫 → 借对宫【${opposingLabel}】：**${stars}**${sihua}`;
  }
  return `- ${PALACE_LABEL[schemaKey]}（对宫【${opposingLabel}】）：**${stars}**${sihua}`;
}

export function ziweiPromptFragment(rawData: ZiweiData): string {
  const data = normalizeZiweiData(rawData);
  const lines = ['## 紫微斗数（职业相关核心宫位）', '', '### 三方四正（以官禄宫为本宫）'];
  lines.push(renderPalace(data.guanlu, CONTEXT_LABEL.guanlu));
  lines.push(renderPalace(data.ming, CONTEXT_LABEL.ming));
  lines.push(renderPalace(data.caibo, CONTEXT_LABEL.caibo));
  lines.push(renderPalace(data.fuqi, CONTEXT_LABEL.fuqi));

  // 对宫主星 — completes the 三方四正 picture for 命/财 (whose 对宫 are not in
  // schema slots). Use the precomputed SCHEMA_PALACE_OPPOSITE mapping so the
  // audit prompt sees the structured truth instead of guessing.
  const opposingLines: string[] = [];
  for (const schemaKey of ['ming', 'caibo'] as const) {
    const line = renderOpposingForSchemaPalace(schemaKey, data);
    if (line) opposingLines.push(line);
  }
  if (opposingLines.length > 0) {
    lines.push('', '### 对宫主星（解读"借星"的事实来源）');
    lines.push(...opposingLines);
  }

  if (data.shen || data.liunian) {
    lines.push('', '### 辅助宫位');
    if (data.shen) lines.push(renderPalace(data.shen, CONTEXT_LABEL.shen));
    if (data.liunian) {
      const yearTag = data.liunianYear?.trim() ? `（${data.liunianYear.trim()}）` : '';
      lines.push(renderPalace(data.liunian, `${CONTEXT_LABEL.liunian}${yearTag}`));
    }
  }

  // Remaining 6 非 schema 宫位 (兄弟/交友/父母/疾厄/田宅/子女) — show as
  // ancillary context, not weighted by scoring.
  const ancillaryKeys: OpposingPalaceKey[] = [
    'xiongdi',
    'jiaoyou',
    'fumu',
    'jie',
    'tianzhai',
    'zinv',
  ];
  const ancillaryLines: string[] = [];
  for (const key of ancillaryKeys) {
    const palace = data.opposingPalaces?.[key];
    if (palace) {
      const stars = formatMainStars(palace);
      const sihua = palace.sihua === '无' ? '' : ` + ${palace.sihua}`;
      ancillaryLines.push(`- ${OPPOSING_PALACE_LABEL[key]}：${stars}${sihua}`);
    }
  }
  if (ancillaryLines.length > 0) {
    lines.push('', '### 其他宫位（背景参考，不主导评分）');
    lines.push(...ancillaryLines);
  }

  const note = data.note?.trim();
  if (note) {
    lines.push('', '### 用户备注', note);
  }

  return lines.join('\n');
}

export function emptyZiweiData(): ZiweiData {
  return {
    ming: emptyPalace(),
    guanlu: emptyPalace(),
    caibo: emptyPalace(),
    fuqi: emptyPalace(),
  };
}

/**
 * Convert legacy `{ mainStar: 'X' }` per palace to the canonical
 * `{ mainStars: ['X'] }` shape. Idempotent; safe to call on already-canonical
 * data. Returns emptyZiweiData() if the input is unrecognisable.
 */
export function normalizeZiweiData(raw: unknown): ZiweiData {
  if (!raw || typeof raw !== 'object') return emptyZiweiData();
  const data = raw as Record<string, unknown>;

  const normalized: Record<string, unknown> = {};
  for (const key of PALACE_KEYS) {
    const palace = normalizePalace(data[key]);
    if (palace) normalized[key] = palace;
  }

  if (typeof data.liunianYear === 'string') normalized.liunianYear = data.liunianYear;
  if (typeof data.note === 'string') normalized.note = data.note;

  // opposingPalaces preserved from a structured chart import.
  if (data.opposingPalaces && typeof data.opposingPalaces === 'object') {
    const rawOpposing = data.opposingPalaces as Record<string, unknown>;
    const cleanOpposing: Record<string, ZiweiPalace> = {};
    for (const key of OPPOSING_PALACE_KEYS) {
      const palace = normalizePalace(rawOpposing[key]);
      if (palace) cleanOpposing[key] = palace;
    }
    if (Object.keys(cleanOpposing).length > 0) {
      normalized.opposingPalaces = cleanOpposing;
    }
  }

  // Required palaces must all be present after normalisation; fall back to empty.
  for (const required of ['ming', 'guanlu', 'caibo', 'fuqi'] as const) {
    if (!normalized[required]) normalized[required] = emptyPalace();
  }

  return normalized as ZiweiData;
}

function normalizePalace(raw: unknown): ZiweiPalace | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const palace = raw as Record<string, unknown>;

  const stars = extractMainStars(palace);
  if (stars.length === 0) return undefined;

  const strengths = extractStrengths(palace, stars.length);
  const sihua = SIHUA_SET.has(palace.sihua as string) ? (palace.sihua as ZiweiSihua) : '无';
  const note = typeof palace.note === 'string' ? palace.note : undefined;

  const result: ZiweiPalace = {
    mainStars: stars,
    sihua,
  };
  if (strengths) result.mainStarStrengths = strengths;
  if (note !== undefined) result.note = note;
  return result;
}

function extractMainStars(palace: Record<string, unknown>): ZiweiMainStar[] {
  const stars: ZiweiMainStar[] = [];

  // Canonical: mainStars: ZiweiMainStar[]
  if (Array.isArray(palace.mainStars)) {
    for (const candidate of palace.mainStars) {
      if (typeof candidate === 'string' && MAIN_STAR_SET.has(candidate)) {
        stars.push(candidate as ZiweiMainStar);
      }
      if (stars.length === 2) break;
    }
  }

  // Legacy: mainStar: ZiweiMainStar
  if (
    stars.length === 0 &&
    typeof palace.mainStar === 'string' &&
    MAIN_STAR_SET.has(palace.mainStar)
  ) {
    stars.push(palace.mainStar as ZiweiMainStar);
  }

  return stars;
}

function extractStrengths(
  palace: Record<string, unknown>,
  expectedLength: number,
): ZiweiStrength[] | undefined {
  if (!Array.isArray(palace.mainStarStrengths)) return undefined;
  if (palace.mainStarStrengths.length !== expectedLength) return undefined;
  const all = palace.mainStarStrengths.every(
    (s): s is ZiweiStrength => typeof s === 'string' && STRENGTH_SET.has(s),
  );
  return all ? (palace.mainStarStrengths as ZiweiStrength[]) : undefined;
}

export const ziweiPlugin: PersonaPlugin<ZiweiData> = {
  id: 'ziwei',
  name: '紫微斗数',
  description: '结构化命盘 · 官禄宫 + 三方四正驱动职业匹配',
  category: 'esoteric',
  schema: ZiweiDataSchema,
  emptyData: emptyZiweiData,
  formComponent: ZiweiForm,
  promptFragment: ziweiPromptFragment,
  tokenHint: '~400 tokens / call',
};

// re-export PALACE_LABEL so the Profile section can render palace badges
export { PALACE_LABEL };
