import { beforeEach, describe, expect, it } from 'vitest';
import { __resetPersonaRegistry } from './registry';
import { listPersonas, registerBuiltInPersonas } from './index';

describe('public personas index', () => {
  beforeEach(() => {
    __resetPersonaRegistry();
  });

  it('registers every built-in persona plugin', () => {
    registerBuiltInPersonas();

    expect(
      listPersonas()
        .map((plugin) => plugin.id)
        .sort(),
    ).toEqual(['big5', 'holland', 'mbti', 'ziwei']);
  });

  it('is idempotent when called more than once', () => {
    registerBuiltInPersonas();
    registerBuiltInPersonas();

    expect(listPersonas()).toHaveLength(4);
  });
});
