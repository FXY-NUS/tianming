import type { PersonaFormProps } from '../../PersonaPlugin';
import {
  BIG5_DIMENSIONS,
  BIG5_HINTS,
  BIG5_LABELS,
  type Big5Data,
  type Big5Dimension,
} from './schema';

export function Big5Form({ value, onChange }: PersonaFormProps<Big5Data>) {
  const update = (dim: Big5Dimension, next: number) => onChange({ ...value, [dim]: next });

  return (
    <div className="space-y-4">
      {BIG5_DIMENSIONS.map((dim) => (
        <div key={dim}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-700">{BIG5_LABELS[dim]}</span>
            <span className="text-sm font-bold tabular-nums text-indigo-600">{value[dim]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value[dim]}
            onChange={(e) => update(dim, Number(e.target.value))}
            className="mt-1 w-full accent-indigo-600"
          />
          <div className="text-xs text-slate-500">{BIG5_HINTS[dim]}</div>
        </div>
      ))}
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">备注（可选）</span>
        <input
          type="text"
          className="mt-1 w-full rounded-xl border-2 border-slate-100 p-3 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="测试来源 / 时间 / 自我修正…"
          value={value.note ?? ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>
    </div>
  );
}
