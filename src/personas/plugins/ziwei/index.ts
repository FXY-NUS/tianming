import type { PersonaPlugin } from '../../PersonaPlugin';
import { ZiweiForm } from './ZiweiForm';
import {
  PALACE_LABEL,
  ZiweiDataSchema,
  emptyPalace,
  type PalaceKey,
  type ZiweiData,
  type ZiweiPalace,
} from './schema';

function renderPalace(palace: ZiweiPalace, contextLabel: string): string {
  const sihua = palace.sihua === '无' ? '' : ` + ${palace.sihua}`;
  const note = palace.note?.trim() ? ` [${palace.note.trim()}]` : '';
  return `- ${contextLabel}：**${palace.mainStar}**${sihua}${note}`;
}

const CONTEXT_LABEL: Record<PalaceKey, string> = {
  ming: '命宫（三合·人生主轴）',
  guanlu: '官禄宫（本宫·事业核心）',
  caibo: '财帛宫（三合·金钱观）',
  fuqi: '夫妻宫（对宫·合伙互动）',
  shen: '身宫（后天倾向）',
  liunian: '流年宫',
};

export function ziweiPromptFragment(data: ZiweiData): string {
  const lines = ['## 紫微斗数（职业相关核心宫位）', '', '### 三方四正（以官禄宫为本宫）'];
  lines.push(renderPalace(data.guanlu, CONTEXT_LABEL.guanlu));
  lines.push(renderPalace(data.ming, CONTEXT_LABEL.ming));
  lines.push(renderPalace(data.caibo, CONTEXT_LABEL.caibo));
  lines.push(renderPalace(data.fuqi, CONTEXT_LABEL.fuqi));

  if (data.shen || data.liunian) {
    lines.push('', '### 辅助宫位');
    if (data.shen) lines.push(renderPalace(data.shen, CONTEXT_LABEL.shen));
    if (data.liunian) {
      const yearTag = data.liunianYear?.trim() ? `（${data.liunianYear.trim()}）` : '';
      lines.push(renderPalace(data.liunian, `${CONTEXT_LABEL.liunian}${yearTag}`));
    }
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
