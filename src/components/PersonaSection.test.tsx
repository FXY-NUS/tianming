import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserContext } from '../../types';
import { DEFAULT_USER_CONTEXT } from '../../services/userContextStorage';
import { PersonaSection } from './PersonaSection';

describe('PersonaSection', () => {
  it('creates and activates a persona instance from a registered plugin', () => {
    let nextCtx: UserContext | undefined;

    render(
      <PersonaSection
        ctx={DEFAULT_USER_CONTEXT}
        onChange={(next) => {
          nextCtx = next;
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '添加' })[0]);

    expect(nextCtx?.personas).toHaveLength(1);
    expect(nextCtx?.personas[0].type).toBe('mbti');
    expect(nextCtx?.activePersonaIds).toEqual([nextCtx?.personas[0].id]);
  });
});
