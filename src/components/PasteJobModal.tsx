import React, { useState } from 'react';
import { ClipboardPaste, X } from 'lucide-react';
import type { JobImportInput } from '../../services/jobImport';

interface PasteJobModalProps {
  onClose: () => void;
  /** 返回错误提示则留在弹窗里显示；返回 null 表示已处理，弹窗关闭。 */
  onSubmit: (input: JobImportInput) => string | null;
}

const EMPTY_FORM = { content: '', title: '', company: '', url: '' };

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500';

/** 由父组件条件渲染：每次打开都是新挂载，表单自然清空。 */
export const PasteJobModal = ({ onClose, onSubmit }: PasteJobModalProps) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const update = (field: keyof typeof EMPTY_FORM) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = onSubmit(form);
    if (message) setError(message);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <ClipboardPaste size={18} className="text-indigo-600" /> 粘贴一个 JD
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-1 hover:bg-slate-200 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">JD 正文 *</span>
            <textarea
              autoFocus
              value={form.content}
              onChange={(e) => update('content')(e.target.value)}
              placeholder="把招聘页上的职位描述整段复制过来。第一行会默认当作岗位名。"
              className={`${inputClass} mt-1 h-64 resize-y font-mono text-xs`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-600">岗位名（可选）</span>
              <input
                value={form.title}
                onChange={(e) => update('title')(e.target.value)}
                placeholder="留空则取正文第一行"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600">公司（可选）</span>
              <input
                value={form.company}
                onChange={(e) => update('company')(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">链接（可选）</span>
            <input
              value={form.url}
              onChange={(e) => update('url')(e.target.value)}
              placeholder="https://"
              className={`${inputClass} mt-1`}
            />
          </label>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!form.content.trim()}
            className="px-4 py-2 rounded-lg text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30"
          >
            加入岗位列表
          </button>
        </div>
      </form>
    </div>
  );
};
