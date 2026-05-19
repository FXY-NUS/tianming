import { describe, expect, it } from 'vitest';
import { parseWenmoChart } from './parseWenmo';

// Real Wenmo Tianji export, lightly trimmed (one chart that contains all the
// interesting cases: 双主星, 多 sihua per star, 空宫 财帛, 身宫 marker, 来因 marker).
const SAMPLE_CHART = String.raw`你现在是资深的国学易经术数领域专家，请详细分析下面这个文墨天机紫微斗数命盘

文墨天机紫微斗数命盘
│
├API 版本 : 1.0.0
├App版本 : 2.0.15
├安星码 : C5VUC
├符号定义 : (↓:离心自化), (↑:向心自化，从对宫化入)
│
├基本信息
│ │
│ ├性别 : 女
│ ├农历时间 : 辛巳年三月初二日丑时
│ ├节气四柱 : 辛巳 辛卯 戊子 癸丑
│ ├非节气四柱 : 辛巳 壬辰 戊子 癸丑
│ └身主:天机; 命主:文曲; 子年斗君:亥; 身宫:巳
│
├命盘十二宫
│ │
│ ├子女宫[庚子]
│ │ ├主星 : 天机[庙]
│ │ ├辅星 : 地劫[陷]
│ │ ├小星 : 龙德
│ │ ├大限 : 93~102虚岁
│ │ ├小限 : 8,20,32,44,56虚岁
│ │ └流年 : 8,20,32,44,56虚岁
│ │
│ ├夫妻宫[辛丑]
│ │ ├主星 : 紫微[庙][↑科],破军[旺]
│ │ ├辅星 : 无
│ │ ├小星 : 天哭[庙],华盖[陷]
│ │ ├大限 : 103~112虚岁
│ │ ├小限 : 7,19,31,43,55虚岁
│ │ └流年 : 9,21,33,45,57虚岁
│ │
│ ├兄弟宫[庚寅]
│ │ ├主星 : 无
│ │ ├辅星 : 天魁
│ │ ├小星 : 天巫,劫煞,天德[平]
│ │ ├大限 : 113~122虚岁
│ │ ├小限 : 6,18,30,42,54虚岁
│ │ └流年 : 10,22,34,46,58虚岁
│ │
│ ├命  宫[辛卯][来因]
│ │ ├主星 : 天府[得]
│ │ ├辅星 : 无
│ │ ├小星 : 天姚[庙],封诰
│ │ ├大限 : 3~12虚岁
│ │ ├小限 : 5,17,29,41,53虚岁
│ │ └流年 : 11,23,35,47,59虚岁
│ │
│ ├父母宫[壬辰]
│ │ ├主星 : 太阴[陷][↑权]
│ │ ├辅星 : 火星[陷]
│ │ ├小星 : 天喜[陷],天月,截空[陷],寡宿[陷]
│ │ ├大限 : 13~22虚岁
│ │ ├小限 : 4,16,28,40,52虚岁
│ │ └流年 : 12,24,36,48,60虚岁
│ │
│ ├福德宫[癸巳][身宫]
│ │ ├主星 : 廉贞[陷],贪狼[陷][↓忌][↑权]
│ │ ├辅星 : 文曲[庙][生年科][↑忌]
│ │ ├小星 : 天贵[平],凤阁[庙],天福[旺],截空[庙],年解[旺]
│ │ ├大限 : 23~32虚岁
│ │ ├小限 : 3,15,27,39,51虚岁
│ │ └流年 : 1,13,25,37,49虚岁
│ │
│ ├田宅宫[甲午]
│ │ ├主星 : 巨门[旺][生年禄]
│ │ ├辅星 : 左辅[旺],天钺
│ │ ├小星 : 天厨,天空[庙],咸池[陷]
│ │ ├大限 : 33~42虚岁
│ │ ├小限 : 2,14,26,38,50虚岁
│ │ └流年 : 2,14,26,38,50虚岁
│ │
│ ├官禄宫[乙未]
│ │ ├主星 : 天相[得]
│ │ ├辅星 : 无
│ │ ├小星 : 三台[庙],八座[平],台辅,蜚廉
│ │ ├大限 : 43~52虚岁
│ │ ├小限 : 1,13,25,37,49虚岁
│ │ └流年 : 3,15,27,39,51虚岁
│ │
│ ├交友宫[丙申]
│ │ ├主星 : 天同[旺][↓禄][↑忌],天梁[陷]
│ │ ├辅星 : 右弼[不],陀罗[陷]
│ │ ├小星 : 天才[庙],天伤[平],旬空[庙],孤辰[平]
│ │ ├大限 : 53~62虚岁
│ │ ├小限 : 12,24,36,48,60虚岁
│ │ └流年 : 4,16,28,40,52虚岁
│ │
│ ├迁移宫[丁酉]
│ │ ├主星 : 武曲[利],七杀[旺]
│ │ ├辅星 : 文昌[庙][生年忌][↑忌],禄存[庙]
│ │ ├小星 : 恩光[陷],龙池[庙],天官[平],旬空[庙],破碎[平]
│ │ ├大限 : 63~72虚岁
│ │ ├小限 : 11,23,35,47,59虚岁
│ │ └流年 : 5,17,29,41,53虚岁
│ │
│ ├疾厄宫[戊戌]
│ │ ├主星 : 太阳[不][生年权]
│ │ ├辅星 : 擎羊[庙],地空[陷]
│ │ ├小星 : 红鸾[陷],天寿[庙],天使[陷],解神[庙],阴煞,大耗[平],月德
│ │ ├大限 : 73~82虚岁
│ │ ├小限 : 10,22,34,46,58虚岁
│ │ └流年 : 6,18,30,42,54虚岁
│ │
│ └财帛宫[己亥]
│ │ ├主星 : 无
│ │ ├辅星 : 铃星[利],天马[平]
│ │ ├小星 : 天刑[陷],天虚[平]
│ │ ├大限 : 83~92虚岁
│ │ ├小限 : 9,21,33,45,57虚岁
│ └ └流年 : 7,19,31,43,55虚岁
│
└[备注: 无]`;

describe('parseWenmoChart — error cases', () => {
  it('rejects empty input', () => {
    const result = parseWenmoChart('');
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.kind).toBe('empty_input');
  });

  it('rejects whitespace-only input', () => {
    const result = parseWenmoChart('   \n\n   ');
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.kind).toBe('empty_input');
  });

  it('rejects input without the Wenmo header', () => {
    const result = parseWenmoChart('随便一段文字，跟紫微斗数没关系。');
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.kind).toBe('header_not_found');
  });
});

describe('parseWenmoChart — golden chart', () => {
  const result = parseWenmoChart(SAMPLE_CHART);

  it('parses successfully', () => {
    expect(result.status).toBe('ok');
  });

  it('populates the 4 required palaces', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.data.ming.mainStars).toEqual(['天府']);
    expect(result.data.ming.mainStarStrengths).toEqual(['得']);
    expect(result.data.guanlu.mainStars).toEqual(['天相']);
    expect(result.data.guanlu.mainStarStrengths).toEqual(['得']);
    expect(result.data.fuqi.mainStars).toEqual(['紫微', '破军']);
    expect(result.data.fuqi.mainStarStrengths).toEqual(['庙', '旺']);
  });

  it('treats 财帛宫 (主星: 无) as 空宫', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.data.caibo.mainStars).toEqual(['空宫']);
    expect(result.data.caibo.sihua).toBe('无');
  });

  it('picks the per-palace sihua using priority 生年 > ↑ > ↓', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    // 紫微[↑科], 破军[] → palace primarySihua = 化科 (only sihua present)
    expect(result.data.fuqi.sihua).toBe('化科');
    // 天府[得] only → no sihua
    expect(result.data.ming.sihua).toBe('无');
  });

  it('captures the 身宫 palace into the optional .shen slot', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.data.shen).toBeDefined();
    // 福德宫 is marked [身宫]; its content is 廉贞[陷],贪狼[陷][↓忌][↑权].
    expect(result.data.shen?.mainStars).toEqual(['廉贞', '贪狼']);
    expect(result.data.shen?.mainStarStrengths).toEqual(['陷', '陷']);
    // 贪狼 has both ↓忌 (priority 3) and ↑权 (priority 2) → primary 化权.
    expect(result.data.shen?.sihua).toBe('化权');
    // ↓忌 is the loser, surfaces in note.
    expect(result.data.shen?.note ?? '').toMatch(/贪狼/);
    expect(result.data.shen?.note ?? '').toMatch(/离心自化忌/);
  });

  it('handles palace names that contain inner whitespace (命  宫)', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.data.ming.mainStars).toEqual(['天府']);
  });

  it('emits a global note containing metadata and non-schema palaces', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    const note = result.data.note ?? '';
    expect(note).toMatch(/性别：女/);
    expect(note).toMatch(/农历时间：辛巳年三月初二日丑时/);
    expect(note).toMatch(/命主：文曲/);
    expect(note).toMatch(/身主：天机/);
    expect(note).toMatch(/安星码：C5VUC/);
    expect(note).toMatch(/其他宫位：/);
    // Non-schema palace summaries should appear.
    expect(note).toMatch(/兄弟宫/);
    expect(note).toMatch(/福德宫/);
    expect(note).toMatch(/疾厄宫/);
  });

  it('exposes a preview that callers can render before applying', () => {
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.preview.schema.ming).toMatch(/天府\[得\]/);
    expect(result.preview.schema.fuqi).toMatch(/紫微\[庙\] \+ 破军\[旺\]/);
    expect(result.preview.metadata.some((m) => m.includes('命主'))).toBe(true);
    expect(result.preview.nonSchemaPalaces.length).toBeGreaterThan(0);
  });
});

describe('parseWenmoChart — palace-level edge cases', () => {
  it('prefers 生年 sihua over ↑ and ↓', () => {
    const chart = String.raw`文墨天机紫微斗数命盘
│
├命盘十二宫
│ ├命宫[甲子][来因]
│ │ ├主星 : 太阳[庙][生年禄][↑权][↓忌]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 1~10虚岁
│ │ ├小限 : 1虚岁
│ │ └流年 : 1虚岁
│ ├官禄宫[乙丑]
│ │ ├主星 : 太阴[陷]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 11~20虚岁
│ │ ├小限 : 2虚岁
│ │ └流年 : 2虚岁
│ ├财帛宫[丙寅]
│ │ ├主星 : 武曲[利]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 21~30虚岁
│ │ ├小限 : 3虚岁
│ │ └流年 : 3虚岁
│ └夫妻宫[丁卯]
│   ├主星 : 天府[得]
│   ├辅星 : 无
│   ├小星 : 无
│   ├大限 : 31~40虚岁
│   ├小限 : 4虚岁
│   └流年 : 4虚岁`;
    const result = parseWenmoChart(chart);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.ming.sihua).toBe('化禄'); // 生年禄 wins
    // The two losing sihua surface in note for traceability.
    expect(result.data.ming.note ?? '').toMatch(/向心自化权/);
    expect(result.data.ming.note ?? '').toMatch(/离心自化忌/);
  });

  it('falls back to 平 strength absence by leaving mainStarStrengths undefined', () => {
    // A palace where the main star has NO strength bracket → no strengths set.
    const chart = String.raw`文墨天机紫微斗数命盘
│
├命盘十二宫
│ ├命宫[甲子]
│ │ ├主星 : 天府
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 1~10虚岁
│ │ ├小限 : 1虚岁
│ │ └流年 : 1虚岁
│ ├官禄宫[乙丑]
│ │ ├主星 : 太阴[陷]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 11~20虚岁
│ │ ├小限 : 2虚岁
│ │ └流年 : 2虚岁
│ ├财帛宫[丙寅]
│ │ ├主星 : 武曲[利]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 21~30虚岁
│ │ ├小限 : 3虚岁
│ │ └流年 : 3虚岁
│ └夫妻宫[丁卯]
│   ├主星 : 紫微[庙]
│   ├辅星 : 无
│   ├小星 : 无
│   ├大限 : 31~40虚岁
│   ├小限 : 4虚岁
│   └流年 : 4虚岁`;
    const result = parseWenmoChart(chart);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    // 命宫 has 天府 with no strength → strengths array dropped (schema invariant).
    expect(result.data.ming.mainStarStrengths).toBeUndefined();
    // 官禄宫 has 太阴[陷] → strengths kept.
    expect(result.data.guanlu.mainStarStrengths).toEqual(['陷']);
  });

  it('normalises whitespace inside star names ("天   相" → "天相")', () => {
    const chart = String.raw`文墨天机紫微斗数命盘
│
├命盘十二宫
│ ├命宫[甲子][来因]
│ │ ├主星 : 天府[得]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 1~10虚岁
│ │ ├小限 : 1虚岁
│ │ └流年 : 1虚岁
│ ├官禄宫[乙丑]
│ │ ├主星 : 天   相[得]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 11~20虚岁
│ │ ├小限 : 2虚岁
│ │ └流年 : 2虚岁
│ ├财帛宫[丙寅]
│ │ ├主星 : 武曲[利]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 21~30虚岁
│ │ ├小限 : 3虚岁
│ │ └流年 : 3虚岁
│ └夫妻宫[丁卯]
│   ├主星 : 紫 微[庙], 破  军[旺]
│   ├辅星 : 无
│   ├小星 : 无
│   ├大限 : 31~40虚岁
│   ├小限 : 4虚岁
│   └流年 : 4虚岁`;
    const result = parseWenmoChart(chart);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    // Single-star palace: "天   相" recovers as 天相, not 空宫.
    expect(result.data.guanlu.mainStars).toEqual(['天相']);
    expect(result.data.guanlu.mainStarStrengths).toEqual(['得']);
    // Double-star palace: both stars with internal whitespace normalise.
    expect(result.data.fuqi.mainStars).toEqual(['紫微', '破军']);
    expect(result.data.fuqi.mainStarStrengths).toEqual(['庙', '旺']);
  });

  it('emits warnings when a required palace is missing in the source', () => {
    // No 官禄宫 in this stripped chart.
    const chart = String.raw`文墨天机紫微斗数命盘
│
├命盘十二宫
│ ├命宫[甲子]
│ │ ├主星 : 天府[得]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 1~10虚岁
│ │ ├小限 : 1虚岁
│ │ └流年 : 1虚岁
│ ├财帛宫[丙寅]
│ │ ├主星 : 武曲[利]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 21~30虚岁
│ │ ├小限 : 3虚岁
│ │ └流年 : 3虚岁
│ └夫妻宫[丁卯]
│   ├主星 : 紫微[庙]
│   ├辅星 : 无
│   ├小星 : 无
│   ├大限 : 31~40虚岁
│   ├小限 : 4虚岁
│   └流年 : 4虚岁`;
    const result = parseWenmoChart(chart);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.warnings.some((w) => w.includes('官禄宫'))).toBe(true);
  });
});
