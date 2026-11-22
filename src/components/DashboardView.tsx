import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Battery, Cpu, Fan, Flame, Gauge, Laptop, ShieldCheck, Zap } from 'lucide-react';
import type {
  EvolConfig,
  NavSectionId,
  PerformanceModeId,
  TelemetrySnapshot,
  ThermalAlert,
} from '../shared/types';
import { TelemetryChart, type TelemetryPoint } from './TelemetryChart';

interface DashboardViewProps {
  telemetry: TelemetrySnapshot;
  history: TelemetryPoint[];
  config: EvolConfig;
  alerts: ThermalAlert[];
  switchingMode: boolean;
  onSwitchMode: (mode: PerformanceModeId) => Promise<void>;
  onNavigate: (section: NavSectionId) => void;
}

const MODE_META: Array<{
  id: PerformanceModeId;
  title: string;
  subtitle: string;
  accentClass: string;
  activeBorder: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'gaming',
    title: 'GAMING',
    subtitle: 'Max approved boost · 144 Hz · Proactive cooling',
    accentClass: 'text-orange-400',
    activeBorder: 'border-orange-500/70 bg-orange-500/[0.08]',
    icon: Flame,
  },
  {
    id: 'work',
    title: 'WORK',
    subtitle: 'Balanced acoustics · Responsive productivity',
    accentClass: 'text-sky-400',
    activeBorder: 'border-sky-400/70 bg-sky-400/[0.08]',
    icon: Zap,
  },
  {
    id: 'battery',
    title: 'BATTERY SAVER',
    subtitle: '60 Hz panel · Constrained boost · Quiet fans',
    accentClass: 'text-emerald-400',
    activeBorder: 'border-emerald-500/70 bg-emerald-500/[0.08]',
    icon: Battery,
  },
];

export function DashboardView({
  telemetry,
  history,
  config,
  alerts,
  switchingMode,
  onSwitchMode,
  onNavigate,
}: DashboardViewProps) {
  const [imgError, setImgError] = useState(false);

  const fmtVal = (v: number | null | undefined, suffix = '', fallback = 'Unavailable') =>
    v === null || v === undefined ? fallback : `${v}${suffix}`;

  const latestEvent = config.automationHistory[0];

  return (
    <div className="space-y-6">
      {/* One-Click Performance Mode Bar */}
      <section aria-label="One-click performance modes">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="font-display text-base font-semibold text-slate-100">
            One-Click Performance Profile
          </h2>
          <span className="text-xs text-slate-400">
            Active: <strong className="text-slate-200 font-medium">{config.profiles[config.activeMode].label}</strong>
            {' · '}
            Fan Preset: <span className="font-mono">{config.fanPreset}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODE_META.map((mode) => {
            const Icon = mode.icon;
            const isActive = config.activeMode === mode.id;
            return (
              <motion.button
                key={mode.id}
                type="button"
                disabled={switchingMode}
                onClick={() => void onSwitchMode(mode.id)}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.16 }}
                aria-pressed={isActive}
                className={`relative text-left p-4 rounded-lg border transition-colors ${
                  isActive
                    ? mode.activeBorder
                    : 'border-white/[0.08] bg-[#11151C] hover:bg-[#161B24]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`font-display text-base font-bold tracking-wide ${isActive ? mode.accentClass : 'text-slate-100'}`}>
                    {mode.title}
                  </span>
                  <Icon className={`w-4 h-4 ${isActive ? mode.accentClass : 'text-slate-500'}`} />
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{mode.subtitle}</p>
                <div className="mt-3 text-xs font-mono tabular-nums text-slate-500">
                  PL1 {config.profiles[mode.id].pl1Watts}W · PL2 {config.profiles[mode.id].pl2Watts}W ·{' '}
                  {config.profiles[mode.id].targetRefreshRateHz}Hz
                </div>
              </motion.button>
            );
          })}
        </div>

        {latestEvent && (
          <div className="mt-3 px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{latestEvent.summary}</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('profiles')}
              className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Configure profiles <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Thermal Alerts (Only rendered when real alerts trigger) */}
      {alerts.length > 0 && (
        <section aria-label="Active thermal and hardware alerts" className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`px-4 py-3 rounded-lg border flex items-center justify-between gap-4 text-sm ${
                alert.severity === 'critical'
                  ? 'bg-red-950/30 border-red-500/40 text-red-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong className="font-medium">{alert.component}:</strong> {alert.message}
                </span>
              </div>
              <span className="font-mono tabular-nums text-xs font-semibold">{alert.valueLabel}</span>
            </div>
          ))}
        </section>
      )}

      {/* Hero Chassis + Key Telemetry Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 rounded-lg bg-[#11151C] border border-white/[0.08] overflow-hidden flex flex-col">
          <div className="relative h-52 lg:h-56 bg-[#0B0E13] overflow-hidden">
            {!imgError ? (
              <img
                src="/src/assets/images/evol_p15_chassis_1795329730827.jpg"
                alt="Colorful Evol P15 2024 matte black gaming laptop chassis"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-[#090B0F] text-slate-400">
                <Laptop className="w-10 h-10 mb-2 text-slate-500" />
                <span className="text-xs font-medium">Colorful Evol P15 2024 India Edition</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#11151C] via-[#11151C]/70 to-transparent p-4">
              <div className="text-xs text-slate-400">Target Platform</div>
              <div className="font-display text-lg font-semibold text-slate-100">
                Colorful Evol P15 2024
              </div>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between gap-3 text-xs">
            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Telemetry Source</span>
                <span className="font-mono text-right">
                  {telemetry.agentConnected ? 'Windows Agent Live' : `Host (${telemetry.hostPlatform})`}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Processor</span>
                <span className="font-mono text-right truncate max-w-[210px]">{telemetry.cpu.model}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">OS Build</span>
                <span className="font-mono text-right truncate max-w-[210px]">{telemetry.system.osName}</span>
              </div>
            </div>

            {!telemetry.agentConnected && (
              <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between gap-2">
                <span className="text-slate-400">
                  GPU, Fan RPM &amp; Battery require Windows .NET 8 Agent.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap shrink-0"
                >
                  Connect / Download
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 6 Live Sensor Tiles (Single-Elevation Grid) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>CPU Load &amp; Clock</span>
              <Cpu className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-3">
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
                {telemetry.cpu.utilizationPct.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                {fmtVal(telemetry.cpu.currentClockMhz, ' MHz', 'Clock N/A')} · {telemetry.cpu.cores}C/{telemetry.cpu.threads}T
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-xs text-slate-500 flex justify-between">
              <span>Temp</span>
              <span className="font-mono tabular-nums text-slate-300">
                {fmtVal(telemetry.cpu.temperatureC, ' °C', 'Host Blocked')}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Discrete GPU (NVML)</span>
              <Gauge className="w-4 h-4 text-orange-400" />
            </div>
            <div className="mt-3">
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
                {telemetry.gpu.available && telemetry.gpu.utilizationPct !== null
                  ? `${telemetry.gpu.utilizationPct}%`
                  : 'N/A'}
              </div>
              <div className="mt-1 text-xs text-slate-400 truncate">
                {telemetry.gpu.model ?? 'Requires Windows NVML'}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-xs text-slate-500 flex justify-between">
              <span>Temp / Power</span>
              <span className="font-mono tabular-nums text-slate-300">
                {telemetry.gpu.temperatureC !== null ? `${telemetry.gpu.temperatureC}°C` : 'Unavailable'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>System Memory</span>
              <span className="font-mono text-[11px] text-emerald-400">Live</span>
            </div>
            <div className="mt-3">
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
                {telemetry.ram.utilizationPct.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                {telemetry.ram.usedGb} / {telemetry.ram.totalGb} GB
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-xs text-slate-500 flex justify-between">
              <span>Available</span>
              <span className="font-mono tabular-nums text-slate-300">{telemetry.ram.availableGb} GB</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cooling Fans</span>
              <Fan className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
                {telemetry.fans.cpuFanRpm !== null ? `${telemetry.fans.cpuFanRpm} RPM` : 'N/A'}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Preset: {config.fanPreset}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-xs text-slate-500 flex justify-between">
              <span>GPU Fan</span>
              <span className="font-mono tabular-nums text-slate-300">
                {telemetry.fans.gpuFanRpm !== null ? `${telemetry.fans.gpuFanRpm} RPM` : 'EC Required'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Storage Volume</span>
              <span className="font-mono text-[11px] text-emerald-400">Live</span>
            </div>
            <div className="mt-3">
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
                {telemetry.storage.utilizationPct.toFixed(1)}%
              </div>
              <div className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                {telemetry.storage.availableGb} GB free / {telemetry.storage.totalGb} GB
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-xs text-slate-500 flex justify-between">
              <span>NVMe Temp</span>
              <span className="font-mono tabular-nums text-slate-300">
                {fmtVal(telemetry.storage.temperatureC, ' °C', 'SMART Locked')}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Battery &amp; Power</span>
              <Battery className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <div className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
                {telemetry.battery.present && telemetry.battery.percentage !== null
                  ? `${telemetry.battery.percentage}%`
                  : 'AC / Host'}
              </div>
              <div className="mt-1 text-xs text-slate-400 truncate">{telemetry.battery.status}</div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-xs text-slate-500 flex justify-between">
              <span>Thermal Throttle</span>
              <span className="font-mono text-slate-300">
                {telemetry.cpu.thermalThrottling === null
                  ? 'N/A'
                  : telemetry.cpu.thermalThrottling
                    ? 'Active'
                    : 'Nominal'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Telemetry Trend */}
      <section className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Real-Time Telemetry History
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Polling live host metrics every {(config.samplingIntervalMs / 1000).toFixed(1)}s · Zero simulated sensor values
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('performance-monitor')}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 whitespace-nowrap"
          >
            Open Full Monitor
          </button>
        </div>
        <TelemetryChart points={history} />
      </section>
    </div>
  );
}
