import { useState, type FC } from 'react';
import type { PersonaInstance } from '../../types';
import type { PersonaPlugin } from './PersonaPlugin';
import { listPersonasByCategory } from './registry';

interface PersonasSectionProps {
  personas: PersonaInstance[];
  activeIds: string[];
  onChange: (next: { personas: PersonaInstance[]; activeIds: string[] }) => void;
}

interface PluginRowProps {
  plugin: PersonaPlugin;
  instance: PersonaInstance | undefined;
  active: boolean;
  onToggle: () => void;
  onUpdate: (data: unknown) => void;
}

const PluginRow: FC<PluginRowProps> = ({ plugin, instance, active, onToggle, onUpdate }) => {
  const FormComponent = plugin.formComponent as FC<{
    value: unknown;
    onChange: (next: unknown) => void;
  }>;

  return (
    <div className="rounded-2xl border-2 border-slate-100 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={active}
          onChange={onToggle}
          className="mt-1 h-4 w-4 accent-indigo-600"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">{plugin.name}</span>
            {plugin.tokenHint && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {plugin.tokenHint}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">{plugin.description}</div>
        </div>
      </label>
      {active && instance && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <FormComponent value={instance.data} onChange={onUpdate} />
        </div>
      )}
    </div>
  );
};

export function PersonasSection({ personas, activeIds, onChange }: PersonasSectionProps) {
  const corePlugins = listPersonasByCategory('core');
  const esotericPlugins = listPersonasByCategory('esoteric');
  const [showEsoteric, setShowEsoteric] = useState(false);

  const isActive = (pluginId: string) => activeIds.includes(pluginId);
  const getInstance = (pluginId: string) => personas.find((p) => p.type === pluginId);

  const togglePlugin = (plugin: PersonaPlugin) => {
    if (isActive(plugin.id)) {
      onChange({
        personas,
        activeIds: activeIds.filter((id) => id !== plugin.id),
      });
      return;
    }
    const existing = getInstance(plugin.id);
    const nextPersonas = existing
      ? personas
      : [
          ...personas,
          {
            id: plugin.id,
            type: plugin.id,
            label: plugin.name,
            data: plugin.emptyData() as Record<string, unknown>,
            createdAt: new Date().toISOString(),
          },
        ];
    onChange({
      personas: nextPersonas,
      activeIds: [...activeIds, plugin.id],
    });
  };

  const updateData = (pluginId: string, newData: unknown) => {
    onChange({
      personas: personas.map((p) =>
        p.type === pluginId ? { ...p, data: newData as Record<string, unknown> } : p,
      ),
      activeIds,
    });
  };

  const renderRow = (plugin: PersonaPlugin) => (
    <PluginRow
      key={plugin.id}
      plugin={plugin}
      instance={getInstance(plugin.id)}
      active={isActive(plugin.id)}
      onToggle={() => togglePlugin(plugin)}
      onUpdate={(data) => updateData(plugin.id, data)}
    />
  );

  return (
    <div className="space-y-3">
      {corePlugins.map(renderRow)}

      <label className="flex cursor-pointer items-center gap-2 px-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={showEsoteric}
          onChange={(e) => setShowEsoteric(e.target.checked)}
          className="h-3 w-3 accent-indigo-600"
        />
        显示玄学画像（紫微斗数等）
      </label>

      {showEsoteric && esotericPlugins.map(renderRow)}
    </div>
  );
}
