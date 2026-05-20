import type { PersonaPlugin } from '../../PersonaPlugin';
import { MbtiForm } from './MbtiForm';
import { MBTI_DIMENSION_DESCRIPTION, MbtiDataSchema, mbtiLetters, type MbtiData } from './schema';

export function mbtiPromptFragment(data: MbtiData): string {
  const lines = ['## MBTI 人格类型', `- 类型: **${data.type}**`, '- 维度倾向:'];
  for (const letter of mbtiLetters(data.type)) {
    lines.push(`  - ${MBTI_DIMENSION_DESCRIPTION[letter]}`);
  }
  const note = data.note?.trim();
  if (note) lines.push(`- 用户备注: ${note}`);
  lines.push(
    '',
    '> 注：MBTI 仅作 4 个维度的辅助参考，不构成职业诊断；自行结合岗位实际职责权衡（参考 Pittenger, 1993, "Measuring the MBTI… And Coming Up Short"）。',
  );
  return lines.join('\n');
}

export const mbtiPlugin: PersonaPlugin<MbtiData> = {
  id: 'mbti',
  name: 'MBTI 人格类型',
  description:
    '4 维度人格倾向（E/I · S/N · T/F · J/P）。辅助参考，非职业诊断（Pittenger 1993 critique）。',
  category: 'core',
  schema: MbtiDataSchema,
  emptyData: () => ({ type: 'INTJ' }),
  formComponent: MbtiForm,
  promptFragment: mbtiPromptFragment,
};
