import type { RegistryTemplatePreset } from "../../constants/registryTemplates";
import type { ThemeMode } from "../../types/workflow";

type Props = {
  theme: ThemeMode;
  onSelectTheme: (mode: ThemeMode) => void;
  onClearSelection: () => void;
  registryTemplates?: RegistryTemplatePreset[];
  activeRegistryTemplateId?: string | null;
  onApplyRegistryTemplate?: (id: string) => void;
  onClearRegistryTemplate?: () => void;
  hasRegistryTemplate?: boolean;
  activeRegistryLabel?: string | null;
};

export default function SettingsPanel({
  theme,
  onSelectTheme,
  onClearSelection,
  registryTemplates,
  activeRegistryTemplateId,
  onApplyRegistryTemplate,
  onClearRegistryTemplate,
  hasRegistryTemplate,
  activeRegistryLabel,
}: Props) {
  const activeTemplate = registryTemplates?.find((preset) => preset.id === activeRegistryTemplateId);
  const canClearRegistry = hasRegistryTemplate ?? Boolean(activeRegistryTemplateId);
  const registryLabel = activeRegistryLabel ?? activeTemplate?.name ?? (canClearRegistry ? "Custom template" : null);

  return (
    <div className="mt-4 space-y-5 text-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Theme</p>
        <div className="flex items-center gap-2">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                theme === mode
                  ? "bg-slate-900 text-white border-slate-700 shadow-sm"
                  : "bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => onSelectTheme(mode)}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  mode === "light" ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              {mode === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Links</p>
        <div className="flex flex-wrap gap-2">
          {["Docs", "Changelog", "Support"].map((label) => (
            <button
              key={label}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={onClearSelection}
            >
              Add {label} link
            </button>
          ))}
        </div>
      </div>

      {registryTemplates?.length ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Registry templates</p>
          <div className="flex flex-col gap-2">
            {registryTemplates.map((preset) => {
              const isActive = preset.id === activeRegistryTemplateId;
              return (
                <button
                  key={preset.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                      : "border-slate-200 bg-white/80 text-slate-800 hover:bg-slate-50"
                  }`}
                  onClick={() => onApplyRegistryTemplate?.(preset.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{preset.name}</span>
                    {isActive && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Active
                      </span>
                    )}
                  </div>
                  {preset.description && (
                    <p className="mt-1 text-xs leading-snug text-slate-600">{preset.description}</p>
                  )}
                </button>
              );
            })}
            {onClearRegistryTemplate && (
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onClearRegistryTemplate}
                  disabled={!canClearRegistry}
                >
                  Clear registry template
                </button>
                {registryLabel && (
                  <span className="text-xs text-slate-600">Using {registryLabel}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
