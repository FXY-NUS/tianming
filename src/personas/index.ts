import { big5Plugin } from './plugins/big5';
import { hollandPlugin } from './plugins/holland';
import { mbtiPlugin } from './plugins/mbti';
import { ziweiPlugin } from './plugins/ziwei';
import { getPersona, registerPersona } from './registry';

const BUILT_IN = [mbtiPlugin, hollandPlugin, big5Plugin, ziweiPlugin];

export function bootstrapPersonas(): void {
  for (const plugin of BUILT_IN) {
    if (!getPersona(plugin.id)) {
      registerPersona(plugin);
    }
  }
}

bootstrapPersonas();
