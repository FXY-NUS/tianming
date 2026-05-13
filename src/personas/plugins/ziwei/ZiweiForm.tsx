import { useState, type FC } from 'react';
import type { PersonaFormProps } from '../../PersonaPlugin';
import { TIME_SLOT_LABELS, computeZiweiChart, type CalendarType, type Gender } from './iztro';
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
  type ZiweiPalace,
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
          value={value.mainStar}
          onChange={(e) =>
            onChange({ ...value, mainStar: e.target.value as ZiweiPalace['mainStar'] })
          }
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
          onChange={(e) => onChange({ ...value, sihua: e.target.value as ZiweiPalace['sihua'] })}
        >
          {ZIWEI_SIHUA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
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

  const [autoOpen, setAutoOpen] = useState(false);
  const [calendar, setCalendar] = useState<CalendarType>('solar');
  const [birthDate, setBirthDate] = useState('');
  const [hourIndex, setHourIndex] = useState(0);
  const [gender, setGender] = useState<Gender>('女');
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const runAutoChart = async () => {
    if (!birthDate) {
      setChartError('请先填生日');
      return;
    }
    setIsComputing(true);
    setChartError(null);
    try {
      const result = await computeZiweiChart({
        date: birthDate,
        hourIndex,
        gender,
        calendar,
        isLeapMonth: calendar === 'lunar' ? isLeapMonth : undefined,
      });
      onChange({ ...value, ...result });
    } catch (e) {
      setChartError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        紫微斗数 plugin 会在每次匹配时往 Gemini Pro 注入 ~400 token。
      </div>

      <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50/40">
        <button
          type="button"
          onClick={() => setAutoOpen((o) => !o)}
          className="flex w-full items-center justify-between p-3 text-sm font-semibold text-indigo-700"
        >
          <span>🌟 自动排盘（不懂紫微？填生日即可）</span>
          <span className="text-xs">{autoOpen ? '收起 ▲' : '展开 ▼'}</span>
        </button>
        {autoOpen && (
          <div className="space-y-2 px-3 pb-3 text-sm">
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="ziwei-cal"
                  checked={calendar === 'solar'}
                  onChange={() => setCalendar('solar')}
                />
                公历
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="ziwei-cal"
                  checked={calendar === 'lunar'}
                  onChange={() => setCalendar('lunar')}
                />
                农历
              </label>
              {calendar === 'lunar' && (
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={isLeapMonth}
                    onChange={(e) => setIsLeapMonth(e.target.checked)}
                  />
                  闰月
                </label>
              )}
            </div>
            <input
              type="date"
              className="w-full rounded-lg border-2 border-white bg-white p-2 text-sm"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <select
              className="w-full rounded-lg border-2 border-white bg-white p-2 text-sm"
              value={hourIndex}
              onChange={(e) => setHourIndex(Number(e.target.value))}
            >
              {TIME_SLOT_LABELS.map((label, i) => (
                <option key={i} value={i}>
                  {label}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="ziwei-gender"
                  checked={gender === '女'}
                  onChange={() => setGender('女')}
                />
                女
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="ziwei-gender"
                  checked={gender === '男'}
                  onChange={() => setGender('男')}
                />
                男
              </label>
            </div>
            <button
              type="button"
              onClick={runAutoChart}
              disabled={isComputing}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {isComputing ? '排盘中…' : '计算并填入下方宫位'}
            </button>
            {chartError && (
              <div className="rounded bg-rose-100 p-2 text-xs text-rose-700">{chartError}</div>
            )}
            <div className="text-xs text-slate-500">
              排盘后下方所有字段可手动微调；生日不会被保存（仅本次计算用）。
            </div>
          </div>
        )}
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
