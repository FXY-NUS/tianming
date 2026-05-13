import {
  ZIWEI_MAIN_STARS,
  type ZiweiData,
  type ZiweiMainStar,
  type ZiweiPalace,
  type ZiweiSihua,
} from './schema';

export type Gender = '男' | '女';
export type CalendarType = 'solar' | 'lunar';

export interface ComputeChartInput {
  /** YYYY-MM-DD */
  date: string;
  /** 0..11 = 子..亥 时辰 */
  hourIndex: number;
  gender: Gender;
  calendar: CalendarType;
  isLeapMonth?: boolean;
}

const KNOWN_MAIN_STARS = new Set<string>(ZIWEI_MAIN_STARS);

const SIHUA_MAP: Record<string, ZiweiSihua> = {
  禄: '化禄',
  权: '化权',
  科: '化科',
  忌: '化忌',
};

interface IztroStar {
  name: string;
  mutagen?: string;
}

interface IztroPalace {
  name: string;
  isBodyPalace: boolean;
  majorStars: IztroStar[];
}

function mapSihua(raw: string | undefined): ZiweiSihua {
  if (!raw) return '无';
  return SIHUA_MAP[raw] ?? '无';
}

export function adaptIztroPalace(palace: IztroPalace): ZiweiPalace {
  const mainStars = palace.majorStars.filter((s) => KNOWN_MAIN_STARS.has(s.name));
  if (mainStars.length === 0) {
    return { mainStar: '空宫', sihua: '无' };
  }
  const [first, ...rest] = mainStars;
  const sihua = mapSihua(first.mutagen);
  const note = rest.length
    ? rest
        .map((s) => {
          const sh = mapSihua(s.mutagen);
          return sh === '无' ? s.name : `${s.name}·${sh}`;
        })
        .join('、')
    : undefined;
  return {
    mainStar: first.name as ZiweiMainStar,
    sihua,
    ...(note ? { note } : {}),
  };
}

/**
 * Compute the 4 required + 身宫 palaces from a birth chart. Lazy-loads
 * iztro so its ~200 KB only ships when the user actually clicks
 * "自动排盘".
 */
export async function computeZiweiChart(
  input: ComputeChartInput,
): Promise<Pick<ZiweiData, 'ming' | 'guanlu' | 'caibo' | 'fuqi' | 'shen'>> {
  const { astro } = await import('iztro');
  const astrolabe =
    input.calendar === 'lunar'
      ? astro.byLunar(
          input.date,
          input.hourIndex,
          input.gender,
          input.isLeapMonth ?? false,
          true,
          'zh-CN',
        )
      : astro.bySolar(input.date, input.hourIndex, input.gender, true, 'zh-CN');

  const palaces = astrolabe.palaces as IztroPalace[];
  const byName = new Map(palaces.map((p) => [p.name, p]));

  const ming = byName.get('命宫');
  const guanlu = byName.get('官禄');
  const caibo = byName.get('财帛');
  const fuqi = byName.get('夫妻');
  const shen = palaces.find((p) => p.isBodyPalace && p.name !== '命宫');

  if (!ming || !guanlu || !caibo || !fuqi) {
    throw new Error('iztro did not return all required palaces');
  }

  return {
    ming: adaptIztroPalace(ming),
    guanlu: adaptIztroPalace(guanlu),
    caibo: adaptIztroPalace(caibo),
    fuqi: adaptIztroPalace(fuqi),
    ...(shen ? { shen: adaptIztroPalace(shen) } : {}),
  };
}

export const TIME_SLOT_LABELS: readonly string[] = [
  '子时 (23:00 - 01:00)',
  '丑时 (01:00 - 03:00)',
  '寅时 (03:00 - 05:00)',
  '卯时 (05:00 - 07:00)',
  '辰时 (07:00 - 09:00)',
  '巳时 (09:00 - 11:00)',
  '午时 (11:00 - 13:00)',
  '未时 (13:00 - 15:00)',
  '申时 (15:00 - 17:00)',
  '酉时 (17:00 - 19:00)',
  '戌时 (19:00 - 21:00)',
  '亥时 (21:00 - 23:00)',
];
