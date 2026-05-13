import type { PersonaFormProps } from '../../PersonaPlugin';
import { MBTI_DESCRIPTIONS, MBTI_TYPES, type MbtiData, type MbtiType } from './schema';

export function MbtiForm({ value, onChange }: PersonaFormProps<MbtiData>) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">MBTI 类型</span>
        <select
          className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-white p-3 text-sm focus:border-indigo-500 focus:outline-none"
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as MbtiType })}
        >
          {MBTI_TYPES.map((t) => (
            <option key={t} value={t}>
              {t} · {MBTI_DESCRIPTIONS[t]}
            </option>
          ))}
        </select>
      </label>
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
