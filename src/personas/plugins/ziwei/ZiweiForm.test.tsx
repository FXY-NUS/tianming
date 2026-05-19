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

describe('ZiweiForm — 文墨天机 importer', () => {
  const VALID_CHART = String.raw`文墨天机紫微斗数命盘
├安星码 : C5VUC
├基本信息
│ └身主:天机; 命主:文曲
├命盘十二宫
│ ├命  宫[辛卯][来因]
│ │ ├主星 : 天府[得]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 3~12虚岁
│ │ ├小限 : 5虚岁
│ │ └流年 : 11虚岁
│ ├夫妻宫[辛丑]
│ │ ├主星 : 紫微[庙][↑科],破军[旺]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 103虚岁
│ │ ├小限 : 7虚岁
│ │ └流年 : 9虚岁
│ ├官禄宫[乙未]
│ │ ├主星 : 天相[得]
│ │ ├辅星 : 无
│ │ ├小星 : 无
│ │ ├大限 : 43虚岁
│ │ ├小限 : 1虚岁
│ │ └流年 : 3虚岁
│ └财帛宫[己亥]
│   ├主星 : 无
│   ├辅星 : 无
│   ├小星 : 无
│   ├大限 : 83虚岁
│   ├小限 : 9虚岁
│   └流年 : 7虚岁`;

  it('renders the importer panel as a collapsed details', () => {
    renderForm();
    expect(screen.getByText(/从文墨天机命盘导入/u)).toBeDefined();
    expect(screen.getByRole('button', { name: '解析' })).toBeDefined();
  });

  it('shows an error when parsing fails', () => {
    renderForm();
    const textarea = screen.getByLabelText('文墨天机命盘原文') as HTMLTextAreaElement;
    // Intentionally avoid the strings "文墨天机" / "紫微斗数命盘" so the header
    // check fails first instead of falling through to palace extraction.
    fireEvent.change(textarea, { target: { value: '随便贴一段东西。' } });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));

    expect(screen.getByText(/解析失败/u)).toBeDefined();
    // The error message must mention the failure kind so the user can debug.
    expect(screen.getByText(/未识别到文墨天机紫微斗数命盘标题/u)).toBeDefined();
  });

  it('shows a preview with the 4 required palaces on successful parse', () => {
    const { container } = renderForm();
    const textarea = screen.getByLabelText('文墨天机命盘原文') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: VALID_CHART } });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));

    expect(screen.getByText(/解析成功/u)).toBeDefined();
    // The preview wraps the palace label and the parsed inline in separate
    // nodes, so we compare against the container's full text content.
    const text = container.textContent ?? '';
    expect(text).toContain('命宫');
    expect(text).toContain('天府[得]');
    expect(text).toContain('紫微[庙] + 破军[旺]');
    expect(text).toContain('天相[得]');
    expect(text).toContain('空宫');
    expect(screen.getByRole('button', { name: '应用到表单' })).toBeDefined();
  });

  it('merges parsed data into the form when 应用 is clicked, preserving liunian', () => {
    const { onChange, value } = renderForm({
      liunian: { mainStars: ['天机'], sihua: '化禄' },
      liunianYear: '2026 丙午',
    });
    expect(value.liunian?.mainStars).toEqual(['天机']);

    const textarea = screen.getByLabelText('文墨天机命盘原文') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: VALID_CHART } });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));
    fireEvent.click(screen.getByRole('button', { name: '应用到表单' }));

    const applied = onChange.mock.calls.at(-1)?.[0] as ZiweiData;
    expect(applied.ming.mainStars).toEqual(['天府']);
    expect(applied.fuqi.mainStars).toEqual(['紫微', '破军']);
    expect(applied.caibo.mainStars).toEqual(['空宫']);
    // 流年 fields preserved from existing form state.
    expect(applied.liunian?.mainStars).toEqual(['天机']);
    expect(applied.liunianYear).toBe('2026 丙午');
  });

  it('clears the textarea after a successful apply', () => {
    renderForm();
    const textarea = screen.getByLabelText('文墨天机命盘原文') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: VALID_CHART } });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));
    fireEvent.click(screen.getByRole('button', { name: '应用到表单' }));

    expect(textarea.value).toBe('');
  });
});
