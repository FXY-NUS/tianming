import { useState, type FC } from 'react';
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
import { parseWenmoChart, type WenmoParseResult } from './parseWenmo';

interface PalaceRowProps {
  label: string;
  hint: string;
  required?: boolean;
  value: ZiweiPalace;
  onChange: (next: ZiweiPalace) => void;
  onRemove?: () => void;
}

/**
 * Replace mainStars with `nextStars`. If the array length changes, the parallel
 * mainStarStrengths array becomes stale (slot count mismatch), so we drop it.
 * Renaming a star at the same slot keeps strengths — the user owns that choice.
 */
function withMainStars(palace: ZiweiPalace, nextStars: ZiweiMainStar[]): ZiweiPalace {
  if (nextStars.length === palace.mainStars.length) {
    return { ...palace, mainStars: nextStars };
  }
  const next: ZiweiPalace = { ...palace, mainStars: nextStars };
  delete (next as { mainStarStrengths?: unknown }).mainStarStrengths;
  return next;
}

const PalaceRow: FC<PalaceRowProps> = ({ label, hint, required, value, onChange, onRemove }) => {
  const [primary, secondary] = value.mainStars;
  const hasSecondary = value.mainStars.length === 2;

  const handlePrimaryChange = (next: ZiweiMainStar) => {
    // If the new primary collides with the secondary, drop the secondary.
    const nextStars: ZiweiMainStar[] =
      hasSecondary && secondary !== next ? [next, secondary] : [next];
    onChange(withMainStars(value, nextStars));
  };

  const handleSecondaryChange = (next: ZiweiMainStar) => {
    onChange(withMainStars(value, [primary, next]));
  };

  const handleAddSecondary = () => {
    // Default the secondary to the first star that is not the primary so the
    // uniqueness refine passes immediately on submit.
    const fallback = ZIWEI_MAIN_STARS.find((s) => s !== primary) ?? primary;
    onChange(withMainStars(value, [primary, fallback]));
  };

  const handleRemoveSecondary = () => {
    onChange(withMainStars(value, [primary]));
  };

  const secondaryOptions = ZIWEI_MAIN_STARS.filter((s) => s !== primary);

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

      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <select
          className="rounded-lg border-2 border-white bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none"
          value={primary}
          onChange={(e) => handlePrimaryChange(e.target.value as ZiweiMainStar)}
          aria-label={`${label} 主星`}
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
          aria-label={`${label} 四化`}
        >
          {ZIWEI_SIHUA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {!hasSecondary ? (
          <button
            type="button"
            onClick={handleAddSecondary}
            className="rounded-lg border-2 border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
            aria-label={`${label} 添加副主星`}
          >
            + 副主星
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRemoveSecondary}
            className="rounded-lg border-2 border-rose-200 px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
            aria-label={`${label} 移除副主星`}
          >
            × 副主星
          </button>
        )}
      </div>

      {hasSecondary && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-slate-500">副主星</span>
          <select
            className="flex-1 rounded-lg border-2 border-white bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none"
            value={secondary}
            onChange={(e) => handleSecondaryChange(e.target.value as ZiweiMainStar)}
            aria-label={`${label} 副主星选择`}
          >
            {secondaryOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {value.mainStarStrengths && (
        <div className="mt-2 text-xs text-slate-500">
          已记录强度：
          {value.mainStars
            .map((star, i) => `${star}[${value.mainStarStrengths?.[i] ?? '?'}]`)
            .join(' + ')}
          <span className="ml-1 text-slate-400">（手动编辑请使用「从文墨天机导入」）</span>
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-indigo-600">
          副星 / 备注（可选）
        </summary>
        <input
          type="text"
          className="mt-2 w-full rounded-lg border-2 border-white bg-white p-2 text-xs focus:border-indigo-500 focus:outline-none"
          placeholder="如：文曲·科、左辅、自化忌、神煞、辅星"
          value={value.note ?? ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </details>
    </div>
  );
};

interface WenmoImporterProps {
  current: ZiweiData;
  onApply: (next: ZiweiData) => void;
}

const WenmoImporter: FC<WenmoImporterProps> = ({ current, onApply }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<WenmoParseResult | null>(null);

  const handleParse = () => {
    setResult(parseWenmoChart(text));
  };

  const handleReset = () => {
    setText('');
    setResult(null);
  };

  const handleApply = () => {
    if (!result || result.status !== 'ok') return;
    // Merge: import provides the 4 required palaces + optional 身宫 + global
    // note. 流年宫 / liunianYear are year-specific and not in the export, so
    // we preserve the user's existing values for those.
    const next: ZiweiData = {
      ...current,
      ming: result.data.ming,
      guanlu: result.data.guanlu,
      caibo: result.data.caibo,
      fuqi: result.data.fuqi,
      shen: result.data.shen ?? current.shen,
      note: result.data.note ?? current.note,
    };
    onApply(next);
    handleReset();
  };

  return (
    <details className="rounded-xl border-2 border-indigo-100 bg-indigo-50/50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
        📋 从文墨天机命盘导入（一键填入核心宫位）
      </summary>
      <div className="mt-3 space-y-2 text-xs text-slate-600">
        <p>
          在文墨天机 App 内打开命盘 → 复制整段命盘文本 → 粘贴到下方。 解析完全在浏览器内进行，不调用
          LLM。
        </p>
        <textarea
          className="h-32 w-full rounded-lg border-2 border-white bg-white p-2 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          placeholder="文墨天机紫微斗数命盘 ...（含「├主星」「├安星码」等树形结构）"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="文墨天机命盘原文"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={!text.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            解析
          </button>
          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              清空
            </button>
          )}
        </div>
        {result?.status === 'error' && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">
            <span className="font-semibold">解析失败 · {result.kind}</span>
            <p className="mt-1">{result.message}</p>
          </div>
        )}
        {result?.status === 'ok' && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
            <div className="font-semibold">解析成功，将填入：</div>
            <ul className="space-y-1 pl-4">
              {Object.entries(result.preview.schema).map(([key, line]) => (
                <li key={key} className="list-disc">
                  <span className="font-semibold">{PALACE_LABEL[key as PalaceKey]}</span>：{line}
                </li>
              ))}
            </ul>
            {result.preview.metadata.length > 0 && (
              <div className="text-slate-600">
                元信息 → 全局备注：{result.preview.metadata.join('；')}
              </div>
            )}
            {result.preview.nonSchemaPalaces.length > 0 && (
              <div className="text-slate-600">
                其他 {result.preview.nonSchemaPalaces.length} 个宫位摘要将合并进全局备注。
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-1.5 text-amber-700">
                ⚠ {result.warnings.join('；')}
              </div>
            )}
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              应用到表单
            </button>
          </div>
        )}
      </div>
    </details>
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
        手动填写或从下方「从文墨天机导入」一键填入核心宫位。
      </div>

      <WenmoImporter current={value} onApply={onChange} />

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
