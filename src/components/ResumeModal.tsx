import { useState } from 'react';
import { X } from 'lucide-react';
import type { UserContext, ResumeProfile, ResumeStructured } from '../../types';
import { parseResumeFile, parseResumeText } from '../../services/resumeParser';

type TabType = 'upload' | 'review' | 'settings';
type UploadState = 'idle' | 'loading' | 'error' | 'success';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctx: UserContext;
  onSave: (newCtx: UserContext) => void;
}

export function ResumeModal({ isOpen, onClose, ctx, onSave }: ResumeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [structured, setStructured] = useState<ResumeStructured | null>(null);
  const [retryText, setRetryText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    setUploadState('loading');
    setErrorMessage('');
    setFileName(file.name);

    const result = await parseResumeFile(file);

    if (result.status === 'ok') {
      setStructured(result.data);
      setRetryText('');
      setUploadState('success');
      setActiveTab('review');
    } else {
      setUploadState('error');
      setErrorMessage(result.message);
      setRetryText('');
    }
  };

  const handleTextRetry = async () => {
    if (!retryText.trim()) {
      setErrorMessage('请输入简历内容');
      return;
    }

    setUploadState('loading');
    setErrorMessage('');

    const result = await parseResumeText(retryText);

    if (result.status === 'ok') {
      setStructured(result.data);
      setErrorMessage('');
      setUploadState('success');
      setActiveTab('review');
    } else {
      setUploadState('error');
      setErrorMessage(`文本解析失败：${result.message}`);
    }
  };

  const handleSave = () => {
    if (!structured) return;

    const newResume: ResumeProfile = {
      id: `resume-${crypto.randomUUID()}`,
      label: fileName || '简历 1',
      structured,
      piiPolicy: 'keep',
      createdAt: new Date().toISOString(),
    };

    const newCtx: UserContext = {
      ...ctx,
      resumes: [newResume],
      activeResumeId: newResume.id,
    };

    onSave(newCtx);
    resetModal();
    onClose();
  };

  const resetModal = () => {
    setActiveTab('upload');
    setUploadState('idle');
    setErrorMessage('');
    setFileName('');
    setStructured(null);
    setRetryText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">简历管理</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium ${activeTab === 'upload' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            上传
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 font-medium ${activeTab === 'review' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            disabled={!structured}
          >
            审阅
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'upload' && (
            <UploadTab
              state={uploadState}
              error={errorMessage}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              retryText={retryText}
              onRetryTextChange={setRetryText}
              onTextRetry={handleTextRetry}
            />
          )}

          {activeTab === 'review' && structured && (
            <ReviewTab structured={structured} onStructuredChange={setStructured} />
          )}
        </div>

        {/* Footer */}
        {activeTab === 'review' && structured && (
          <div className="border-t p-4 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface UploadTabProps {
  state: UploadState;
  error: string;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  retryText: string;
  onRetryTextChange: (text: string) => void;
  onTextRetry: () => void;
}

function UploadTab({
  state,
  error,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  retryText,
  onRetryTextChange,
  onTextRetry,
}: UploadTabProps) {
  return (
    <div className="space-y-4">
      {state === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}

      {state === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {state !== 'loading' && (
        <>
          {/* File Upload Area */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          >
            <div className="space-y-2">
              <p className="text-gray-600">拖拽文件到此处或点击选择</p>
              <p className="text-sm text-gray-500">支持：PDF、DOCX、PNG、JPG、WEBP、纯文本</p>
              <input
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt"
                onChange={(e) => e.target.files && onFileSelect(e.target.files[0])}
                className="hidden"
                id="resume-file-input"
              />
              <label
                htmlFor="resume-file-input"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                选择文件
              </label>
            </div>
          </div>

          {/* Text Fallback */}
          {state === 'error' && (
            <div className="space-y-3 border rounded p-4 bg-gray-50">
              <p className="text-sm font-medium">文本粘贴重试</p>
              <textarea
                value={retryText}
                onChange={(e) => onRetryTextChange(e.target.value)}
                placeholder="在此粘贴简历文本内容..."
                className="w-full h-32 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={onTextRetry}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                用文本重试
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ReviewTabProps {
  structured: ResumeStructured;
  onStructuredChange: (structured: ResumeStructured) => void;
}

function ReviewTab({ structured, onStructuredChange }: ReviewTabProps) {
  const updateBasic = (field: keyof typeof structured.basic, value: string) => {
    onStructuredChange({
      ...structured,
      basic: { ...structured.basic, [field]: value },
    });
  };

  const updateEducation = (
    index: number,
    field: keyof (typeof structured.education)[0],
    value: string,
  ) => {
    const newEducation = [...structured.education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    onStructuredChange({ ...structured, education: newEducation });
  };

  const updateExperience = (
    index: number,
    field: keyof (typeof structured.experience)[0],
    value: string | string[],
  ) => {
    const newExperience = [...structured.experience];
    newExperience[index] = { ...newExperience[index], [field]: value };
    onStructuredChange({ ...structured, experience: newExperience });
  };

  const updateSkills = (category: keyof typeof structured.skills, skills: string[]) => {
    onStructuredChange({
      ...structured,
      skills: { ...structured.skills, [category]: skills },
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <section>
        <h3 className="text-sm font-semibold mb-3">基本信息</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={structured.basic.name || ''}
            onChange={(e) => updateBasic('name', e.target.value)}
            placeholder="姓名"
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            value={structured.basic.email || ''}
            onChange={(e) => updateBasic('email', e.target.value)}
            placeholder="邮箱"
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            value={structured.basic.phone || ''}
            onChange={(e) => updateBasic('phone', e.target.value)}
            placeholder="电话"
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={structured.basic.location || ''}
            onChange={(e) => updateBasic('location', e.target.value)}
            placeholder="城市"
            className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* Summary */}
      {structured.summary !== undefined && (
        <section>
          <h3 className="text-sm font-semibold mb-3">职业总结</h3>
          <textarea
            value={structured.summary}
            onChange={(e) => onStructuredChange({ ...structured, summary: e.target.value })}
            placeholder="职业总结或核心亮点"
            className="w-full h-20 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>
      )}

      {/* Education */}
      <section>
        <h3 className="text-sm font-semibold mb-3">教育经历</h3>
        <div className="space-y-3">
          {structured.education.map((edu, idx) => (
            <div key={idx} className="p-3 border rounded bg-gray-50 space-y-2">
              <input
                type="text"
                value={edu.school}
                onChange={(e) => updateEducation(idx, 'school', e.target.value)}
                placeholder="学校"
                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                  placeholder="学位"
                  className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={edu.major}
                  onChange={(e) => updateEducation(idx, 'major', e.target.value)}
                  placeholder="专业"
                  className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="text"
                value={edu.years}
                onChange={(e) => updateEducation(idx, 'years', e.target.value)}
                placeholder="年份 (YYYY-YYYY)"
                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {edu.gpa && (
                <input
                  type="text"
                  value={edu.gpa}
                  onChange={(e) => updateEducation(idx, 'gpa', e.target.value)}
                  placeholder="GPA"
                  className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Experience */}
      <section>
        <h3 className="text-sm font-semibold mb-3">工作经历</h3>
        <div className="space-y-3">
          {structured.experience.map((exp, idx) => (
            <div key={idx} className="p-3 border rounded bg-gray-50 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                  placeholder="公司"
                  className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={exp.title}
                  onChange={(e) => updateExperience(idx, 'title', e.target.value)}
                  placeholder="职位"
                  className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="text"
                value={exp.period}
                onChange={(e) => updateExperience(idx, 'period', e.target.value)}
                placeholder="时期"
                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={exp.bullets.join('\n')}
                onChange={(e) => updateExperience(idx, 'bullets', e.target.value.split('\n'))}
                placeholder="工作亮点(每行一条)"
                className="w-full h-16 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section>
        <h3 className="text-sm font-semibold mb-3">技能</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">硬技能</label>
            <input
              type="text"
              value={structured.skills.hard.join(', ')}
              onChange={(e) =>
                updateSkills(
                  'hard',
                  e.target.value.split(',').map((s) => s.trim()),
                )
              }
              placeholder="技能1, 技能2..."
              className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">软技能</label>
            <input
              type="text"
              value={structured.skills.soft.join(', ')}
              onChange={(e) =>
                updateSkills(
                  'soft',
                  e.target.value.split(',').map((s) => s.trim()),
                )
              }
              placeholder="技能1, 技能2..."
              className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">语言</label>
            <input
              type="text"
              value={structured.skills.languages.join(', ')}
              onChange={(e) =>
                updateSkills(
                  'languages',
                  e.target.value.split(',').map((s) => s.trim()),
                )
              }
              placeholder="语言1, 语言2..."
              className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">工具平台</label>
            <input
              type="text"
              value={structured.skills.tools.join(', ')}
              onChange={(e) =>
                updateSkills(
                  'tools',
                  e.target.value.split(',').map((s) => s.trim()),
                )
              }
              placeholder="工具1, 工具2..."
              className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Projects */}
      {structured.projects.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">项目</h3>
          <div className="space-y-3">
            {structured.projects.map((proj, idx) => (
              <div key={idx} className="p-3 border rounded bg-gray-50 space-y-2">
                <input
                  type="text"
                  defaultValue={proj.name}
                  placeholder="项目名"
                  className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  defaultValue={proj.bullets.join('\n')}
                  placeholder="项目亮点(每行一条)"
                  className="w-full h-12 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
