export type SalaryRangeDraftResult =
  | { status: 'ok'; salaryRange?: [number, number] }
  | { status: 'error'; message: string };

export function parseSalaryRangeDraft(minRaw: string, maxRaw: string): SalaryRangeDraftResult {
  const minText = minRaw.trim();
  const maxText = maxRaw.trim();

  if (!minText && !maxText) {
    return { status: 'ok', salaryRange: undefined };
  }

  if (!minText || !maxText) {
    return {
      status: 'error',
      message: 'Please enter both salary bounds, or leave both empty.',
    };
  }

  const min = Number(minText);
  const max = Number(maxText);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
    return {
      status: 'error',
      message: 'Salary bounds must be valid non-negative numbers.',
    };
  }

  if (min > max) {
    return {
      status: 'error',
      message: 'Salary lower bound cannot be greater than the upper bound.',
    };
  }

  return { status: 'ok', salaryRange: [min, max] };
}
