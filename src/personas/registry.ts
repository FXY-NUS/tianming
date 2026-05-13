import type { PersonaCategory, PersonaPlugin } from './PersonaPlugin';

const plugins = new Map<string, PersonaPlugin>();

export function registerPersona(plugin: PersonaPlugin): void {
  if (plugins.has(plugin.id)) {
    throw new Error(`Persona plugin '${plugin.id}' is already registered`);
  }
  plugins.set(plugin.id, plugin);
}

export function getPersona(id: string): PersonaPlugin | undefined {
  return plugins.get(id);
}

export function listPersonas(): PersonaPlugin[] {
  return [...plugins.values()];
}

export function listPersonasByCategory(category: PersonaCategory): PersonaPlugin[] {
  return listPersonas().filter((p) => p.category === category);
}

/** Test-only helper. Not re-exported from the public personas index. */
export function __resetPersonaRegistry(): void {
  plugins.clear();
}
