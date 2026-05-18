import type { PersonaPlugin } from './PersonaPlugin';
import { getPersona, listPersonas, listPersonasByCategory, registerPersona } from './registry';
import { big5Plugin } from './plugins/big5';
import { hollandPlugin } from './plugins/holland';
import { mbtiPlugin } from './plugins/mbti';
import { ziweiPlugin } from './plugins/ziwei';

export const BUILT_IN_PERSONAS = [
  mbtiPlugin,
  hollandPlugin,
  big5Plugin,
  ziweiPlugin,
] as const satisfies readonly PersonaPlugin[];

export function registerBuiltInPersonas(): void {
  for (const plugin of BUILT_IN_PERSONAS) {
    if (!getPersona(plugin.id)) {
      registerPersona(plugin);
    }
  }
}

registerBuiltInPersonas();

export { getPersona, listPersonas, listPersonasByCategory };
export type { PersonaCategory, PersonaFormProps, PersonaPlugin } from './PersonaPlugin';
