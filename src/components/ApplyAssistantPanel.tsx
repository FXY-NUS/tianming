import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Mail, Sparkles } from 'lucide-react';
import type { ApplyProfile, Job, ResumeProfile } from '../../types';
import type { RecommendedResume } from '../core/matchTypes';
import { buildApplyEmail, getApplyProfileFields } from '../../services/applyAssistant';

interface ApplyAssistantPanelProps {
  job: Job;
  applyProfile?: ApplyProfile;
  recommendedResume?: RecommendedResume;
  activeResumeId?: string;
  resumes: ResumeProfile[];
  onSwitchResume: (resumeId: string) => void;
  onOpenApplyProfile: () => void;
}

export function ApplyAssistantPanel({
  job,
  applyProfile,
  recommendedResume,
  activeResumeId,
  resumes,
  onSwitchResume,
  onOpenApplyProfile,
}: ApplyAssistantPanelProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState(
    applyProfile?.savedAnswers?.[0]?.id ?? '',
  );
  const [copiedKey, setCopiedKey] = useState<string>('');
  const fields = useMemo(() => getApplyProfileFields(applyProfile), [applyProfile]);
  const selectedAnswerExists = applyProfile?.savedAnswers?.some(
    (answer) => answer.id === selectedAnswerId,
  );
  const emailBody = useMemo(
    () =>
      buildApplyEmail({
        applyProfile,
        job,
        selectedAnswerId: selectedAnswerExists ? selectedAnswerId : undefined,
      }),
    [applyProfile, job, selectedAnswerExists, selectedAnswerId],
  );

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1500);
  };

  return (
    <div className="space-y-3">
      <RecommendedResumeBanner
        recommendedResume={recommendedResume}
        activeResumeId={activeResumeId}
        resumes={resumes}
        onSwitchResume={onSwitchResume}
      />

      <details className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
          <span className="inline-flex items-center gap-2">
            <Clipboard size={16} className="text-indigo-600" />
            投递助手 · 30 秒投递准备
          </span>
          <span className="ml-3 text-[11px] font-bold text-slate-400">默认收起，不自动提交</span>
        </summary>

        <div className="mt-5 space-y-5">
          {!applyProfile ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-black">未设置投递档案</div>
              <button
                type="button"
                onClick={onOpenApplyProfile}
                className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600"
              >
                去设置常用投递字段
              </button>
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  字段复制
                </div>
                {fields.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-500">
                    投递档案还没有可复制字段。请先补姓名、邮箱、电话或链接。
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[160px_1fr_auto] md:items-center"
                      >
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {field.label}
                        </div>
                        <div className="break-all text-sm font-semibold text-slate-800">
                          {field.value}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(field.key, field.value)}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700"
                        >
                          {copiedKey === field.key ? '已复制' : '复制'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    邮件模式
                  </div>
                  {applyProfile.savedAnswers && applyProfile.savedAnswers.length > 0 && (
                    <select
                      value={selectedAnswerId}
                      onChange={(event) => setSelectedAnswerId(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      <option value="">不使用回答模板</option>
                      {applyProfile.savedAnswers.map((answer) => (
                        <option key={answer.id} value={answer.id}>
                          {answer.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <textarea
                  readOnly
                  value={emailBody}
                  className="h-64 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => copyText('email-body', emailBody)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black text-white hover:bg-slate-800"
                >
                  <Mail size={14} />
                  {copiedKey === 'email-body' ? '完整邮件已复制' : '复制完整邮件'}
                </button>
              </section>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function RecommendedResumeBanner({
  recommendedResume,
  activeResumeId,
  resumes,
  onSwitchResume,
}: {
  recommendedResume?: RecommendedResume;
  activeResumeId?: string;
  resumes: ResumeProfile[];
  onSwitchResume: (resumeId: string) => void;
}) {
  if (!recommendedResume?.resumeId) return null;

  const resumeExists = resumes.some((resume) => resume.id === recommendedResume.resumeId);
  if (recommendedResume.resumeId === activeResumeId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
        <CheckCircle2 size={14} className="mr-2 inline text-emerald-500" />
        当前简历已最匹配：{recommendedResume.label}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1 text-indigo-950">
        <div className="font-black">
          <Sparkles size={14} className="mr-2 inline text-indigo-600" />
          推荐用「{recommendedResume.label}」投这个 JD
        </div>
        <div className="mt-1 text-xs font-medium text-indigo-800">
          {truncate(recommendedResume.reasoning, 96)}
        </div>
      </div>
      <button
        type="button"
        disabled={!resumeExists}
        onClick={() => onSwitchResume(recommendedResume.resumeId)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        切换为 active
      </button>
    </div>
  );
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
