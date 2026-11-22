import React, { useEffect, useState } from 'react';
import { Download, Gamepad2, Keyboard, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { createDefaultConfig } from '../shared/engine';
import type {
  DisplayPresetId,
  EvolConfig,
  LightingEffectId,
  MacroDefinition,
  PerformanceModeId,
  TelemetrySnapshot,
} from '../shared/types';

interface ProfilesAndPeripheralsViewProps {
  section: 'profiles' | 'keyboard-macros' | 'display';
  telemetry: TelemetrySnapshot;
  config: EvolConfig;
  onSaveConfig: (patch: Partial<EvolConfig>) => Promise<{ ok: boolean; error?: string }>;
  onSwitchMode: (mode: PerformanceModeId) => Promise<void>;
  onDisplayPreviewChange: (filterCss: string | null) => void;
}

const DISPLAY_PRESETS: Record<
  Exclude<DisplayPresetId, 'custom'>,
  { colorTempK: number; gamma: number; contrastPct: number; brightnessPct: number }
> = {
  standard: { colorTempK: 6500, gamma: 1.0, contrastPct: 100, brightnessPct: 75 },
  gaming: { colorTempK: 6800, gamma: 1.1, contrastPct: 108, brightnessPct: 95 },
  cinema: { colorTempK: 6000, gamma: 1.05, contrastPct: 105, brightnessPct: 80 },
  reading: { colorTempK: 4500, gamma: 0.95, contrastPct: 95, brightnessPct: 65 },
};

export function ProfilesAndPeripheralsView({
  section,
  telemetry,
  config,
  onSaveConfig,
  onSwitchMode,
  onDisplayPreviewChange,
}: ProfilesAndPeripheralsViewProps) {
  const [selectedProfileTab, setSelectedProfileTab] = useState<PerformanceModeId>(config.activeMode);
  const [newGameExe, setNewGameExe] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Keyboard & Macros state
  const [kb, setKb] = useState(config.keyboard);
  const [macroName, setMacroName] = useState('');
  const [macroTrigger, setMacroTrigger] = useState('');
  const [recordingMacro, setRecordingMacro] = useState(false);

  // Display state + 10-second auto-revert safety confirmation
  const [disp, setDisp] = useState(config.display);
  const [revertCountdown, setRevertCountdown] = useState<number | null>(null);
  const [prevDisplayBackup, setPrevDisplayBackup] = useState(config.display);

  useEffect(() => {
    setStatusMsg(null);
  }, [section]);

  useEffect(() => {
    setKb(config.keyboard);
    setDisp(config.display);
    setSelectedProfileTab(config.activeMode);
  }, [config]);

  useEffect(() => {
    if (revertCountdown === null) return;
    if (revertCountdown <= 0) {
      setDisp(prevDisplayBackup);
      onDisplayPreviewChange(null);
      setRevertCountdown(null);
      setStatusMsg('Display configuration automatically reverted for safety.');
      return;
    }
    const id = setTimeout(() => setRevertCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [revertCountdown, prevDisplayBackup, onDisplayPreviewChange]);

  const computeFilterString = (d: typeof disp) => {
    const warmthSepia = d.colorTempK < 6500 ? Math.min(0.35, ((6500 - d.colorTempK) / 2500) * 0.35) : 0;
    const brightness = 0.7 + (d.brightnessPct / 100) * 0.35;
    const contrast = d.contrastPct / 100;
    return `brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)}) sepia(${warmthSepia.toFixed(2)})`;
  };

  if (section === 'profiles') {
    const profile = config.profiles[selectedProfileTab];

    const addGameExe = async () => {
      const cleaned = newGameExe.trim().toLowerCase();
      if (!cleaned) return;
      const next = Array.from(new Set([...config.detectedGamesList, cleaned]));
      await onSaveConfig({ detectedGamesList: next });
      setNewGameExe('');
      setStatusMsg(`Added ${cleaned} to automatic Gaming Mode watchlist.`);
    };

    const removeGameExe = async (exe: string) => {
      await onSaveConfig({
        detectedGamesList: config.detectedGamesList.filter((g) => g !== exe),
      });
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-100">
              Performance Profiles &amp; Automatic Game Detection
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Customize Gaming, Work, and Battery Saver targets or restore factory configurations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSwitchMode(selectedProfileTab)}
            className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs"
          >
            Activate {profile.label}
          </button>
        </div>

        {statusMsg && (
          <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
            {statusMsg}
          </div>
        )}

        <div className="flex gap-2">
          {(['gaming', 'work', 'battery'] as PerformanceModeId[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedProfileTab(m)}
              className={`px-4 py-2 rounded-md text-xs font-medium border ${
                selectedProfileTab === m
                  ? 'bg-white/[0.1] border-sky-400 text-slate-100'
                  : 'bg-[#11151C] border-white/[0.08] text-slate-400 hover:text-slate-100'
              }`}
            >
              {config.profiles[m].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
            <h3 className="font-display text-base font-semibold text-slate-100">{profile.label} Parameters</h3>
            <p className="text-slate-400">{profile.description}</p>
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span className="text-slate-400">Windows Power Scheme</span>
                <span className="font-mono text-slate-200">{profile.windowsPowerPlan}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span className="text-slate-400">CPU Boost Policy</span>
                <span className="font-mono text-slate-200">{profile.cpuBoostPolicy}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span className="text-slate-400">Approved PL1 / PL2</span>
                <span className="font-mono tabular-nums text-slate-200">{profile.pl1Watts}W / {profile.pl2Watts}W</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span className="text-slate-400">GPU PowerMizer Policy</span>
                <span className="font-mono text-slate-200">{profile.gpuPerformanceMode}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span className="text-slate-400">Target Display Refresh</span>
                <span className="font-mono tabular-nums text-slate-200">{profile.targetRefreshRateHz} Hz</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Thermal Fan Preset</span>
                <span className="font-mono text-slate-200">{profile.fanPreset}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const def = createDefaultConfig().profiles[selectedProfileTab];
                await onSaveConfig({ profiles: { ...config.profiles, [selectedProfileTab]: def } });
                setStatusMsg(`Restored ${def.label} original defaults.`);
              }}
              className="px-3.5 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Original Profile
            </button>
          </div>

          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-orange-400" />
                Automatic Game Detection
              </h3>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoGameDetection}
                  onChange={(e) => void onSaveConfig({ autoGameDetection: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <p className="text-xs text-slate-400">
              When the Windows Companion Agent detects a listed executable running, EVOL switches to Gaming Mode automatically and restores the previous profile on exit.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. forza_horizon5.exe"
                value={newGameExe}
                onChange={(e) => setNewGameExe(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] text-xs font-mono text-slate-100"
              />
              <button
                type="button"
                onClick={() => void addGameExe()}
                className="px-3 py-2 rounded-md bg-white/[0.08] hover:bg-white/[0.14] text-xs text-slate-100 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {config.detectedGamesList.map((exe) => (
                <div key={exe} className="py-2 flex items-center justify-between text-xs font-mono text-slate-300">
                  <span>{exe}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${exe}`}
                    onClick={() => void removeGameExe(exe)}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'keyboard-macros') {
    const saveKeyboard = async () => {
      const res = await onSaveConfig({ keyboard: kb });
      setStatusMsg(res.ok ? 'Keyboard & macro profile saved.' : res.error ?? 'Save failed.');
    };

    const addMacro = () => {
      if (!macroName.trim() || !macroTrigger.trim()) return;
      const item: MacroDefinition = {
        id: `macro-${Date.now()}`,
        name: macroName.trim(),
        triggerKey: macroTrigger.trim(),
        sequence: ['KeyDown', 'KeyUp'],
        delayMs: 25,
        enabled: true,
      };
      setKb({ ...kb, macros: [...kb.macros, item] });
      setMacroName('');
      setMacroTrigger('');
    };

    const exportMacrosJson = () => {
      const blob = new Blob([JSON.stringify(kb.macros, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'evol-macros.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            Keyboard Lighting &amp; Macro Engine
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure zone backlight preferences and OS-level keyboard macros with hardware-verified capability detection.
          </p>
        </div>

        <div className="px-4 py-3 rounded-lg bg-[#11151C] border border-white/[0.08] text-xs text-slate-300">
          <strong className="text-amber-300">Hardware Controller Audit:</strong> {telemetry.capabilities.keyboardPerKey.reason} Per-key addressable RGB matrices are disabled to prevent false controls; single-zone color &amp; OS-level SendInput macros are supported.
        </div>

        {statusMsg && (
          <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-100">Zone Backlight Controls</h3>
              <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kb.backlightEnabled}
                  onChange={(e) => setKb({ ...kb, backlightEnabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-300">Brightness</span>
                <span className="font-mono tabular-nums">{kb.brightnessPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={kb.brightnessPct}
                onChange={(e) => setKb({ ...kb, brightnessPct: Number(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-slate-400 block">Primary Color (HEX)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={kb.primaryHex}
                    onChange={(e) => setKb({ ...kb, primaryHex: e.target.value })}
                    className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={kb.primaryHex}
                    onChange={(e) => setKb({ ...kb, primaryHex: e.target.value })}
                    className="flex-1 px-2.5 py-2 rounded bg-[#090B0F] border border-white/[0.12] font-mono text-slate-100"
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-400 block">Lighting Effect</span>
                <select
                  value={kb.effect}
                  onChange={(e) => setKb({ ...kb, effect: e.target.value as LightingEffectId })}
                  className="w-full px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] text-slate-100"
                >
                  <option value="static">Static</option>
                  <option value="breathing">Breathing</option>
                  <option value="wave">Wave</option>
                  <option value="rainbow">Rainbow</option>
                  <option value="reactive">Reactive</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>

            <div
              className="h-10 rounded-md border border-white/[0.1] flex items-center justify-center font-mono text-xs"
              style={{
                background: kb.backlightEnabled
                  ? `linear-gradient(90deg, ${kb.primaryHex}33, ${kb.secondaryHex}33)`
                  : '#090B0F',
                color: kb.backlightEnabled ? '#F8FAFC' : '#64748B',
              }}
            >
              {kb.backlightEnabled ? `Zone Preview · ${kb.effect} · ${kb.brightnessPct}%` : 'Backlight Off'}
            </div>

            <button
              type="button"
              onClick={() => void saveKeyboard()}
              className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium"
            >
              Save Keyboard Configuration
            </button>
          </div>

          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-sky-400" />
                Macro Manager ({kb.activeMacroProfile})
              </h3>
              <button
                type="button"
                onClick={exportMacrosJson}
                className="px-2.5 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Macro name"
                value={macroName}
                onChange={(e) => setMacroName(e.target.value)}
                className="px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] text-slate-100"
              />
              <input
                type="text"
                placeholder={recordingMacro ? 'Press any key combo...' : 'Click to record or type shortcut'}
                value={macroTrigger}
                onFocus={() => setRecordingMacro(true)}
                onBlur={() => setRecordingMacro(false)}
                onKeyDown={(e) => {
                  e.preventDefault();
                  const parts = [
                    e.ctrlKey ? 'Ctrl' : null,
                    e.altKey ? 'Alt' : null,
                    e.shiftKey ? 'Shift' : null,
                    !['Control', 'Alt', 'Shift'].includes(e.key) ? e.key.toUpperCase() : null,
                  ].filter(Boolean);
                  if (parts.length > 0) setMacroTrigger(parts.join('+'));
                }}
                onChange={(e) => setMacroTrigger(e.target.value)}
                className="px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] font-mono text-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={addMacro}
              className="px-3 py-1.5 rounded bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Macro Shortcut
            </button>

            <div className="divide-y divide-white/[0.06]">
              {kb.macros.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-200">{m.name}</div>
                    <div className="font-mono text-slate-500">{m.triggerKey}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setKb({
                          ...kb,
                          macros: kb.macros.map((x) => (x.id === m.id ? { ...x, enabled: !x.enabled } : x)),
                        })
                      }
                      className={`px-2 py-1 rounded text-[11px] ${
                        m.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {m.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete macro ${m.name}`}
                      onClick={() => setKb({ ...kb, macros: kb.macros.filter((x) => x.id !== m.id) })}
                      className="p-1 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display Management
  const applyDisplayPreview = () => {
    setPrevDisplayBackup(config.display);
    onDisplayPreviewChange(computeFilterString(disp));
    setRevertCountdown(10);
  };

  const confirmDisplaySave = async () => {
    setRevertCountdown(null);
    await onSaveConfig({ display: disp });
    setStatusMsg('Display calibration profile saved (software filter / Windows GDI GammaRamp).');
  };

  const resetDisplay = async () => {
    const def = createDefaultConfig().display;
    setDisp(def);
    setRevertCountdown(null);
    onDisplayPreviewChange(null);
    await onSaveConfig({ display: def });
    setStatusMsg('Display calibration reset to standard 6500K defaults.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-100">
          Display Management &amp; Color Calibration
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Manage panel refresh rate targets and software color calibration with automatic 10-second safety rollback.
        </p>
      </div>

      <div className="px-4 py-3 rounded-lg bg-[#11151C] border border-white/[0.08] text-xs text-slate-300">
        <strong>Calibration Transparency:</strong> Color temperature, gamma, and contrast adjustments apply a software color filter (CSS preview here / Windows GDI <span className="font-mono">SetDeviceGammaRamp</span> via Companion Agent), not factory hardware 3D-LUT panel calibration.
      </div>

      {revertCountdown !== null && (
        <div className="px-4 py-3 rounded-lg bg-amber-950/40 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100">
          <span>
            Preview active. Reverting automatically in <strong className="font-mono tabular-nums">{revertCountdown}s</strong> unless confirmed.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDisplaySave()}
              className="px-3 py-1.5 rounded bg-amber-400 text-slate-950 font-semibold"
            >
              Keep Display Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setDisp(prevDisplayBackup);
                onDisplayPreviewChange(null);
                setRevertCountdown(null);
              }}
              className="px-3 py-1.5 rounded bg-white/10 text-slate-100"
            >
              Revert Now
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
          <h3 className="font-display text-base font-semibold text-slate-100">Presets &amp; Refresh Rate</h3>

          <div className="flex flex-wrap gap-2">
            {(['standard', 'gaming', 'cinema', 'reading'] as Array<Exclude<DisplayPresetId, 'custom'>>).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  const p = DISPLAY_PRESETS[preset];
                  setDisp({ ...disp, activePreset: preset, ...p });
                }}
                className={`px-3 py-1.5 rounded-md capitalize border ${
                  disp.activePreset === preset
                    ? 'bg-sky-500/15 border-sky-400 text-sky-200'
                    : 'bg-[#090B0F] border-white/[0.08] text-slate-300'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div>
            <span className="text-slate-400 block mb-2">One-Click Refresh Rate Target</span>
            <div className="flex gap-2">
              {[60, 144, 165].map((hz) => (
                <button
                  key={hz}
                  type="button"
                  onClick={() => setDisp({ ...disp, refreshRateHz: hz })}
                  className={`px-3.5 py-2 rounded-md font-mono border ${
                    disp.refreshRateHz === hz
                      ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                      : 'bg-[#090B0F] border-white/[0.08] text-slate-300'
                  }`}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-slate-500">
              Current host panel detection: {telemetry.display.resolution ?? 'Requires Windows User32 Display API'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
          <h3 className="font-display text-base font-semibold text-slate-100">Software Color Adjustments</h3>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Color Temperature</span>
              <span className="font-mono tabular-nums">{disp.colorTempK} K</span>
            </div>
            <input
              type="range"
              min={4000}
              max={7500}
              step={100}
              value={disp.colorTempK}
              onChange={(e) => setDisp({ ...disp, activePreset: 'custom', colorTempK: Number(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Contrast</span>
              <span className="font-mono tabular-nums">{disp.contrastPct}%</span>
            </div>
            <input
              type="range"
              min={80}
              max={120}
              value={disp.contrastPct}
              onChange={(e) => setDisp({ ...disp, activePreset: 'custom', contrastPct: Number(e.target.value) })}
              className="w-full accent-sky-400"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Brightness Target</span>
              <span className="font-mono tabular-nums">{disp.brightnessPct}%</span>
            </div>
            <input
              type="range"
              min={25}
              max={100}
              value={disp.brightnessPct}
              onChange={(e) => setDisp({ ...disp, activePreset: 'custom', brightnessPct: Number(e.target.value) })}
              className="w-full accent-sky-400"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={applyDisplayPreview}
              className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium"
            >
              Preview &amp; Apply (10s Guard)
            </button>
            <button
              type="button"
              onClick={() => void resetDisplay()}
              className="px-3.5 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Original
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
