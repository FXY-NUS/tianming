import type { PersonaPlugin } from '../../PersonaPlugin';
import { HollandForm } from './HollandForm';
import { HOLLAND_DESCRIPTIONS, HollandDataSchema, hollandCode, type HollandData } from './schema';

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
  const note = data.note?.trim();
  if (note) lines.push(`- 用户备注: ${note}`);
  return lines.join('\n');
}

export const hollandPlugin: PersonaPlugin<HollandData> = {
  id: 'holland',
  name: 'Holland 职业兴趣（RIASEC）',
  description: '6 维兴趣模型，输出 3 字母编码（如 IAS）',
  category: 'core',
  schema: HollandDataSchema,
  emptyData: () => ({ primary: 'I' }),
  formComponent: HollandForm,
  promptFragment: hollandPromptFragment,
};
