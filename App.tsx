import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Upload,
  Sparkles,
  Star,
  MapPin,
  Building2,
  Briefcase,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  Heart,
  ChevronRight,
  User,
  Save,
  Zap,
  ListChecks,
  Database,
  X,
  Brain,
  Send,
  MessageSquare,
  Activity,
  ShieldAlert,
  TrendingUp,
  Target,
  FileWarning,
  Key,
  RefreshCcw,
  Plus,
  ClipboardPaste,
  FileText,
} from 'lucide-react';
import { ApplyProfile, Job, SavedAnswer, UserContext, UserPreferences } from './types';
import {
  batchScreenJobs,
  deepAuditJob,
  sendMessageToJobConsultant,
} from './services/geminiService';
import {
  DEFAULT_USER_CONTEXT,
  mergeUserContextPatch,
  type UserContextPatch,
} from './services/userContextStorage';
import { parseSalaryRangeDraft } from './services/preferenceValidation';
import { ResumeModal } from './src/components/ResumeModal';
import { PersonaSection } from './src/components/PersonaSection';
import { ResumeMatchBreakdownCard } from './src/components/ResumeMatchBreakdownCard';
import { ApplyAssistantPanel } from './src/components/ApplyAssistantPanel';
import { PasteJobModal } from './src/components/PasteJobModal';
import { useExtensionImport } from './src/hooks/useExtensionImport';
import { getLlmMode } from './services/llmClient';
import { createCachedTriage, triageCards } from './services/extensionTriage';
import { buildCopyKit } from './services/copyKit';
import {
  jobFromPastedText,
  jobsFromExtension,
  jobsFromImportPayload,
  type JobImportInput,
} from './services/jobImport';
import { migrateLocalStorageToIndexedDb } from './src/storage/migration';
import {
  loadJobsFromIndexedDb,
  loadUserContextFromIndexedDb,
  saveJobsToIndexedDb,
  saveUserContextToIndexedDb,
  subscribeJobsFromIndexedDb,
  subscribeUserContextFromIndexedDb,
} from './src/storage/repository';

const LOCAL_STORAGE_KEY_USAGE = 'career_navigator_usage_v4';
const MAX_SAVED_ANSWERS = 10;

type ProfileTab = 'profile' | 'apply' | 'personas';

const splitListInput = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const joinListInput = (value: string[]): string => value.join(', ');

const createSavedAnswer = (): SavedAnswer => ({
  id: `saved-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: '',
  content: '',
  updatedAt: new Date().toISOString(),
});

const isApplyProfileEmpty = (applyProfile?: ApplyProfile): boolean => {
  if (!applyProfile) return true;
  const hasField = [
    applyProfile.fullName,
    applyProfile.email,
    applyProfile.phone,
    applyProfile.location,
    applyProfile.linkedIn,
    applyProfile.github,
    applyProfile.portfolio,
    applyProfile.workAuthStatus,
    applyProfile.yearsExperience,
    applyProfile.willingToRelocate,
    applyProfile.earliestStartDate,
    applyProfile.signature,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
  return !hasField && (applyProfile.savedAnswers?.length ?? 0) === 0;
};

const normalizeApplyProfileForSave = (applyProfile?: ApplyProfile): ApplyProfile | undefined => {
  if (!applyProfile) return undefined;
  const trim = (value: string | undefined) => {
    const next = value?.trim();
    return next ? next : undefined;
  };
  const savedAnswers = (applyProfile.savedAnswers ?? [])
    .slice(0, MAX_SAVED_ANSWERS)
    .map((answer) => ({
      ...answer,
      label: answer.label.trim(),
      content: answer.content.trim(),
      updatedAt: answer.updatedAt || new Date().toISOString(),
    }))
    .filter((answer) => answer.label && answer.content);
  const normalized: ApplyProfile = {
    fullName: trim(applyProfile.fullName),
    email: trim(applyProfile.email),
    phone: trim(applyProfile.phone),
    location: trim(applyProfile.location),
    linkedIn: trim(applyProfile.linkedIn),
    github: trim(applyProfile.github),
    portfolio: trim(applyProfile.portfolio),
    workAuthStatus: trim(applyProfile.workAuthStatus),
    yearsExperience: trim(applyProfile.yearsExperience),
    willingToRelocate: applyProfile.willingToRelocate,
    earliestStartDate: trim(applyProfile.earliestStartDate),
    signature: trim(applyProfile.signature),
    savedAnswers: savedAnswers.length > 0 ? savedAnswers : undefined,
  };
  return isApplyProfileEmpty(normalized) ? undefined : normalized;
};

const getJobScore = (job: Job): number | undefined =>
  job.analysis?.matchScore?.overall ??
  job.matchScore?.overall ??
  job.analysis?.score ??
  job.flashScore;

const getUnknownRatio = (matchScore: Job['matchScore']): number => {
  if (!matchScore || matchScore.dimensions.length === 0) return 0;
  const unknownCount = matchScore.dimensions.filter(
    (dimension) => dimension.confidence === 'unknown' || dimension.score === undefined,
  ).length;
  return unknownCount / matchScore.dimensions.length;
};

const hasInsufficientScoreData = (matchScore: Job['matchScore']): boolean =>
  getUnknownRatio(matchScore) > 0.5;

const scorePillClass = (score: number | undefined): string => {
  if (score === undefined) return 'bg-slate-200 text-slate-500';
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score < 40) return 'bg-slate-200 text-slate-500';
  return 'bg-indigo-600 text-white';
};

// 代理模式（默认）下 Key 只在服务端，前端不再需要也不再保存 Key（D9）。
const USES_PROXY = getLlmMode() === 'proxy';
const ApplyInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-4">
    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full border-2 border-slate-100 p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
    />
  </div>
);

const logStorageError = (error: unknown) => {
  console.error('IndexedDB storage error', error);
};

const App = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userCtx, setUserCtx] = useState<UserContext>(DEFAULT_USER_CONTEXT);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showPasteJobModal, setShowPasteJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Date');

  const [isScreening, setIsScreening] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [usage, setUsage] = useState({ flash: 0, pro: 0 });
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(USES_PROXY);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const storageReadyRef = useRef(false);

  useEffect(() => {
    if (!USES_PROXY) setHasApiKey(!!localStorage.getItem('GEMINI_API_KEY'));

    const savedUsage = localStorage.getItem(LOCAL_STORAGE_KEY_USAGE);
    if (savedUsage) setUsage(JSON.parse(savedUsage));

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const initialiseStorage = async () => {
      try {
        await migrateLocalStorageToIndexedDb();
        const [initialUserContext, initialJobs] = await Promise.all([
          loadUserContextFromIndexedDb(),
          loadJobsFromIndexedDb(),
        ]);

        if (cancelled) return;

        setUserCtx(initialUserContext);
        setJobs(initialJobs);
        storageReadyRef.current = true;
        setStorageReady(true);

        unsubscribers.push(
          subscribeUserContextFromIndexedDb((nextUserContext) => {
            if (!cancelled) setUserCtx(nextUserContext);
          }, logStorageError),
          subscribeJobsFromIndexedDb((nextJobs) => {
            if (cancelled) return;
            setJobs(nextJobs);
            setSelectedJob((current) =>
              current ? (nextJobs.find((job) => job.id === current.id) ?? null) : null,
            );
          }, logStorageError),
        );
      } catch (error) {
        logStorageError(error);
      }
    };

    void initialiseStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_KEY_USAGE) {
        try {
          setUsage(event.newValue ? JSON.parse(event.newValue) : { flash: 0, pro: 0 });
        } catch {
          // Keep current usage if another tab writes malformed data.
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      cancelled = true;
      storageReadyRef.current = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_USAGE, JSON.stringify(usage));
  }, [usage]);

  const handleSelectKey = async () => {
    const current = localStorage.getItem('GEMINI_API_KEY') || '';
    const key = window.prompt('请粘贴你的 Gemini API Key（会保存在浏览器 localStorage）:', current);
    if (key && key.trim()) {
      localStorage.setItem('GEMINI_API_KEY', key.trim());
      setHasApiKey(true);
    }
  };

  const trackUsage = (type: 'flash' | 'pro') => {
    setUsage((prev) => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const persistUserContext = (
    patchOrUpdater: UserContextPatch | ((current: UserContext) => UserContextPatch),
  ) => {
    setUserCtx((current) => {
      const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(current) : patchOrUpdater;
      const next = mergeUserContextPatch(current, patch);
      if (storageReadyRef.current) {
        void saveUserContextToIndexedDb(next).catch(logStorageError);
      }
      return next;
    });
  };

  const persistJobs = (updater: Job[] | ((current: Job[]) => Job[])) => {
    setJobs((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (storageReadyRef.current) {
        void saveJobsToIndexedDb(next).catch(logStorageError);
      }
      return next;
    });
  };

  const saveProfileData = (updated: UserContext) => {
    const salaryResult = parseSalaryRangeDraft(salaryMinDraft, salaryMaxDraft);
    if (salaryResult.status === 'error') {
      setSalaryRangeError(salaryResult.message);
      return;
    }

    const applyProfile = normalizeApplyProfileForSave(updated.preferences.applyProfile);
    persistUserContext({
      ...updated,
      preferences: {
        ...updated.preferences,
        salaryRange: salaryResult.salaryRange,
        applyProfile,
      },
    });
    setShowProfileModal(false);
  };

  const handleError = (e: any, type: string) => {
    console.error(e);
    const errorStr = JSON.stringify(e);
    const errorMsg = e.toString();

    if (USES_PROXY && errorMsg.includes('Proxy ')) {
      const quota = errorMsg.includes('RESOURCE_EXHAUSTED');
      const throttled = errorMsg.includes('RATE_LIMITED');
      alert(
        quota
          ? `【额度耗尽】${type}触发了 Gemini 额度限制，请等待 1 分钟再试。`
          : throttled
            ? `【请求太频繁】${type}超出了代理的每分钟次数上限，请等待 1 分钟再试。`
            : `【代理出错】${type}调用后端代理失败：\n\n${errorMsg}`,
      );
    } else if (errorMsg.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
      alert(
        `【额度耗尽】${type}触发了免费额度限制。\n\n建议：请等待 1 分钟再试，或点击右上角 Key 图标切换到一个"已开启结算"的项目 Key。`,
      );
    } else if (
      errorMsg.includes('400') ||
      errorMsg.includes('expired') ||
      errorMsg.includes('INVALID_ARGUMENT') ||
      errorMsg.includes('API_KEY_INVALID')
    ) {
      alert(
        `【Key 已失效】当前选择的 API Key 已过期或无效。\n\n请点击确定后，在弹出的窗口中选择一个新的、状态正常的付费项目 Key。`,
      );
      setHasApiKey(false);
      handleSelectKey();
    } else if (errorMsg.includes('Requested entity was not found')) {
      alert('选定的 API 项目未找到，正在重置 Key 选择状态...');
      setHasApiKey(false);
      handleSelectKey();
    } else if (
      errorMsg.includes('Failed to fetch') ||
      errorStr.includes('ERR_SSL_PROTOCOL_ERROR') ||
      errorStr.includes('ERR_NETWORK')
    ) {
      alert(
        `${type}请求没有到达 Gemini。常见原因是 Codespace 预览页休眠、网络/TLS 连接被浏览器或扩展拦截，或旧的 forwarded port URL 已失效。请重新运行 npm run dev -- --host 0.0.0.0，打开新的 3000 端口预览后重试。`,
      );
    } else {
      alert(`${type}过程中发生异常，请检查控制台或重试。`);
    }
  };

  const handleBatchScreen = async () => {
    const unscreened = jobs.filter((j) => !j.flashScore && j.status === 'New').slice(0, 30);
    if (unscreened.length === 0) return alert('当前批次已处理完毕');

    setIsScreening(true);
    try {
      const results = await batchScreenJobs(unscreened, userCtx);
      trackUsage('flash');

      persistJobs((prev) => {
        const updated = [...prev];
        results.forEach((res: any) => {
          const index = updated.findIndex((j) => String(j.id) === String(res.id));
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              flashScore: res.score,
              flashMatchReason: res.reason,
              matchScore: res.matchScore,
              extractedEvidence: res.extractedEvidence,
              status: 'Screened',
            };
          }
        });
        return updated;
      });
    } catch (e) {
      handleError(e, '初筛');
    } finally {
      setIsScreening(false);
    }
  };

  const handleDeepAudit = async (job: Job) => {
    setIsAuditing(true);
    try {
      const analysis = await deepAuditJob(job, userCtx);
      trackUsage('pro');
      const score = analysis.matchScore?.overall ?? analysis.score;
      const updates = {
        analysis,
        matchScore: analysis.matchScore,
        extractedEvidence: analysis.extractedEvidence,
        status: (score >= 80 ? 'High Match' : 'Screened') as Job['status'],
      };
      updateJobData(job.id, updates);
    } catch (e) {
      handleError(e, '深度审计');
    } finally {
      setIsAuditing(false);
    }
  };

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    persistJobs((prev) => prev.map((j) => (j.id === id ? { ...j, isFavorite: !j.isFavorite } : j)));
    if (selectedJob?.id === id) {
      setSelectedJob((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = JSON.parse(event.target.result as string);
        const newJobsData = jobsFromImportPayload(raw, jobs);
        persistJobs((prev) => [...newJobsData, ...prev]);
      } catch (err) {
        alert('导入失败');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  // 扩展卡片粗筛：同一会话内每张卡片只评一次；画像改了以后已缓存的徽章不重评。
  const [extensionTriage] = useState(() =>
    createCachedTriage((cards, ctx) => {
      trackUsage('flash');
      return triageCards(cards, ctx, batchScreenJobs);
    }),
  );

  useExtensionImport({
    ready: storageReady,
    onJobs: (captured) => persistJobs((prev) => [...jobsFromExtension(captured, prev), ...prev]),
    onTriage: (cards) => extensionTriage(cards, userCtx),
    onCopyKit: (job) => buildCopyKit(userCtx, job),
  });

  const handlePasteJob = (input: JobImportInput): string | null => {
    const result = jobFromPastedText(input, jobs);
    if (result.kind === 'empty') return '先粘贴 JD 正文';
    const job = result.kind === 'created' ? result.job : result.existing;
    if (result.kind === 'created') persistJobs((prev) => [job, ...prev]);
    setStatusFilter('All');
    setFilter('');
    setSelectedJob(job);
    setShowPasteJobModal(false);
    return null;
  };

  const updateJobData = (jobId: string, updates: Partial<Job>) => {
    persistJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j)));
    if (selectedJob?.id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !selectedJob || isChatting) return;
    const userMsg = {
      role: 'user' as const,
      text: chatInput,
      time: new Date().toLocaleTimeString(),
    };
    const newHistory = [...(selectedJob.chatHistory || []), userMsg];
    updateJobData(selectedJob.id, { chatHistory: newHistory });
    setChatInput('');
    setIsChatting(true);
    try {
      const response = await sendMessageToJobConsultant(selectedJob, userCtx, chatInput);
      trackUsage('flash');
      const aiMsg = {
        role: 'model' as const,
        text: response,
        time: new Date().toLocaleTimeString(),
      };
      updateJobData(selectedJob.id, { chatHistory: [...newHistory, aiMsg] });
    } catch (e) {
      handleError(e, '聊天');
    } finally {
      setIsChatting(false);
    }
  };

  const counts = useMemo(
    () => ({
      All: jobs.length,
      New: jobs.filter((j) => j.status === 'New').length,
      Screened: jobs.filter((j) => j.status === 'Screened').length,
      HighMatch: jobs.filter((j) => j.status === 'High Match').length,
      Applied: jobs.filter((j) => j.status === 'Applied').length,
      Fav: jobs.filter((j) => j.isFavorite).length,
    }),
    [jobs],
  );

  const processedJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        const matchT =
          j.title.toLowerCase().includes(filter.toLowerCase()) ||
          j.company.toLowerCase().includes(filter.toLowerCase());
        const matchS =
          statusFilter === 'All'
            ? true
            : statusFilter === 'Fav'
              ? j.isFavorite
              : j.status === (statusFilter === 'HighMatch' ? 'High Match' : statusFilter);
        return matchT && matchS;
      })
      .sort((a, b) => {
        if (sortBy === 'Score') return (getJobScore(b) ?? 0) - (getJobScore(a) ?? 0);
        return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime();
      });
  }, [jobs, filter, statusFilter, sortBy]);

  // Local edit state for profile modal
  const [editCtx, setEditCtx] = useState<UserContext>(userCtx);
  const [profileTab, setProfileTab] = useState<ProfileTab>('profile');
  const [salaryMinDraft, setSalaryMinDraft] = useState('');
  const [salaryMaxDraft, setSalaryMaxDraft] = useState('');
  const [salaryRangeError, setSalaryRangeError] = useState('');
  const openProfileModal = (initialTab: ProfileTab = 'profile') => {
    setEditCtx(userCtx);
    setSalaryMinDraft(userCtx.preferences.salaryRange?.[0]?.toString() ?? '');
    setSalaryMaxDraft(userCtx.preferences.salaryRange?.[1]?.toString() ?? '');
    setSalaryRangeError('');
    setProfileTab(initialTab);
    setShowProfileModal(true);
  };

  const updateEditPrefs = (updates: Partial<UserPreferences>) => {
    setEditCtx((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...updates },
    }));
  };

  const updateApplyProfile = (updates: Partial<ApplyProfile>) => {
    setEditCtx((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        applyProfile: {
          ...(prev.preferences.applyProfile ?? {}),
          ...updates,
        },
      },
    }));
  };

  const updateSavedAnswer = (id: string, updates: Partial<SavedAnswer>) => {
    setEditCtx((prev) => {
      const current = prev.preferences.applyProfile ?? {};
      const savedAnswers = (current.savedAnswers ?? []).map((answer) =>
        answer.id === id ? { ...answer, ...updates, updatedAt: new Date().toISOString() } : answer,
      );
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          applyProfile: {
            ...current,
            savedAnswers,
          },
        },
      };
    });
  };

  const addSavedAnswer = () => {
    setEditCtx((prev) => {
      const current = prev.preferences.applyProfile ?? {};
      const savedAnswers = current.savedAnswers ?? [];
      if (savedAnswers.length >= MAX_SAVED_ANSWERS) return prev;
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          applyProfile: {
            ...current,
            savedAnswers: [...savedAnswers, createSavedAnswer()],
          },
        },
      };
    });
  };

  const removeSavedAnswer = (id: string) => {
    setEditCtx((prev) => {
      const current = prev.preferences.applyProfile ?? {};
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          applyProfile: {
            ...current,
            savedAnswers: (current.savedAnswers ?? []).filter((answer) => answer.id !== id),
          },
        },
      };
    });
  };

  const prefillApplyProfileFromActiveResume = () => {
    const activeResume = editCtx.activeResumeId
      ? editCtx.resumes.find((resume) => resume.id === editCtx.activeResumeId)
      : undefined;
    const basic = activeResume?.structured.basic;
    if (!basic) return;
    const current = editCtx.preferences.applyProfile ?? {};
    updateApplyProfile({
      fullName: current.fullName || basic.name || '',
      email: current.email || basic.email || '',
      phone: current.phone || basic.phone || '',
      location: current.location || basic.location || '',
    });
  };

  const updateSalaryRange = (bound: 'min' | 'max', rawValue: string) => {
    if (bound === 'min') {
      setSalaryMinDraft(rawValue);
    } else {
      setSalaryMaxDraft(rawValue);
    }
    setSalaryRangeError('');
  };

  const selectedMatchScore = selectedJob?.analysis?.matchScore ?? selectedJob?.matchScore;
  const selectedHasInsufficientData = hasInsufficientScoreData(selectedMatchScore);
  const selectedUnknownPercent = Math.round(getUnknownRatio(selectedMatchScore) * 100);
  const switchActiveResume = (resumeId: string) => {
    persistUserContext({ activeResumeId: resumeId });
  };
  const editingApplyProfile = editCtx.preferences.applyProfile ?? {};
  const editingSavedAnswers = editingApplyProfile.savedAnswers ?? [];
  const canAddSavedAnswer = editingSavedAnswers.length < MAX_SAVED_ANSWERS;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-[360px] bg-white border-r flex flex-col shadow-xl shrink-0 z-20">
        <div className="p-4 bg-indigo-900 text-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-black text-lg flex items-center gap-2">
              <Sparkles className="text-yellow-400" size={18} /> 天命 8.0
            </h1>
            <div className="flex items-center gap-2">
              <div className="text-right mr-1">
                <p className="text-[9px] font-mono text-yellow-400/60 leading-none">
                  F:{usage.flash} P:{usage.pro}
                </p>
              </div>
              {!USES_PROXY && (
                <button
                  onClick={handleSelectKey}
                  className={`p-1.5 rounded-full transition-all flex items-center justify-center ${hasApiKey ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/30 text-rose-200 animate-pulse'}`}
                  title={hasApiKey ? '已连接 API (点击更换)' : '未连接 API (点击设置)'}
                >
                  {hasApiKey ? <Key size={16} /> : <AlertCircle size={16} />}
                </button>
              )}
              <button
                onClick={() => openProfileModal()}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <User size={18} />
              </button>
            </div>
          </div>

          <div className="bg-indigo-950/40 rounded-xl p-2.5 border border-white/5">
            <div className="flex justify-between items-center mb-1.5 px-1">
              <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-tighter">
                极速批处理 (30份/次)
              </span>
              <span className="text-[10px] font-black text-yellow-400">{counts.New} 待筛</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-700"
                  style={{ width: `${(counts.Screened / Math.max(1, counts.All)) * 100}%` }}
                />
              </div>
              <button
                onClick={handleBatchScreen}
                disabled={isScreening || counts.New === 0}
                className="bg-yellow-400 hover:bg-yellow-500 text-indigo-950 font-black px-3 py-1.5 rounded-lg text-[10px] shadow-lg disabled:opacity-20 transition-all active:scale-95 shrink-0 flex items-center gap-1"
              >
                {isScreening ? <RefreshCw className="animate-spin" size={10} /> : <Zap size={10} />}
                初筛
              </button>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2 shrink-0">
          <FileText size={12} className="text-indigo-500 shrink-0" />
          <span className="text-[10px] font-bold text-indigo-700 shrink-0">当前简历</span>
          {userCtx.resumes.length > 0 ? (
            <select
              value={userCtx.activeResumeId ?? ''}
              onChange={(e) => switchActiveResume(e.target.value)}
              title="切换激活简历，初筛和审计都按它算"
              className="flex-1 min-w-0 bg-white border border-indigo-200 rounded-md px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-500"
            >
              {!userCtx.activeResumeId && <option value="">未选择</option>}
              {userCtx.resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex-1 text-[11px] text-slate-500">还没有简历</span>
          )}
          <button
            type="button"
            onClick={() => setShowResumeModal(true)}
            className="shrink-0 text-[10px] font-bold text-indigo-700 hover:underline"
          >
            管理
          </button>
        </div>

        <div className="p-3 space-y-2 bg-white border-b shadow-sm shrink-0">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索岗位或公司..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-slate-100">
              <Upload size={12} /> 导入 JSON
              <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
            </label>
            <button
              onClick={() => setShowPasteJobModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold hover:bg-indigo-100"
            >
              <ClipboardPaste size={12} /> 粘贴 JD
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 text-[10px] font-bold outline-none"
            >
              <option value="Date">日期</option>
              <option value="Score">评分</option>
            </select>
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'All', label: '全部', c: counts.All },
              { id: 'Fav', label: '感兴趣', c: counts.Fav, icon: <Star size={10} /> },
              { id: 'New', label: '待筛', c: counts.New },
              { id: 'Screened', label: '已筛', c: counts.Screened },
              { id: 'HighMatch', label: '推荐', c: counts.HighMatch },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 py-1 rounded-full border text-[9px] font-black transition-all flex items-center gap-1 whitespace-nowrap ${statusFilter === s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                {s.icon}
                {s.label} <span className="opacity-40">{s.c}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 no-scrollbar">
          {processedJobs.map((job) => {
            const displayScore = getJobScore(job);
            const cardMatchScore = job.analysis?.matchScore ?? job.matchScore;
            const cardHasInsufficientData = hasInsufficientScoreData(cardMatchScore);
            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition-all border-l-[6px] relative group ${selectedJob?.id === job.id ? 'bg-indigo-50 border-l-indigo-600 shadow-inner' : 'border-l-transparent'}`}
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3
                    className={`font-bold text-[13px] leading-tight line-clamp-2 ${selectedJob?.id === job.id ? 'text-indigo-950' : 'text-slate-800'}`}
                  >
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star
                      onClick={(e) => toggleFavorite(job.id, e)}
                      size={16}
                      className={`transition-colors ${job.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200 group-hover:text-slate-300'}`}
                    />
                    {displayScore !== undefined && cardHasInsufficientData && (
                      <span
                        title="超过一半评分维度仍是 unknown"
                        className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                      >
                        信息不足
                      </span>
                    )}
                    {displayScore !== undefined && !cardHasInsufficientData && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${scorePillClass(displayScore)}`}
                      >
                        {displayScore}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mb-2">{job.company}</div>
                {job.flashMatchReason && (
                  <div
                    className={`text-[10px] p-2 rounded-lg line-clamp-2 italic ${(displayScore ?? 100) < 40 ? 'bg-slate-200/50 text-slate-400' : 'bg-white/50 border border-indigo-100 text-indigo-700'}`}
                  >
                    "{job.flashMatchReason}"
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[9px] text-slate-400">
                    {new Date(job.importedAt).toLocaleDateString()}
                  </span>
                  <Trash2
                    onClick={(e) => {
                      e.stopPropagation();
                      persistJobs((prev) => prev.filter((j) => j.id !== job.id));
                      if (selectedJob?.id === job.id) setSelectedJob(null);
                    }}
                    size={14}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Detail Area */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-50">
        {!hasApiKey && (
          <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
              <Key size={40} className="text-rose-500 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">天命导航未激活</h2>
            <p className="text-slate-500 mb-8 max-w-sm leading-relaxed text-sm">
              当前 API 密钥缺失或已失效。为了获得高精度的 Pro 审计结果，请点击下方按钮选择一个
              <b>已开启结算账户（Paid Project）</b>的 API Key。
            </p>
            <button
              onClick={handleSelectKey}
              className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"
            >
              <Zap size={20} /> 立即连接 API Key
            </button>
            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              className="mt-6 text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
              rel="noreferrer"
            >
              查看计费文档 <ArrowUpDown size={12} className="rotate-90" />
            </a>
          </div>
        )}

        {selectedJob ? (
          <div className="flex h-full">
            <div
              className={`flex-1 overflow-y-auto p-6 space-y-6 transition-all duration-300 ${isChatOpen ? 'mr-[400px]' : ''}`}
            >
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border border-slate-200 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleFavorite(selectedJob.id)} className="p-1">
                      <Star
                        size={24}
                        className={`${selectedJob.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
                      />
                    </button>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg uppercase tracking-widest">
                      {selectedJob.status}
                    </span>
                    {selectedJob.url && (
                      <a
                        href={selectedJob.url}
                        target="_blank"
                        className="text-xs text-indigo-600 font-bold hover:underline"
                        rel="noreferrer"
                      >
                        网页直达
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsChatOpen(!isChatOpen)}
                      className={`p-2.5 rounded-xl transition-all ${isChatOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
                    >
                      <MessageSquare size={18} />
                    </button>
                    <button
                      onClick={() => handleDeepAudit(selectedJob)}
                      disabled={isAuditing}
                      className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-indigo-700 shadow-xl disabled:opacity-50 transition-all"
                    >
                      {isAuditing ? (
                        <RefreshCw className="animate-spin" size={16} />
                      ) : (
                        <Brain size={16} />
                      )}{' '}
                      启动 Pro 天命审计
                    </button>
                  </div>
                </div>

                {selectedJob.analysis ? (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Sparkles size={160} />
                      </div>
                      <div className="flex items-center gap-10 relative z-10">
                        <div className="text-center shrink-0">
                          <div className="text-8xl font-black text-yellow-400">
                            {selectedHasInsufficientData
                              ? '—'
                              : (selectedJob.analysis.score ?? '—')}
                          </div>
                          <div className="text-[10px] font-black tracking-[0.3em] text-indigo-400 mt-2">
                            {selectedHasInsufficientData ? 'DATA LIMITED' : 'DESTINY SCORE'}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-yellow-400">审计仪表盘</h2>
                            {selectedJob.analysis.hexagram && (
                              <span className="px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold border border-white/20">
                                {selectedJob.analysis.hexagram}
                              </span>
                            )}
                          </div>
                          <p className="text-xl leading-relaxed italic font-medium text-white/90">
                            "{selectedJob.analysis.summary}"
                          </p>
                          <div
                            className={`inline-block px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${selectedJob.analysis.judgment.includes('强烈推荐') ? 'bg-emerald-500' : selectedJob.analysis.judgment.includes('谨慎尝试') ? 'bg-amber-500' : 'bg-rose-500'}`}
                          >
                            {selectedJob.analysis.judgment}
                          </div>
                        </div>
                      </div>
                    </div>

                    <ApplyAssistantPanel
                      job={selectedJob}
                      applyProfile={userCtx.preferences.applyProfile}
                      recommendedResume={selectedJob.analysis.recommended_resume}
                      activeResumeId={userCtx.activeResumeId}
                      resumes={userCtx.resumes}
                      onSwitchResume={switchActiveResume}
                      onOpenApplyProfile={() => openProfileModal('apply')}
                    />

                    {selectedMatchScore && (
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <ListChecks size={18} /> Code Scoring Engine
                          </h4>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
                            {selectedMatchScore.rubricVersion} / {selectedMatchScore.scoringVersion}
                          </span>
                        </div>
                        {selectedHasInsufficientData && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-relaxed text-amber-800">
                            信息不足：{selectedUnknownPercent}% 的评分维度仍是
                            unknown。本结果适合做线索排查，不适合当作确定排序。
                          </div>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                          {selectedMatchScore.dimensions.map((dimension) => (
                            <div
                              key={dimension.key}
                              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-black text-slate-700">
                                  {dimension.label}
                                </span>
                                <span className="text-xs font-black text-indigo-600">
                                  {dimension.score ?? 'unknown'}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {dimension.confidence}
                                {dimension.hardFail ? ' / hard fail' : ''}
                              </div>
                              {dimension.warnings[0] && (
                                <div className="mt-2 text-xs font-medium text-amber-700">
                                  {dimension.warnings[0]}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedMatchScore?.resumeBreakdown && (
                      <ResumeMatchBreakdownCard
                        breakdown={selectedMatchScore.resumeBreakdown}
                        activeResumeId={userCtx.activeResumeId}
                        onSwitchResume={switchActiveResume}
                      />
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white p-8 rounded-[2rem] border-l-8 border-emerald-500 shadow-sm space-y-4">
                        <h4 className="text-emerald-700 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 size={18} /> 顺势而为 (Pros)
                        </h4>
                        <ul className="space-y-3">
                          {selectedJob.analysis.detailed_analysis.pros.map((p, i) => (
                            <li key={i} className="text-sm text-slate-600 flex gap-3">
                              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 shrink-0" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-white p-8 rounded-[2rem] border-l-8 border-rose-500 shadow-sm space-y-4">
                        <h4 className="text-rose-700 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                          <AlertCircle size={18} /> 致命风险 (Cons)
                        </h4>
                        <ul className="space-y-3">
                          {selectedJob.analysis.detailed_analysis.cons.map((c, i) => (
                            <li key={i} className="text-sm text-slate-600 flex gap-3">
                              <div className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-2 shrink-0" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-indigo-900 p-8 rounded-[2rem] text-white shadow-lg space-y-4">
                        <h4 className="text-indigo-300 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp size={16} /> 职业发展路径
                        </h4>
                        <p className="text-sm leading-relaxed opacity-90">
                          {selectedJob.analysis.career_growth}
                        </p>
                      </div>
                      <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-lg space-y-4">
                        <h4 className="text-yellow-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                          <Target size={16} /> 面试必杀技
                        </h4>
                        <p className="text-sm leading-relaxed opacity-90">
                          {selectedJob.analysis.interview_tactics}
                        </p>
                      </div>
                      <div className="bg-rose-950 p-8 rounded-[2rem] text-white shadow-lg space-y-4 border border-rose-500/20">
                        <h4 className="text-rose-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                          <ShieldAlert size={16} /> 合同避坑红线
                        </h4>
                        <p className="text-sm leading-relaxed opacity-90">
                          {selectedJob.analysis.contract_red_flags}
                        </p>
                      </div>
                    </div>

                    <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100 shadow-inner">
                      <h4 className="text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Zap size={18} /> 2026 流年真相预演
                      </h4>
                      <p className="text-lg leading-relaxed text-indigo-950 font-medium italic">
                        "{selectedJob.analysis.cruel_truth_2026}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-20 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center space-y-4 shadow-inner">
                    <Brain size={60} className="mx-auto text-slate-200 mb-2" />
                    <h3 className="font-black text-slate-400 text-xl">等待 Pro 引擎指令</h3>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">
                      点击按钮开启由紫微斗数、八字、六爻交叉验证的深度天命审计。如果反复失败，请检查
                      API Key 状态。
                    </p>
                  </div>
                )}

                <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
                      {selectedJob.title}
                    </h2>
                    <p className="text-indigo-600 font-black text-lg flex items-center gap-2">
                      <Building2 size={24} /> {selectedJob.company}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-3xl font-mono text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto border shadow-inner scrollbar-thin">
                    {selectedJob.content}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Drawer */}
            <div
              className={`absolute right-0 top-0 h-full w-[400px] bg-white border-l shadow-2xl transition-all duration-300 z-30 flex flex-col ${isChatOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
            >
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <MessageSquare size={18} /> AI 职业顾问
                </h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {selectedJob.chatHistory?.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-800 border'}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="text-[10px] text-slate-400 animate-pulse italic px-2">
                    正在结合命主档案进行深度推演...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-6 bg-white border-t space-y-3">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="询问面试、简历或破局点..."
                    className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    disabled={!chatInput.trim() || isChatting}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-200 p-12 text-center">
            <div className="w-64 h-64 bg-white rounded-full flex items-center justify-center shadow-xl mb-10 border-[12px] border-slate-50 group hover:scale-105 transition-transform duration-500">
              <Sparkles
                size={80}
                className="text-indigo-50 group-hover:text-indigo-100 transition-colors"
              />
            </div>
            <h2 className="text-2xl font-black text-slate-400 tracking-tighter">
              选定一个职位开启天命审计
            </h2>
            <p className="text-slate-400 mt-4 max-w-sm italic">"每一份 JD 都将被剥去伪装。"</p>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-2xl text-slate-900 flex items-center gap-3">
                <User size={28} className="text-indigo-600" /> 命主核心档案
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResumeModal(true)}
                  className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2 text-xs font-bold shadow-sm"
                >
                  <Upload size={16} /> 管理简历
                </button>
                {!USES_PROXY && (
                  <button
                    onClick={handleSelectKey}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2 text-xs font-bold shadow-sm"
                  >
                    <Key size={16} /> 刷新 API Key
                  </button>
                )}
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={28} />
                </button>
              </div>
            </div>
            <div className="border-b bg-white px-8 pt-5">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { id: 'profile' as const, label: '基础档案' },
                  { id: 'apply' as const, label: '投递助手' },
                  { id: 'personas' as const, label: 'Persona' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setProfileTab(tab.id)}
                    className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${profileTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
              {profileTab === 'profile' ? (
                <>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      命主姓名
                    </label>
                    <input
                      value={editCtx.preferences.displayName}
                      onChange={(e) => updateEditPrefs({ displayName: e.target.value })}
                      className="w-full border-2 border-slate-100 p-5 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      教育、硬核技能与现实背景
                    </label>
                    <textarea
                      value={editCtx.preferences.backgroundSummary}
                      onChange={(e) => updateEditPrefs({ backgroundSummary: e.target.value })}
                      className="w-full border-2 border-slate-100 p-5 rounded-3xl text-sm h-32 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      命理特征与 2026 流年避讳
                    </label>
                    <textarea
                      value={editCtx.preferences.astrologyProfile}
                      onChange={(e) => updateEditPrefs({ astrologyProfile: e.target.value })}
                      className="w-full border-2 border-slate-100 p-5 rounded-3xl text-sm h-32 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      择业偏好与限制条件
                    </label>
                    <input
                      value={editCtx.preferences.jobPreferences}
                      onChange={(e) => updateEditPrefs({ jobPreferences: e.target.value })}
                      className="w-full border-2 border-slate-100 p-5 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        期望薪资下限
                      </label>
                      <input
                        type="number"
                        value={salaryMinDraft}
                        onChange={(e) => updateSalaryRange('min', e.target.value)}
                        className="w-full border-2 border-slate-100 p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        期望薪资上限
                      </label>
                      <input
                        type="number"
                        value={salaryMaxDraft}
                        onChange={(e) => updateSalaryRange('max', e.target.value)}
                        className="w-full border-2 border-slate-100 p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  {salaryRangeError && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                      {salaryRangeError}
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        工作模式
                      </label>
                      <select
                        value={editCtx.preferences.workMode ?? 'any'}
                        onChange={(e) =>
                          updateEditPrefs({
                            workMode: e.target.value as UserPreferences['workMode'],
                          })
                        }
                        className="w-full border-2 border-slate-100 bg-white p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="any">Any</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="onsite">Onsite</option>
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        偏好地点
                      </label>
                      <input
                        value={joinListInput(editCtx.preferences.preferredLocations)}
                        onChange={(e) =>
                          updateEditPrefs({ preferredLocations: splitListInput(e.target.value) })
                        }
                        className="w-full border-2 border-slate-100 p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      避开关键词
                    </label>
                    <input
                      value={joinListInput(editCtx.preferences.avoidKeywords)}
                      onChange={(e) =>
                        updateEditPrefs({ avoidKeywords: splitListInput(e.target.value) })
                      }
                      className="w-full border-2 border-slate-100 p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </>
              ) : profileTab === 'apply' ? (
                <div className="space-y-8">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="font-black text-indigo-950">投递助手 · 常用字段</h4>
                        <p className="mt-1 text-xs font-medium text-indigo-700">
                          只用于本地复制。不会自动填表，不会自动提交，也不会调用 Gemini。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={prefillApplyProfileFromActiveResume}
                        disabled={!editCtx.activeResumeId}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        从激活简历预填
                      </button>
                    </div>
                    {isApplyProfileEmpty(editingApplyProfile) && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                        当前没有投递档案。可以手动填写，或先在简历管理中选择 active
                        简历后预填基础信息。
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ApplyInput
                      label="Full name"
                      value={editingApplyProfile.fullName ?? ''}
                      onChange={(value) => updateApplyProfile({ fullName: value })}
                    />
                    <ApplyInput
                      label="Email"
                      value={editingApplyProfile.email ?? ''}
                      onChange={(value) => updateApplyProfile({ email: value })}
                    />
                    <ApplyInput
                      label="Phone"
                      value={editingApplyProfile.phone ?? ''}
                      onChange={(value) => updateApplyProfile({ phone: value })}
                    />
                    <ApplyInput
                      label="Location"
                      value={editingApplyProfile.location ?? ''}
                      onChange={(value) => updateApplyProfile({ location: value })}
                    />
                    <ApplyInput
                      label="LinkedIn"
                      value={editingApplyProfile.linkedIn ?? ''}
                      onChange={(value) => updateApplyProfile({ linkedIn: value })}
                    />
                    <ApplyInput
                      label="GitHub"
                      value={editingApplyProfile.github ?? ''}
                      onChange={(value) => updateApplyProfile({ github: value })}
                    />
                    <ApplyInput
                      label="Portfolio"
                      value={editingApplyProfile.portfolio ?? ''}
                      onChange={(value) => updateApplyProfile({ portfolio: value })}
                    />
                    <ApplyInput
                      label="Work authorization"
                      value={editingApplyProfile.workAuthStatus ?? ''}
                      onChange={(value) => updateApplyProfile({ workAuthStatus: value })}
                    />
                    <ApplyInput
                      label="Years of experience"
                      value={editingApplyProfile.yearsExperience ?? ''}
                      onChange={(value) => updateApplyProfile({ yearsExperience: value })}
                    />
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Willing to relocate
                      </label>
                      <select
                        value={editingApplyProfile.willingToRelocate ?? ''}
                        onChange={(event) =>
                          updateApplyProfile({
                            willingToRelocate:
                              event.target.value === ''
                                ? undefined
                                : (event.target.value as ApplyProfile['willingToRelocate']),
                          })
                        }
                        className="w-full border-2 border-slate-100 bg-white p-4 rounded-2xl text-sm focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="">未填写</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                        <option value="depends">Depends</option>
                      </select>
                    </div>
                    <ApplyInput
                      label="Earliest start date"
                      value={editingApplyProfile.earliestStartDate ?? ''}
                      onChange={(value) => updateApplyProfile({ earliestStartDate: value })}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Email signature
                    </label>
                    <textarea
                      value={editingApplyProfile.signature ?? ''}
                      onChange={(event) => updateApplyProfile({ signature: event.target.value })}
                      className="w-full border-2 border-slate-100 p-5 rounded-3xl text-sm h-28 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          Saved answers
                        </label>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          用户手写模板，最多 {MAX_SAVED_ANSWERS} 条。邮件模式可选择其中一条。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addSavedAnswer}
                        disabled={!canAddSavedAnswer}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={14} /> 新增模板
                      </button>
                    </div>

                    {editingSavedAnswers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                        暂无 saved answer。常用的 Why this company / Why good fit
                        可以放这里，投递时直接复制进邮件。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {editingSavedAnswers.map((answer, index) => (
                          <div
                            key={answer.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-black text-slate-400">
                                模板 {index + 1}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSavedAnswer(answer.id)}
                                className="text-xs font-black text-rose-500 hover:text-rose-600"
                              >
                                删除
                              </button>
                            </div>
                            <input
                              value={answer.label}
                              onChange={(event) =>
                                updateSavedAnswer(answer.id, { label: event.target.value })
                              }
                              placeholder="例如：Why interested in startup?"
                              className="w-full border-2 border-white bg-white p-3 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all"
                            />
                            <textarea
                              value={answer.content}
                              onChange={(event) =>
                                updateSavedAnswer(answer.id, { content: event.target.value })
                              }
                              placeholder="粘贴你自己写好的通用回答。这里不会 AI 润色。"
                              className="w-full border-2 border-white bg-white p-3 rounded-xl text-sm h-28 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <PersonaSection ctx={editCtx} onChange={setEditCtx} />
              )}
            </div>
            <div className="p-8 border-t bg-slate-50 flex justify-end">
              <button
                onClick={() => saveProfileData(editCtx)}
                className="px-12 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-2xl hover:bg-slate-800 transition-all"
              >
                保存档案并同步审计逻辑
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasteJobModal && (
        <PasteJobModal onClose={() => setShowPasteJobModal(false)} onSubmit={handlePasteJob} />
      )}

      {/* Resume Modal */}
      <ResumeModal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        ctx={userCtx}
        onSave={(newCtx) => {
          persistUserContext({
            resumes: newCtx.resumes,
            activeResumeId: newCtx.activeResumeId,
          });
        }}
        onApplyProfileSuggestions={(preferences) => {
          persistUserContext({ preferences });
        }}
      />
    </div>
  );
};

export default App;
