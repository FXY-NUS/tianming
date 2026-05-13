import type { UserContext } from '../../types';
import { getPersona } from './registry';

/**
 * Render every active persona into a Markdown block ready for direct
 * concatenation into a system prompt. Plugins with no instance, no
 * registered plugin, or data that fails schema validation are silently
 * skipped — corrupt persona data must never break a Gemini call.
 */
export function assemblePersonaPrompt(ctx: UserContext): string {
  const fragments: string[] = [];
  for (const personaId of ctx.activePersonaIds) {
    const instance = ctx.personas.find((p) => p.id === personaId);
    if (!instance) continue;
    const plugin = getPersona(instance.type);
    if (!plugin) continue;
    const parsed = plugin.schema.safeParse(instance.data);
    if (!parsed.success) continue;
    fragments.push(plugin.promptFragment(parsed.data));
  }
  return fragments.join('\n\n');
}
