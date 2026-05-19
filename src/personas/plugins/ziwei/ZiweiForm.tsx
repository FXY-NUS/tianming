import type { FC } from 'react';
import type { PersonaFormProps } from '../../PersonaPlugin';
import {
  OPTIONAL_PALACES,
  PALACE_HINT,
  PALACE_LABEL,
  REQUIRED_PALACES,
  ZIWEI_MAIN_STARS,
  ZIWEI_SIHUA,
  emptyPalace,
  type PalaceKey,
  type ZiweiData,
  type ZiweiMainStar,
  type ZiweiPalace,
  type ZiweiSihua,
} from './schema';

interface PalaceRowProps {
  label: string;
  hint: string;
  required?: boolean;
  value: ZiweiPalace;
  onChange: (next: ZiweiPalace) => void;
  onRemove?: () => void;
}

const PalaceRow: FC<PalaceRowProps> = ({ label, hint, required, value, onChange, onRemove }) => {
  const primaryStar = value.mainStars[0];

  const handlePrimaryChange = (next: ZiweiMainStar) => {
    // Commit 2 adds副主星 UI; here we only edit the primary and preserve any
    // existing secondary unless the new primary duplicates it.
    const rest = value.mainStars.slice(1).filter((s) => s !== next);
    onChange({ ...value, mainStars: [next, ...rest] });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </span>
        <span className="flex-1 truncate text-xs text-slate-500">{hint}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-slate-500 hover:text-rose-500"
          >
            移除
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select
          className="rounded-lg border-2 border-white bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none"
          value={primaryStar}
          onChange={(e) => handlePrimaryChange(e.target.value as ZiweiMainStar)}
        >
          {ZIWEI_MAIN_STARS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border-2 border-white bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none"
          value={value.sihua}
          onChange={(e) => onChange({ ...value, sihua: e.target.value as ZiweiSihua })}
        >
          {ZIWEI_SIHUA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {value.mainStars.length > 1 && (
        <div className="mt-2 text-xs text-slate-500">
          副主星：{value.mainStars[1]}（编辑 UI 在下一版加入）
        </div>
      )}
      <input
        type="text"
        className="mt-2 w-full rounded-lg border-2 border-white bg-white p-2 text-xs focus:border-indigo-500 focus:outline-none"
        placeholder="副星 / 备注（如：文曲·科、左辅、自化忌）"
        value={value.note ?? ''}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  );
};

export function ZiweiForm({ value, onChange }: PersonaFormProps<ZiweiData>) {
  const setPalace = (key: PalaceKey, next: ZiweiPalace | undefined) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        紫微斗数 plugin 会在每次匹配时往 Gemini Pro 注入 ~400 token。
        如果你不熟悉自己的星盘，下一版本会加「从文墨天机粘贴导入」按钮。
      </div>

      {REQUIRED_PALACES.map((key) => (
        <PalaceRow
          key={key}
          label={PALACE_LABEL[key]}
          hint={PALACE_HINT[key]}
          required
          value={value[key]}
          onChange={(next) => setPalace(key, next)}
        />
      ))}

      {OPTIONAL_PALACES.map((key) =>
        value[key] ? (
          <PalaceRow
            key={key}
            label={PALACE_LABEL[key]}
            hint={PALACE_HINT[key]}
            value={value[key]!}
            onChange={(next) => setPalace(key, next)}
            onRemove={() => setPalace(key, undefined)}
          />
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => setPalace(key, emptyPalace())}
            className="block w-full rounded-xl border-2 border-dashed border-slate-200 p-3 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
          >
            + 添加 {PALACE_LABEL[key]}（{PALACE_HINT[key]}）
          </button>
        ),
      )}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">流年年份（可选）</span>
        <input
          type="text"
          className="mt-1 w-full rounded-xl border-2 border-slate-100 p-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="如：2026 丙午"
          value={value.liunianYear ?? ''}
          onChange={(e) => onChange({ ...value, liunianYear: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">全局备注（可选）</span>
        <textarea
          className="mt-1 h-20 w-full rounded-xl border-2 border-slate-100 p-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="排盘门派、用神、迷思、特殊格局…"
          value={value.note ?? ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>
    </div>
  );
}
