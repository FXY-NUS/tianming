import { FileText, Trophy } from 'lucide-react';
import type { ResumeMatchBreakdown } from '../core/matchTypes';

interface Props {
  breakdown: ResumeMatchBreakdown;
}

export function ResumeMatchBreakdownCard({ breakdown }: Props) {
  const { bestResumeId, activeResumeId, totalJdSkills, perResume } = breakdown;

  if (perResume.length === 0 || totalJdSkills === 0) return null;

  const best = perResume.find((r) => r.resumeId === bestResumeId);
  const active = activeResumeId ? perResume.find((r) => r.resumeId === activeResumeId) : null;
  const isActiveBest = activeResumeId === bestResumeId;
  const singleResume = perResume.length === 1;

  if (!best) return null;

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
      <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest flex items-center gap-2">
        <FileText size={18} /> 简历适配分析
      </h4>

      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-3">
        <Trophy size={18} className="text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-black text-sm text-emerald-800">「{best.resumeLabel}」</span>
          <span className="text-sm text-emerald-700">
            {' '}
            命中 {best.coverageCount}/{totalJdSkills} 个 JD 技能
          </span>
          {singleResume && (
            <span className="text-xs text-emerald-600 ml-2 opacity-70">（仅一份简历）</span>
          )}
        </div>
      </div>

      {!singleResume && !isActiveBest && active && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
          当前选用「{active.resumeLabel}」命中 {active.coverageCount}/{totalJdSkills}，建议切换至「
          {best.resumeLabel}」
        </div>
      )}

      {!singleResume && (
        <div className="space-y-2">
          {perResume.map((r) => {
            const pct = Math.round((r.coverageCount / totalJdSkills) * 100);
            const isBest = r.resumeId === bestResumeId;
            const isCurrent = r.resumeId === activeResumeId;
            return (
              <div key={r.resumeId} className="flex items-center gap-3">
                <span
                  className={`text-xs font-bold w-28 shrink-0 truncate ${isBest ? 'text-emerald-700' : 'text-slate-500'}`}
                  title={r.resumeLabel}
                >
                  {r.resumeLabel}
                  {isCurrent && <span className="ml-1 text-[10px] text-indigo-500">(当前)</span>}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isBest ? 'bg-emerald-400' : 'bg-slate-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-black text-slate-600 w-12 text-right shrink-0">
                  {r.coverageCount}/{totalJdSkills}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
