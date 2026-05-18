import { useState, type ComponentType } from 'react';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { PersonaInstance, UserContext } from '../../types';
import { listPersonasByCategory, type PersonaFormProps, type PersonaPlugin } from '../personas';

interface PersonaSectionProps {
  ctx: UserContext;
  onChange: (next: UserContext) => void;
}

interface PersonaEditorProps {
  instance: PersonaInstance;
  plugin: PersonaPlugin;
  active: boolean;
  onToggleActive: (id: string, active: boolean) => void;
  onRename: (id: string, label: string) => void;
  onDataChange: (id: string, data: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function PersonaEditor({
  instance,
  plugin,
  active,
  onToggleActive,
  onRename,
  onDataChange,
  onRemove,
}: PersonaEditorProps) {
  const parsed = plugin.schema.safeParse(instance.data);
  const value = asRecord(parsed.success ? parsed.data : plugin.emptyData());
  const FormComponent = plugin.formComponent as ComponentType<
    PersonaFormProps<Record<string, unknown>>
  >;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2">
          <input
            value={instance.label}
            onChange={(e) => onRename(instance.id, e.target.value)}
            className="w-full rounded-xl border-2 border-slate-100 px-3 py-2 text-sm font-bold text-slate-800 outline-none transition-all focus:border-indigo-500"
            aria-label={`${plugin.name} label`}
          />
        </label>
        <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onToggleActive(instance.id, e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          启用
        </label>
        <button
          type="button"
          onClick={() => onRemove(instance.id)}
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
          title="Delete persona"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {!parsed.success && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          当前档案数据与插件 schema 不兼容，修改后会按最新 schema 保存。
        </div>
      )}
      <FormComponent value={value} onChange={(next) => onDataChange(instance.id, next)} />
    </div>
  );
}

export function PersonaSection({ ctx, onChange }: PersonaSectionProps) {
  const [showEsoteric, setShowEsoteric] = useState(() =>
    ctx.personas.some((persona) => persona.type === 'ziwei'),
  );

  const updatePersonas = (personas: PersonaInstance[], activePersonaIds = ctx.activePersonaIds) => {
    const existingIds = new Set(personas.map((persona) => persona.id));
    onChange({
      ...ctx,
      personas,
      activePersonaIds: unique(activePersonaIds).filter((id) => existingIds.has(id)),
    });
  };

  const addPersona = (plugin: PersonaPlugin) => {
    let suffix = ctx.personas.length + 1;
    let id = `${plugin.id}-${suffix}`;
    while (ctx.personas.some((persona) => persona.id === id)) {
      suffix += 1;
      id = `${plugin.id}-${suffix}`;
    }

    const instance: PersonaInstance = {
      id,
      type: plugin.id,
      label: plugin.name,
      data: asRecord(plugin.emptyData()),
      createdAt: new Date().toISOString(),
    };
    updatePersonas([...ctx.personas, instance], [...ctx.activePersonaIds, id]);
  };

  const renamePersona = (id: string, label: string) => {
    updatePersonas(
      ctx.personas.map((persona) => (persona.id === id ? { ...persona, label } : persona)),
    );
  };

  const updatePersonaData = (id: string, data: Record<string, unknown>) => {
    updatePersonas(
      ctx.personas.map((persona) => (persona.id === id ? { ...persona, data } : persona)),
    );
  };

  const toggleActive = (id: string, active: boolean) => {
    onChange({
      ...ctx,
      activePersonaIds: active
        ? unique([...ctx.activePersonaIds, id])
        : ctx.activePersonaIds.filter((activeId) => activeId !== id),
    });
  };

  const removePersona = (id: string) => {
    updatePersonas(
      ctx.personas.filter((persona) => persona.id !== id),
      ctx.activePersonaIds.filter((activeId) => activeId !== id),
    );
  };

  const renderPlugin = (plugin: PersonaPlugin) => {
    const instances = ctx.personas.filter((persona) => persona.type === plugin.id);

    return (
      <section key={plugin.id} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-900">{plugin.name}</h4>
              {plugin.tokenHint && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                  {plugin.tokenHint}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">{plugin.description}</p>
          </div>
          <button
            type="button"
            onClick={() => addPersona(plugin)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus size={14} /> 添加
          </button>
        </div>

        {instances.map((instance) => (
          <PersonaEditor
            key={instance.id}
            instance={instance}
            plugin={plugin}
            active={ctx.activePersonaIds.includes(instance.id)}
            onToggleActive={toggleActive}
            onRename={renamePersona}
            onDataChange={updatePersonaData}
            onRemove={removePersona}
          />
        ))}
      </section>
    );
  };

  const corePersonas = listPersonasByCategory('core');
  const esotericPersonas = listPersonasByCategory('esoteric');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">
              已启用画像：{ctx.activePersonaIds.length}
            </div>
            <div className="text-xs font-medium text-slate-500">
              核心画像会进入提示词；紫微等玄学画像保持显式开启。
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
          <input
            type="checkbox"
            checked={showEsoteric}
            onChange={(e) => setShowEsoteric(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          紫微
        </label>
      </div>

      <div className="space-y-8">{corePersonas.map(renderPlugin)}</div>

      {showEsoteric && (
        <div className="space-y-8 border-t border-slate-200 pt-8">
          {esotericPersonas.map(renderPlugin)}
        </div>
      )}
    </div>
  );
}
