import type { PersonaPlugin } from '../../PersonaPlugin';
import { Big5Form } from './Big5Form';
import { BIG5_DIMENSIONS, BIG5_LABELS, Big5DataSchema, big5Band, type Big5Data } from './schema';

export function big5PromptFragment(data: Big5Data): string {
  const lines = ['## Big5 人格维度 (OCEAN)'];
  for (const dim of BIG5_DIMENSIONS) {
    const score = data[dim];
    lines.push(`- ${BIG5_LABELS[dim]}: ${score}/100 (${big5Band(score)})`);
  }
  const note = data.note?.trim();
  if (note) lines.push(`- 用户备注: ${note}`);
  return lines.join('\n');
}

export const big5Plugin: PersonaPlugin<Big5Data> = {
  id: 'big5',
  name: 'Big5 人格维度 (OCEAN)',
  description: '5 个维度的百分位评分，学术界最主流的特质模型',
  category: 'core',
  schema: Big5DataSchema,
  emptyData: () => ({
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    neuroticism: 50,
  }),
  formComponent: Big5Form,
  promptFragment: big5PromptFragment,
};
