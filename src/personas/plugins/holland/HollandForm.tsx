import type { PersonaFormProps } from '../../PersonaPlugin';
import {
  HOLLAND_DESCRIPTIONS,
  HOLLAND_LETTERS,
  type HollandData,
  type HollandLetter,
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

export function HollandForm({ value, onChange }: PersonaFormProps<HollandData>) {
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

  return (
    <div className="space-y-3">
      {renderSelect('primary')}
      {renderSelect('secondary')}
      {renderSelect('tertiary')}
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
