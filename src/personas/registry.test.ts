import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { PersonaCategory, PersonaPlugin } from './PersonaPlugin';
import {
  __resetPersonaRegistry,
  getPersona,
  listPersonas,
  listPersonasByCategory,
  registerPersona,
} from './registry';

const NullForm = () => null;

function makePlugin(
  id: string,
  category: PersonaCategory = 'core',
): PersonaPlugin<{ value: string }> {
  return {
    id,
    name: `Plugin ${id}`,
    description: `Test plugin ${id}`,
    category,
    schema: z.object({ value: z.string() }),
    emptyData: () => ({ value: '' }),
    formComponent: NullForm,
    promptFragment: ({ value }) => value,
  };
}

describe('persona registry', () => {
  beforeEach(() => {
    __resetPersonaRegistry();
  });

  it('starts empty', () => {
    expect(listPersonas()).toEqual([]);
  });

  it('registers and retrieves a plugin', () => {
    const plugin = makePlugin('test-1');
    registerPersona(plugin);
    expect(getPersona('test-1')).toBe(plugin);
  });

  it('returns undefined for an unknown id', () => {
    expect(getPersona('does-not-exist')).toBeUndefined();
  });

  it('rejects duplicate ids', () => {
    registerPersona(makePlugin('dup'));
    expect(() => registerPersona(makePlugin('dup'))).toThrow(/already registered/);
  });

  it('lists every registered plugin', () => {
    registerPersona(makePlugin('a'));
    registerPersona(makePlugin('b'));
    expect(
      listPersonas()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });

  it('filters by category', () => {
    registerPersona(makePlugin('core-1', 'core'));
    registerPersona(makePlugin('core-2', 'core'));
    registerPersona(makePlugin('eso-1', 'esoteric'));

    expect(
      listPersonasByCategory('core')
        .map((p) => p.id)
        .sort(),
    ).toEqual(['core-1', 'core-2']);
    expect(listPersonasByCategory('esoteric').map((p) => p.id)).toEqual(['eso-1']);
  });

  it('__resetPersonaRegistry clears state between tests', () => {
    registerPersona(makePlugin('a'));
    __resetPersonaRegistry();
    expect(listPersonas()).toEqual([]);
  });
});
