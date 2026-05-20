import { useState } from 'react';
import type { PersonaFormProps } from '../../PersonaPlugin';
import {
  HOLLAND_DESCRIPTIONS,
  HOLLAND_LETTERS,
  HOLLAND_SHORT_LABEL,
  type HollandData,
  type HollandLetter,
  type HollandScores,
} from './schema';

type Slot = 'primary' | 'secondary' | 'tertiary';

const SLOT_LABEL: Record<Slot, string> = {
  primary: '主导类型 *',
  secondary: '次要（可选）',
  tertiary: '第三（可选）',
};

function optionsExcluding(excluded: (HollandLetter | undefined)[]): HollandLetter[] {
  const block = new Set(excluded.filter(Boolean));
  return HOLLAND_LETTERS.filter((l) => !block.has(l));
}

function hasAnyScore(scores?: HollandScores): boolean {
  if (!scores) return false;
  return HOLLAND_LETTERS.some((l) => {
    const v = scores[l];
    return typeof v === 'number' && v > 0;
  });
}

export function HollandForm({ value, onChange }: PersonaFormProps<HollandData>) {
  const [scoresOpen, setScoresOpen] = useState(hasAnyScore(value.scores));

  const renderSelect = (slot: Slot) => {
    const current = value[slot];
    const excludedFromOthers = (['primary', 'secondary', 'tertiary'] as Slot[])
      .filter((s) => s !== slot)
      .map((s) => value[s]);
    const options = optionsExcluding(excludedFromOthers);
    const isOptional = slot !== 'primary';

    return (
      <label key={slot} className="block">
        <span className="text-sm font-semibold text-slate-700">{SLOT_LABEL[slot]}</span>
        <select
          className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-white p-3 text-sm focus:border-indigo-500 focus:outline-none"
          value={current ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            const next = raw === '' ? undefined : (raw as HollandLetter);
            onChange({ ...value, [slot]: next });
          }}
        >
          {isOptional && <option value="">（不填）</option>}
          {options.map((l) => (
            <option key={l} value={l}>
              {l} · {HOLLAND_DESCRIPTIONS[l]}
            </option>
          ))}
          {current && !options.includes(current) && (
            <option key={current} value={current}>
              {current} · {HOLLAND_DESCRIPTIONS[current]}
            </option>
          )}
        </select>
      </label>
    );
  };

  const updateScore = (letter: HollandLetter, raw: string) => {
    const next: HollandScores = { ...(value.scores ?? {}) };
    const trimmed = raw.trim();
    if (trimmed === '') {
      delete next[letter];
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) return;
      next[letter] = Math.floor(n);
    }
    const isEmpty = HOLLAND_LETTERS.every((l) => next[l] === undefined);
    onChange({ ...value, scores: isEmpty ? undefined : next });
  };

  return (
    <div className="space-y-3">
      {renderSelect('primary')}
      {renderSelect('secondary')}
      {renderSelect('tertiary')}

      <details
        open={scoresOpen}
        onToggle={(e) => setScoresOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-xl border-2 border-slate-100 p-3"
      >
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          我有完整 6 维 RIASEC 测评分数（可选）
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          支持 O*NET Interest Profiler / SDS / 任意 RIASEC
          量表的原始分（非负整数）。系统按你填入数字的相对比例计算 6 维强度，不依赖固定 scale。留空
          = 该维度未测。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {HOLLAND_LETTERS.map((letter) => (
            <label key={letter} className="block">
              <span className="text-xs font-semibold text-slate-700">
                {letter} · {HOLLAND_SHORT_LABEL[letter]}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="mt-1 w-full rounded-lg border-2 border-slate-100 p-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="未测"
                value={value.scores?.[letter] ?? ''}
                onChange={(e) => updateScore(letter, e.target.value)}
              />
            </label>
          ))}
        </div>
      </details>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">备注（可选）</span>
        <input
          type="text"
          className="mt-1 w-full rounded-xl border-2 border-slate-100 p-3 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="测试来源 / 时间 / 经验补充…"
          value={value.note ?? ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>
    </div>
  );
}
