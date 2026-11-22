import React, { useState } from 'react';
import { Bell, Eye, Layers, Shield } from 'lucide-react';
import type { EvolConfig, TelemetrySnapshot, ThermalAlert } from '../shared/types';
import { TelemetryChart, type TelemetryPoint } from './TelemetryChart';

interface PerformanceMonitorViewProps {
  telemetry: TelemetrySnapshot;
  history: TelemetryPoint[];
  config: EvolConfig;
  alerts: ThermalAlert[];
  onSaveConfig: (patch: Partial<EvolConfig>) => Promise<{ ok: boolean; error?: string }>;
}

export function PerformanceMonitorView({
  telemetry,
  history,
  config,
  alerts,
  onSaveConfig,
}: PerformanceMonitorViewProps) {
  const [widgets, setWidgets] = useState({
    cpu: true,
    gpu: true,
    memory: true,
    fans: true,
    power: true,
    storage: true,
  });
  const [thresholds, setThresholds] = useState(config.thermalThresholds);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleIntervalChange = async (ms: number) => {
    await onSaveConfig({ samplingIntervalMs: ms });
    setSaveMessage(`Sampling interval updated to ${(ms / 1000).toFixed(1)}s.`);
  };

  const handleToggleOverlay = async () => {
    await onSaveConfig({ alwaysOnTopOverlay: !config.alwaysOnTopOverlay });
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSaveConfig({ thermalThresholds: thresholds });
    setSaveMessage(res.ok ? 'Thermal protection thresholds saved.' : res.error ?? 'Failed to save.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            Real-Time Performance &amp; Thermal Monitor
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Live sensor stream with configurable polling intervals, widget layout, and thermal protection alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>Refresh Interval</span>
            <select
              value={config.samplingIntervalMs}
              onChange={(e) => void handleIntervalChange(Number(e.target.value))}
              className="bg-[#11151C] border border-white/[0.12] rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-100"
            >
              <option value={1000}>1.0s</option>
              <option value={2000}>2.0s</option>
              <option value={5000}>5.0s</option>
              <option value={10000}>10.0s</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void handleToggleOverlay()}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border inline-flex items-center gap-2 whitespace-nowrap ${
              config.alwaysOnTopOverlay
                ? 'bg-sky-500/15 border-sky-400/50 text-sky-300'
                : 'bg-[#11151C] border-white/[0.12] text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {config.alwaysOnTopOverlay ? 'Overlay Active' : 'Enable Mini Overlay'}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
          {saveMessage}
        </div>
      )}

      {/* Widget Visibility Customizer */}
      <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium text-slate-300 inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-slate-400" /> Visible Telemetry Widgets:
        </span>
        {(Object.keys(widgets) as Array<keyof typeof widgets>).map((key) => (
          <label key={key} className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={widgets[key]}
              onChange={() => setWidgets((prev) => ({ ...prev, [key]: !prev[key] }))}
              className="rounded border-white/20 bg-slate-900 text-sky-500"
            />
            <span className="capitalize">{key}</span>
          </label>
        ))}
      </div>

      {/* Live Graph */}
      <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
        <TelemetryChart points={history} height={260} />
      </div>

      {/* Live Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {widgets.cpu && (
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2 text-xs">
            <div className="font-display text-sm font-semibold text-slate-100">CPU Telemetry</div>
            <div className="flex justify-between"><span className="text-slate-400">Utilization</span><span className="font-mono tabular-nums">{telemetry.cpu.utilizationPct}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Clock Speed</span><span className="font-mono tabular-nums">{telemetry.cpu.currentClockMhz ?? 'N/A'} MHz</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Package Temp</span><span className="font-mono tabular-nums">{telemetry.cpu.temperatureC !== null ? `${telemetry.cpu.temperatureC}°C` : 'Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Thermal Headroom</span><span className="font-mono tabular-nums">{telemetry.cpu.temperatureC !== null ? `${Math.max(0, 100 - telemetry.cpu.temperatureC).toFixed(1)}°C` : 'Sensor Required'}</span></div>
          </div>
        )}

        {widgets.gpu && (
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2 text-xs">
            <div className="font-display text-sm font-semibold text-slate-100">GPU Telemetry (NVML)</div>
            <div className="flex justify-between"><span className="text-slate-400">Utilization</span><span className="font-mono tabular-nums">{telemetry.gpu.utilizationPct !== null ? `${telemetry.gpu.utilizationPct}%` : 'Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Core / Hotspot</span><span className="font-mono tabular-nums">{telemetry.gpu.temperatureC !== null ? `${telemetry.gpu.temperatureC}°C` : 'Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">VRAM</span><span className="font-mono tabular-nums">{telemetry.gpu.vramTotalMb ? `${telemetry.gpu.vramUsedMb}/${telemetry.gpu.vramTotalMb} MB` : 'Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Board Power</span><span className="font-mono tabular-nums">{telemetry.gpu.powerW !== null ? `${telemetry.gpu.powerW} W` : 'Unavailable'}</span></div>
          </div>
        )}

        {widgets.memory && (
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2 text-xs">
            <div className="font-display text-sm font-semibold text-slate-100">Memory Allocation</div>
            <div className="flex justify-between"><span className="text-slate-400">Utilization</span><span className="font-mono tabular-nums">{telemetry.ram.utilizationPct}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Used / Total</span><span className="font-mono tabular-nums">{telemetry.ram.usedGb} / {telemetry.ram.totalGb} GB</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Available</span><span className="font-mono tabular-nums">{telemetry.ram.availableGb} GB</span></div>
          </div>
        )}

        {widgets.fans && (
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2 text-xs">
            <div className="font-display text-sm font-semibold text-slate-100">Fan RPM Sensors</div>
            <div className="flex justify-between"><span className="text-slate-400">CPU Fan</span><span className="font-mono tabular-nums">{telemetry.fans.cpuFanRpm !== null ? `${telemetry.fans.cpuFanRpm} RPM` : 'EC Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">GPU Fan</span><span className="font-mono tabular-nums">{telemetry.fans.gpuFanRpm !== null ? `${telemetry.fans.gpuFanRpm} RPM` : 'EC Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Active Curve</span><span className="font-mono">{config.fanPreset}</span></div>
          </div>
        )}

        {widgets.power && (
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2 text-xs">
            <div className="font-display text-sm font-semibold text-slate-100">Power &amp; Battery</div>
            <div className="flex justify-between"><span className="text-slate-400">CPU Package</span><span className="font-mono tabular-nums">{telemetry.cpu.packagePowerW !== null ? `${telemetry.cpu.packagePowerW} W` : 'MSR Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Battery Charge</span><span className="font-mono tabular-nums">{telemetry.battery.percentage !== null ? `${telemetry.battery.percentage}%` : 'Host AC'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Power Plan</span><span className="font-mono">{config.power.activePlan}</span></div>
          </div>
        )}

        {widgets.storage && (
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2 text-xs">
            <div className="font-display text-sm font-semibold text-slate-100">Storage Telemetry</div>
            <div className="flex justify-between"><span className="text-slate-400">Used Space</span><span className="font-mono tabular-nums">{telemetry.storage.usedGb} / {telemetry.storage.totalGb} GB</span></div>
            <div className="flex justify-between"><span className="text-slate-400">SSD Temp</span><span className="font-mono tabular-nums">{telemetry.storage.temperatureC !== null ? `${telemetry.storage.temperatureC}°C` : 'SMART Locked'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Load Avg (1m)</span><span className="font-mono tabular-nums">{telemetry.system.loadAvg1m}</span></div>
          </div>
        )}
      </div>

      {/* Thermal Protection Configuration */}
      <form onSubmit={handleSaveThresholds} className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Thermal Protection &amp; Alert Thresholds
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hardware thermal throttling (PROCHOT) cannot be disabled. Configure early warning notifications below.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Active Alerts: {alerts.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          <label className="space-y-1.5">
            <span className="text-slate-400 block">CPU Warning (°C)</span>
            <input
              type="number"
              min={65}
              max={95}
              value={thresholds.cpuWarningC}
              onChange={(e) => setThresholds({ ...thresholds, cpuWarningC: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-slate-100"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-slate-400 block">CPU Critical (°C)</span>
            <input
              type="number"
              min={75}
              max={100}
              value={thresholds.cpuCriticalC}
              onChange={(e) => setThresholds({ ...thresholds, cpuCriticalC: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-slate-100"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-slate-400 block">GPU Warning (°C)</span>
            <input
              type="number"
              min={65}
              max={90}
              value={thresholds.gpuWarningC}
              onChange={(e) => setThresholds({ ...thresholds, gpuWarningC: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-slate-100"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-slate-400 block">SSD Warning (°C)</span>
            <input
              type="number"
              min={50}
              max={80}
              value={thresholds.ssdWarningC}
              onChange={(e) => setThresholds({ ...thresholds, ssdWarningC: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-slate-100"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-slate-400 block">Low Battery (%)</span>
            <input
              type="number"
              min={5}
              max={40}
              value={thresholds.lowBatteryPct}
              onChange={(e) => setThresholds({ ...thresholds, lowBatteryPct: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-slate-100"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={thresholds.enableNotifications}
              onChange={(e) => setThresholds({ ...thresholds, enableNotifications: e.target.checked })}
              className="rounded border-white/20 bg-slate-900 text-sky-500"
            />
            <Bell className="w-3.5 h-3.5 text-slate-400" />
            Enable thermal &amp; throttling alert banners
          </label>

          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs whitespace-nowrap"
          >
            Save Thresholds
          </button>
        </div>
      </form>
    </div>
  );
}
