import { describe, expect, it } from 'vitest';
import { parseSalaryRangeDraft } from './preferenceValidation';

describe('parseSalaryRangeDraft', () => {
  it('keeps lower and upper bounds independent until save-time validation', () => {
    expect(parseSalaryRangeDraft('5000', '20000')).toEqual({
      status: 'ok',
      salaryRange: [5000, 20000],
    });
  });

  it('allows users to clear both bounds', () => {
    expect(parseSalaryRangeDraft('', '')).toEqual({ status: 'ok', salaryRange: undefined });
  });

  it('rejects partial ranges instead of rewriting the other bound', () => {
    expect(parseSalaryRangeDraft('5000', '')).toEqual({
      status: 'error',
      message: 'Please enter both salary bounds, or leave both empty.',
    });
  });

  it('rejects reversed ranges instead of auto-swapping them', () => {
    expect(parseSalaryRangeDraft('20000', '5000')).toEqual({
      status: 'error',
      message: 'Salary lower bound cannot be greater than the upper bound.',
    });
  });
});
