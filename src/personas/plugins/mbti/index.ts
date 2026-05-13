import type { PersonaPlugin } from '../../PersonaPlugin';
import { MbtiForm } from './MbtiForm';
import { MBTI_DESCRIPTIONS, MbtiDataSchema, type MbtiData } from './schema';

export function mbtiPromptFragment(data: MbtiData): string {
  const lines = ['## MBTI 人格类型', `- 类型: **${data.type}** (${MBTI_DESCRIPTIONS[data.type]})`];
  const note = data.note?.trim();
  if (note) lines.push(`- 用户备注: ${note}`);
  return lines.join('\n');
}

export const mbtiPlugin: PersonaPlugin<MbtiData> = {
  id: 'mbti',
  name: 'MBTI 人格类型',
  description: '4 个维度的 16 型人格分类（最常见的入门工具）',
  category: 'core',
  schema: MbtiDataSchema,
  emptyData: () => ({ type: 'INTJ' }),
  formComponent: MbtiForm,
  promptFragment: mbtiPromptFragment,
};
