/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Menu, X } from 'lucide-react';
import { evaluateThermalAlerts } from './shared/engine';
import type {
  EvolConfig,
  NavSectionId,
  PerformanceModeId,
  TelemetrySnapshot,
} from './shared/types';
import { DashboardView } from './components/DashboardView';
import { PerformanceMonitorView } from './components/PerformanceMonitorView';
import { PlatformAndToolsView } from './components/PlatformAndToolsView';
import { ProfilesAndPeripheralsView } from './components/ProfilesAndPeripheralsView';
import { NAV_ITEMS, Sidebar } from './components/Sidebar';
import { SystemInfoView } from './components/SystemInfoView';
import type { TelemetryPoint } from './components/TelemetryChart';
import { TuningViews } from './components/TuningViews';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [config, setConfig] = useState<EvolConfig | null>(null);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [displayFilterCss, setDisplayFilterCss] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry');
      if (!res.ok) return;
      const snap = (await res.json()) as TelemetrySnapshot;
      setTelemetry(snap);
      const timeLabel = new Date(snap.timestamp).toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setHistory((prev) => [
        ...prev.slice(-39),
        {
          timeLabel,
          cpuUtil: snap.cpu.utilizationPct,
          ramUtil: snap.ram.utilizationPct,
          cpuClockMhz: snap.cpu.currentClockMhz,
          cpuTempC: snap.cpu.temperatureC,
          gpuUtil: snap.gpu.utilizationPct,
          gpuTempC: snap.gpu.temperatureC,
        },
      ]);
    } catch {
      // Transient fetch failure ignored during polling
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        setConfig((await res.json()) as EvolConfig);
      }
    } catch {
      setErrorMsg('Unable to load EVOL configuration from backend.');
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
    void fetchTelemetry();
    const quickSample = setTimeout(() => {
      void fetchTelemetry();
    }, 350);
    return () => clearTimeout(quickSample);
  }, [fetchConfig, fetchTelemetry]);

  useEffect(() => {
    const interval = config?.samplingIntervalMs ?? 2000;
    const id = setInterval(() => {
      void fetchTelemetry();
    }, interval);
    return () => clearInterval(id);
  }, [config?.samplingIntervalMs, fetchTelemetry]);

  const handleSaveConfig = async (
    patch: Partial<EvolConfig>,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        return { ok: false, error: json.error ?? 'Validation error' };
      }
      setConfig(json as EvolConfig);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error saving configuration.' };
    }
  };

  const handleSwitchMode = async (mode: PerformanceModeId) => {
    setSwitchingMode(true);
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (res.ok && json.config) {
        setConfig(json.config as EvolConfig);
      } else if (json.error) {
        setErrorMsg(json.error);
      }
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleResetConfig = async () => {
    const res = await fetch('/api/reset', { method: 'POST' });
    if (res.ok) {
      setConfig((await res.json()) as EvolConfig);
      setDisplayFilterCss(null);
    }
  };

  const handleRestoreConfig = async (
    incoming: EvolConfig,
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incoming),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? 'Restore failed' };
    setConfig(json as EvolConfig);
    return { ok: true };
  };

  const alerts = useMemo(() => {
    if (!telemetry || !config || !config.thermalThresholds.enableNotifications) return [];
    return evaluateThermalAlerts(telemetry, config.thermalThresholds);
  }, [telemetry, config]);

  const currentNavLabel = NAV_ITEMS.find((n) => n.id === activeSection)?.label ?? 'Home Dashboard';

  if (!telemetry || !config) {
    return (
      <div className="min-h-screen bg-[#090B0F] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2">
          <div className="font-display text-lg font-semibold">EVOL CONTROL CENTER</div>
          <p className="text-xs text-slate-400">
            {errorMsg ?? 'Initializing live hardware telemetry and configuration engine...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#090B0F] text-slate-100 flex"
      style={displayFilterCss ? { filter: displayFilterCss } : undefined}
    >
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        agentConnected={telemetry.agentConnected}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb/Title — Mode Status — Primary Action */}
        <header className="sticky top-0 z-30 bg-[#090B0F]/95 backdrop-blur border-b border-white/[0.08] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-md text-slate-300 hover:bg-white/[0.06]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">EVOL</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-100 truncate">
                {currentNavLabel}
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 whitespace-nowrap">
            <span>{telemetry.agentConnected ? 'Windows Agent Live' : 'Linux Host Telemetry'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-200">{config.profiles[config.activeMode].label}</span>
          </div>

          <div className="shrink-0">
            <a
              href="/api/windows-bundle/download"
              className="px-3.5 py-2 rounded-md bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Windows .NET 8 App</span>
              <span className="sm:hidden">Win App</span>
            </a>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {errorMsg && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setErrorMsg(null)}
                className="text-red-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeSection === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              history={history}
              config={config}
              alerts={alerts}
              switchingMode={switchingMode}
              onSwitchMode={handleSwitchMode}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'system-info' && <SystemInfoView telemetry={telemetry} />}

          {activeSection === 'performance-monitor' && (
            <PerformanceMonitorView
              telemetry={telemetry}
              history={history}
              config={config}
              alerts={alerts}
              onSaveConfig={handleSaveConfig}
            />
          )}

          {(activeSection === 'cpu-control' ||
            activeSection === 'gpu-control' ||
            activeSection === 'thermal-fan') && (
            <TuningViews
              section={activeSection}
              telemetry={telemetry}
              config={config}
              onSaveConfig={handleSaveConfig}
            />
          )}

          {(activeSection === 'profiles' ||
            activeSection === 'keyboard-macros' ||
            activeSection === 'display') && (
            <ProfilesAndPeripheralsView
              section={activeSection}
              telemetry={telemetry}
              config={config}
              onSaveConfig={handleSaveConfig}
              onSwitchMode={handleSwitchMode}
              onDisplayPreviewChange={setDisplayFilterCss}
            />
          )}

          {(activeSection === 'bios-firmware' ||
            activeSection === 'power' ||
            activeSection === 'updates' ||
            activeSection === 'diagnostics' ||
            activeSection === 'logging' ||
            activeSection === 'settings') && (
            <PlatformAndToolsView
              section={activeSection}
              telemetry={telemetry}
              config={config}
              onSaveConfig={handleSaveConfig}
              onResetConfig={handleResetConfig}
              onRestoreConfig={handleRestoreConfig}
              onRefreshTelemetry={fetchTelemetry}
            />
          )}
        </main>
      </div>

      {/* Optional Floating Always-On-Top Monitoring Overlay */}
      {config.alwaysOnTopOverlay && (
        <aside
          aria-label="Floating performance overlay"
          className="fixed bottom-4 right-4 z-40 w-64 p-3.5 rounded-lg bg-[#0D1016]/95 border border-sky-500/40 shadow-xl text-xs font-mono tabular-nums space-y-1.5"
        >
          <div className="flex items-center justify-between font-sans">
            <span className="font-semibold text-slate-200">EVOL Mini Overlay</span>
            <button
              type="button"
              aria-label="Close floating overlay"
              onClick={() => void handleSaveConfig({ alwaysOnTopOverlay: false })}
              className="text-slate-400 hover:text-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>CPU</span>
            <span>{telemetry.cpu.utilizationPct}% · {telemetry.cpu.temperatureC ?? 'N/A'}°C</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>GPU</span>
            <span>{telemetry.gpu.utilizationPct ?? 'N/A'}% · {telemetry.gpu.temperatureC ?? 'N/A'}°C</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>RAM</span>
            <span>{telemetry.ram.utilizationPct}% ({telemetry.ram.usedGb} GB)</span>
          </div>
          <div className="flex justify-between text-slate-400 pt-1 border-t border-white/[0.08] font-sans">
            <span>Profile</span>
            <span className="capitalize text-sky-400">{config.activeMode}</span>
          </div>
        </aside>
      )}
    </div>
  );
}
