import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZiweiForm } from './ZiweiForm';
import { emptyZiweiData } from './index';
import type { ZiweiData, ZiweiMainStar } from './schema';

function renderForm(initial?: Partial<ZiweiData>) {
  const value: ZiweiData = { ...emptyZiweiData(), ...initial };
  const onChange = vi.fn();
  const utils = render(<ZiweiForm value={value} onChange={onChange} />);
  return { ...utils, onChange, value };
}

function getCombobox(label: string) {
  return screen.getByRole('combobox', { name: label }) as HTMLSelectElement;
}

describe('ZiweiForm — 副主星 UI', () => {
  it('shows a "+ 副主星" button for each required palace when no secondary exists', () => {
    renderForm();
    expect(screen.getAllByRole('button', { name: /添加副主星/u }).length).toBe(4);
  });

  it('adds a secondary star with a sensible default when the user clicks "+ 副主星"', () => {
    const { onChange } = renderForm();
    fireEvent.click(screen.getByRole('button', { name: /命宫 添加副主星/u }));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ZiweiData;
    expect(lastCall.ming.mainStars).toHaveLength(2);
    // Primary default is '紫微' from emptyPalace; secondary should not duplicate.
    expect(lastCall.ming.mainStars[0]).toBe('紫微');
    expect(lastCall.ming.mainStars[1]).not.toBe('紫微');
  });

  it('removes the secondary star when the user clicks "× 副主星"', () => {
    const { onChange } = renderForm({
      ming: { mainStars: ['紫微', '破军'], sihua: '无' },
    });
    fireEvent.click(screen.getByRole('button', { name: /命宫 移除副主星/u }));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ZiweiData;
    expect(lastCall.ming.mainStars).toEqual(['紫微']);
  });

  it('excludes the current primary from the secondary star options', () => {
    renderForm({
      ming: { mainStars: ['紫微', '破军'], sihua: '无' },
    });

    const secondarySelect = getCombobox('命宫 副主星选择');
    const optionValues = Array.from(secondarySelect.options).map((o) => o.value);
    expect(optionValues).not.toContain('紫微');
    expect(optionValues).toContain('破军');
  });

  it('drops a colliding secondary star when the primary is changed to match it', () => {
    const { onChange } = renderForm({
      ming: { mainStars: ['紫微', '破军'], sihua: '无' },
    });

    const primary = getCombobox('命宫 主星');
    fireEvent.change(primary, { target: { value: '破军' as ZiweiMainStar } });

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ZiweiData;
    // primary became 破军; the old secondary was 破军 → dropped to avoid duplication.
    expect(lastCall.ming.mainStars).toEqual(['破军']);
  });

  it('clears mainStarStrengths when palette structure changes (add or remove a star)', () => {
    const { onChange } = renderForm({
      ming: {
        mainStars: ['紫微'],
        mainStarStrengths: ['庙'],
        sihua: '无',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /命宫 添加副主星/u }));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ZiweiData;
    // Adding a secondary changes mainStars length → strengths slot count no longer
    // matches → strengths cleared so schema refine still passes.
    expect(lastCall.ming.mainStarStrengths).toBeUndefined();
    expect(lastCall.ming.mainStars).toHaveLength(2);
  });

  it('keeps mainStarStrengths when only the primary star value (not length) changes', () => {
    const { onChange } = renderForm({
      ming: {
        mainStars: ['紫微'],
        mainStarStrengths: ['庙'],
        sihua: '无',
      },
    });

    const primary = getCombobox('命宫 主星');
    fireEvent.change(primary, { target: { value: '天府' as ZiweiMainStar } });

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ZiweiData;
    // Length unchanged → user owns the renamed star + its strength.
    expect(lastCall.ming.mainStarStrengths).toEqual(['庙']);
    expect(lastCall.ming.mainStars).toEqual(['天府']);
  });
});
