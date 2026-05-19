import {
  ZIWEI_MAIN_STARS,
  ZIWEI_STRENGTH,
  ZiweiDataSchema,
  emptyPalace,
  type PalaceKey,
  type ZiweiData,
  type ZiweiMainStar,
  type ZiweiPalace,
  type ZiweiSihua,
  type ZiweiStrength,
} from './schema';

const MAIN_STAR_SET: ReadonlySet<string> = new Set(ZIWEI_MAIN_STARS);
const STRENGTH_SET: ReadonlySet<string> = new Set(ZIWEI_STRENGTH);

// Palaces we have schema slots for (命/官/财/夫 are required, 身 maps to .shen).
const PALACE_NAME_TO_KEY: Record<string, PalaceKey> = {
  命宫: 'ming',
  官禄宫: 'guanlu',
  财帛宫: 'caibo',
  夫妻宫: 'fuqi',
};

// Palaces 文墨天机 emits that we don't model directly; their summary is dumped
// into the global note so audit prompts retain the information.
const NON_SCHEMA_PALACES: readonly string[] = [
  '兄弟宫',
  '子女宫',
  '父母宫',
  '福德宫',
  '田宅宫',
  '疾厄宫',
  '迁移宫',
  '交友宫',
];

const KNOWN_PALACE_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(PALACE_NAME_TO_KEY),
  ...NON_SCHEMA_PALACES,
]);

export type WenmoParseErrorKind =
  | 'empty_input'
  | 'header_not_found'
  | 'no_palaces_found'
  | 'schema_violation';

export interface WenmoParsePreview {
  // Stars+strength rendered for the 4 required + optional 身宫, shown in the UI
  // confirmation panel before the user applies the import.
  schema: Partial<Record<PalaceKey, string>>;
  metadata: string[];
  nonSchemaPalaces: string[];
}

export type WenmoParseResult =
  | { status: 'ok'; data: ZiweiData; warnings: string[]; preview: WenmoParsePreview }
  | { status: 'error'; kind: WenmoParseErrorKind; message: string };

interface ParsedPalace {
  name: string;
  earthlyBranch?: string;
  isShen: boolean;
  mainStars: ZiweiMainStar[];
  mainStarStrengths?: ZiweiStrength[];
  primarySihua: ZiweiSihua;
  // Extras (extra sihua tags, aux/minor stars, neishen, taisuijuilu, dating) → palace note.
  noteExtras: string[];
}

const SIHUA_FROM_BASE: Record<string, ZiweiSihua> = {
  禄: '化禄',
  权: '化权',
  科: '化科',
  忌: '化忌',
};

interface SihuaCandidate {
  priority: number; // lower = preferred (1=生年, 2=向心, 3=离心)
  sihua: ZiweiSihua;
  raw: string; // human-readable trace for the note extras
}

/**
 * Parse a Wenmo Tianji 紫微斗数命盘 export into our ZiweiData shape.
 *
 * Strategy:
 *   1. Locate the file header so we don't accept arbitrary text.
 *   2. Pull metadata (gender / 农历 / 四柱 / 命主 / 身主 / 身宫) into a buffer
 *      that lands in the global note.
 *   3. Slice the 12 palace blocks via the tree-prefix markers Wenmo uses.
 *   4. Per palace, extract main stars + strength + a single primary sihua
 *      with priority 生年 > 向心(↑) > 离心(↓). Everything else (extra sihua,
 *      auxiliary stars, minor stars) goes into the per-palace note.
 *   5. Map 4 known palaces to schema slots; if a palace also carries the
 *      [身宫] tag, mirror it into the optional shen slot.
 *   6. Validate with ZiweiDataSchema before returning so callers never get
 *      malformed data.
 */
export function parseWenmoChart(raw: string): WenmoParseResult {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) {
    return { status: 'error', kind: 'empty_input', message: '粘贴内容为空。' };
  }
  if (!/文墨天机|紫微斗数命盘/.test(text)) {
    return {
      status: 'error',
      kind: 'header_not_found',
      message: '未识别到文墨天机紫微斗数命盘标题。请确认完整粘贴整段导出。',
    };
  }

  const metadata = extractMetadata(text);
  const palaceBlocks = splitPalaceBlocks(text);
  if (palaceBlocks.length === 0) {
    return {
      status: 'error',
      kind: 'no_palaces_found',
      message: '未识别到任何宫位块。',
    };
  }

  const warnings: string[] = [];
  const byName = new Map<string, ParsedPalace>();
  let shenName: string | undefined;
  for (const block of palaceBlocks) {
    const parsed = parsePalaceBlock(block);
    if (!parsed) continue;
    byName.set(parsed.name, parsed);
    if (parsed.isShen) shenName = parsed.name;
  }

  const data: Partial<ZiweiData> = {};
  const previewSchema: Partial<Record<PalaceKey, string>> = {};
  for (const [name, key] of Object.entries(PALACE_NAME_TO_KEY)) {
    const parsed = byName.get(name);
    if (parsed) {
      data[key] = palaceFromParsed(parsed);
      previewSchema[key] = formatPalaceInline(parsed);
    } else {
      warnings.push(`未识别到 ${name}，使用空默认（紫微 + 无）。`);
      data[key] = emptyPalace();
    }
  }

  if (shenName) {
    const shenParsed = byName.get(shenName);
    if (shenParsed) {
      data.shen = palaceFromParsed(shenParsed);
      previewSchema.shen = `${shenName}（${formatPalaceInline(shenParsed)}）`;
    }
  }

  // Global note: metadata + non-schema palace summaries.
  const noteLines: string[] = [];
  if (metadata.length > 0) {
    noteLines.push(...metadata);
  }
  const nonSchemaSummaries: string[] = [];
  for (const name of NON_SCHEMA_PALACES) {
    const parsed = byName.get(name);
    if (parsed) {
      nonSchemaSummaries.push(`${name}：${formatPalaceInline(parsed)}`);
    }
  }
  if (nonSchemaSummaries.length > 0) {
    if (noteLines.length > 0) noteLines.push('');
    noteLines.push('其他宫位：');
    for (const line of nonSchemaSummaries) noteLines.push(`- ${line}`);
  }
  if (noteLines.length > 0) {
    data.note = noteLines.join('\n');
  }

  const result = ZiweiDataSchema.safeParse(data);
  if (!result.success) {
    return {
      status: 'error',
      kind: 'schema_violation',
      message: result.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; '),
    };
  }

  return {
    status: 'ok',
    data: result.data,
    warnings,
    preview: {
      schema: previewSchema,
      metadata,
      nonSchemaPalaces: nonSchemaSummaries,
    },
  };
}

function extractMetadata(text: string): string[] {
  const out: string[] = [];
  const grab = (label: string) => {
    const re = new RegExp(`├\\s*${label}\\s*[:：]\\s*([^\\n]+)`);
    const match = text.match(re);
    if (match) out.push(`${label}：${match[1].trim()}`);
  };
  grab('性别');
  grab('农历时间');
  grab('节气四柱');
  grab('非节气四柱');

  const lifelineMatch = text.match(/[├└]\s*身主[:：]([^;；\n]+)[;；]\s*命主[:：]([^;；\n]+)/);
  if (lifelineMatch) {
    out.push(`命主：${lifelineMatch[2].trim()}；身主：${lifelineMatch[1].trim()}`);
  }
  const anxingMatch = text.match(/├\s*安星码\s*[:：]\s*(\S+)/);
  if (anxingMatch) {
    out.push(`安星码：${anxingMatch[1]}`);
  }
  return out;
}

function splitPalaceBlocks(text: string): string[] {
  // A palace block starts on a line shaped like:
  //   │ ├<name>宫[<branch>]([来因]|[身宫])?
  // The last palace in the tree uses └ instead of ├, and palace names may
  // contain whitespace (e.g. "命  宫"), so we cannot rely on \S+?.
  const headerRegex = /(│?\s*[├└]\s*[^[\n]+?宫\s*\[[^\]]+\](?:\s*\[[^\]]+\])*\s*)/g;
  const slices: string[] = [];
  let lastIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    if (lastIndex >= 0) {
      slices.push(text.slice(lastIndex, match.index));
    }
    lastIndex = match.index;
  }
  if (lastIndex >= 0) slices.push(text.slice(lastIndex));

  return slices.filter((slice) => /主星/.test(slice));
}

function parsePalaceBlock(block: string): ParsedPalace | undefined {
  const headerMatch = block.match(/[├└]\s*([^[\n]+?)宫\s*\[([^\]]+)\]((?:\s*\[[^\]]+\])*)/);
  if (!headerMatch) return undefined;
  const rawName = headerMatch[1].replace(/\s+/g, '') + '宫';
  if (!KNOWN_PALACE_NAMES.has(rawName)) return undefined;
  const earthlyBranch = headerMatch[2].trim();
  const tags = (headerMatch[3] ?? '').match(/\[[^\]]+\]/g) ?? [];
  const isShen = tags.some((t) => /身宫/.test(t));

  const mainStarLine = matchLine(block, '主星');
  if (mainStarLine === undefined) return undefined;

  const aux: string[] = [];
  const auxLine = matchLine(block, '辅星');
  if (auxLine && auxLine.trim() !== '无') aux.push(`辅星：${auxLine.trim()}`);
  const minorLine = matchLine(block, '小星');
  if (minorLine && minorLine.trim() !== '无') aux.push(`小星：${minorLine.trim()}`);

  const parsedStars = parseMainStarsLine(mainStarLine);
  const noteExtras = [...parsedStars.extras, ...aux];

  return {
    name: rawName,
    earthlyBranch,
    isShen,
    mainStars: parsedStars.mainStars,
    mainStarStrengths: parsedStars.mainStarStrengths,
    primarySihua: parsedStars.primarySihua,
    noteExtras,
  };
}

function matchLine(block: string, label: string): string | undefined {
  const re = new RegExp(`├\\s*${label}\\s*[:：]\\s*([^\\n]+)`);
  const match = block.match(re);
  return match ? match[1].trim() : undefined;
}

interface ParsedStarsLine {
  mainStars: ZiweiMainStar[];
  mainStarStrengths?: ZiweiStrength[];
  primarySihua: ZiweiSihua;
  extras: string[];
}

function parseMainStarsLine(line: string): ParsedStarsLine {
  const trimmed = line.trim();
  if (trimmed === '无' || trimmed === '') {
    return { mainStars: ['空宫'], primarySihua: '无', extras: [] };
  }

  const tokens = trimmed.split(/[,，]/);
  const mainStars: ZiweiMainStar[] = [];
  const strengthSlots: (ZiweiStrength | null)[] = [];
  const sihuaCandidates: SihuaCandidate[] = [];
  const extras: string[] = [];

  for (const token of tokens) {
    const trimmedToken = token.trim();
    if (!trimmedToken) continue;
    const parsed = parseStarToken(trimmedToken);
    if (!parsed || !MAIN_STAR_SET.has(parsed.star)) {
      extras.push(`未识别星：${trimmedToken}`);
      continue;
    }
    if (mainStars.length >= 2) {
      // 文墨天机 sometimes lists 3 stars in a palace; we only carry 2 in
      // schema. Surface the rest in extras so the user can copy them.
      extras.push(`额外主星：${trimmedToken}`);
      continue;
    }

    mainStars.push(parsed.star as ZiweiMainStar);
    let starStrength: ZiweiStrength | null = null;
    for (const anno of parsed.annotations) {
      if (starStrength === null && STRENGTH_SET.has(anno)) {
        starStrength = anno as ZiweiStrength;
        continue;
      }
      const sihua = classifySihuaAnnotation(anno, parsed.star);
      if (sihua) {
        sihuaCandidates.push(sihua);
      } else {
        extras.push(`${parsed.star}[${anno}]`);
      }
    }
    strengthSlots.push(starStrength);
  }

  if (mainStars.length === 0) {
    return { mainStars: ['空宫'], primarySihua: '无', extras };
  }

  sihuaCandidates.sort((a, b) => a.priority - b.priority);
  const primary = sihuaCandidates[0];
  const primarySihua: ZiweiSihua = primary?.sihua ?? '无';
  for (const extra of sihuaCandidates.slice(1)) {
    extras.push(extra.raw);
  }

  const allHaveStrength = strengthSlots.every((s) => s !== null);
  const mainStarStrengths = allHaveStrength ? (strengthSlots as ZiweiStrength[]) : undefined;

  return {
    mainStars,
    mainStarStrengths,
    primarySihua,
    extras,
  };
}

function parseStarToken(token: string): { star: string; annotations: string[] } | undefined {
  const bracketStart = token.indexOf('[');
  if (bracketStart === -1) {
    return { star: token.trim(), annotations: [] };
  }
  const star = token.slice(0, bracketStart).trim();
  const annotations: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(token)) !== null) {
    annotations.push(match[1].trim());
  }
  return { star, annotations };
}

function classifySihuaAnnotation(anno: string, starName: string): SihuaCandidate | undefined {
  // 生年X — pinned at birth, takes precedence over self-化.
  const birth = anno.match(/^生年([禄权科忌])$/);
  if (birth) {
    return {
      priority: 1,
      sihua: SIHUA_FROM_BASE[birth[1]]!,
      raw: `${starName}（生年${birth[1]}）`,
    };
  }
  // ↑X — 向心自化 (from 对宫 into this palace).
  const inward = anno.match(/^↑([禄权科忌])$/);
  if (inward) {
    return {
      priority: 2,
      sihua: SIHUA_FROM_BASE[inward[1]]!,
      raw: `${starName}（向心自化${inward[1]}）`,
    };
  }
  // ↓X — 离心自化.
  const outward = anno.match(/^↓([禄权科忌])$/);
  if (outward) {
    return {
      priority: 3,
      sihua: SIHUA_FROM_BASE[outward[1]]!,
      raw: `${starName}（离心自化${outward[1]}）`,
    };
  }
  return undefined;
}

function palaceFromParsed(p: ParsedPalace): ZiweiPalace {
  const palace: ZiweiPalace = {
    mainStars: p.mainStars,
    sihua: p.primarySihua,
  };
  if (p.mainStarStrengths) palace.mainStarStrengths = p.mainStarStrengths;
  if (p.noteExtras.length > 0) palace.note = p.noteExtras.join('；');
  return palace;
}

function formatPalaceInline(p: ParsedPalace): string {
  const stars = p.mainStars
    .map((s, i) => {
      const strength = p.mainStarStrengths?.[i];
      return strength ? `${s}[${strength}]` : s;
    })
    .join(' + ');
  const sihua = p.primarySihua === '无' ? '' : ` ${p.primarySihua}`;
  return `${stars}${sihua}`;
}
