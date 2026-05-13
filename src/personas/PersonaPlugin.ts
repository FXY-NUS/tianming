import type { ComponentType } from 'react';
import type { ZodType } from 'zod';

export type PersonaCategory = 'core' | 'esoteric';

export interface PersonaFormProps<TData> {
  value: TData;
  onChange: (next: TData) => void;
}

/**
 * Contract every persona plugin (MBTI / Holland / Big5 / 紫微 …) implements.
 * Adding a new persona means writing one of these and calling
 * `registerPersona(plugin)` in `src/personas/index.ts` — never modifying
 * App.tsx or the match engine.
 */
export interface PersonaPlugin<TData = unknown> {
  /**
   * Stable, unique slug. Stored on `PersonaInstance.type` and used as the
   * registry key. Must remain backwards-compatible across releases or
   * users lose their data.
   */
  id: string;
  /** Display name shown in UI. */
  name: string;
  /** One-line subtitle shown next to the enable checkbox. */
  description: string;
  /**
   * `core` plugins (MBTI/Holland/Big5) appear in the main Personas list.
   * `esoteric` plugins (紫微) live behind a "显示玄学画像" toggle.
   */
  category: PersonaCategory;
  /** Zod schema for `PersonaInstance.data`. */
  schema: ZodType<TData>;
  /** Factory for the initial blank value when the plugin is first enabled. */
  emptyData: () => TData;
  /** Controlled React form component. */
  formComponent: ComponentType<PersonaFormProps<TData>>;
  /** Renders the plugin data into a Markdown fragment for Gemini system prompts. */
  promptFragment: (data: TData) => string;
  /** Optional UI hint about token cost, e.g. '~400 tokens / call'. */
  tokenHint?: string;
}
