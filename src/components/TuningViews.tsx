import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  createDefaultConfig,
  DEFAULT_FAN_PRESETS,
  EVOL_P15_SAFE_LIMITS,
  validateFanCurve,
  validatePowerLimits,
} from '../shared/engine';
import type { EvolConfig, FanCurvePoint, FanPresetId, TelemetrySnapshot } from '../shared/types';

interface TuningViewsProps {
  section: 'cpu-control' | 'gpu-control' | 'thermal-fan';
  telemetry: TelemetrySnapshot;
  config: EvolConfig;
  onSaveConfig: (patch: Partial<EvolConfig>) => Promise<{ ok: boolean; error?: string }>;
}

export function TuningViews({ section, telemetry, config, onSaveConfig }: TuningViewsProps) {
  const activeProfile = config.profiles[config.activeMode];
  const [pl1, setPl1] = useState(activeProfile.pl1Watts);
  const [pl2, setPl2] = useState(activeProfile.pl2Watts);
  const [maxCpuTemp, setMaxCpuTemp] = useState(activeProfile.maxCpuTempC);
  const [boostPolicy, setBoostPolicy] = useState(activeProfile.cpuBoostPolicy);

  const [gpuMode, setGpuMode] = useState(activeProfile.gpuPerformanceMode);
  const [gpuPower, setGpuPower] = useState(activeProfile.gpuPowerLimitWatts);

  const [fanPreset, setFanPreset] = useState<FanPresetId>(config.fanPreset);
  const [cpuCurve, setCpuCurve] = useState<FanCurvePoint[]>(config.cpuFanCurve);
  const [gpuCurve, setGpuCurve] = useState<FanCurvePoint[]>(config.gpuFanCurve);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFeedback(null);
  }, [section]);

  useEffect(() => {
    const p = config.profiles[config.activeMode];
    setPl1(p.pl1Watts);
    setPl2(p.pl2Watts);
    setMaxCpuTemp(p.maxCpuTempC);
    setBoostPolicy(p.cpuBoostPolicy);
    setGpuMode(p.gpuPerformanceMode);
    setGpuPower(p.gpuPowerLimitWatts);
    setFanPreset(config.fanPreset);
    setCpuCurve(config.cpuFanCurve);
    setGpuCurve(config.gpuFanCurve);
  }, [config]);

  const applyCpuTuning = async () => {
    const check = validatePowerLimits(pl1, pl2);
    if (!check.valid) {
      setFeedback({ type: 'err', text: check.error ?? 'Invalid power limits.' });
      return;
    }
    const updatedProfiles = {
      ...config.profiles,
      [config.activeMode]: {
        ...activeProfile,
        pl1Watts: pl1,
        pl2Watts: pl2,
        maxCpuTempC: maxCpuTemp,
        cpuBoostPolicy: boostPolicy,
      },
    };
    const res = await onSaveConfig({ profiles: updatedProfiles });
    setFeedback(
      res.ok
        ? { type: 'ok', text: `Applied CPU tuning for ${activeProfile.label} (PL1 ${pl1}W / PL2 ${pl2}W).` }
        : { type: 'err', text: res.error ?? 'Failed to save CPU tuning.' },
    );
  };

  const resetCpuDefaults = () => {
    const def = createDefaultConfig().profiles[config.activeMode];
    setPl1(def.pl1Watts);
    setPl2(def.pl2Watts);
    setMaxCpuTemp(def.maxCpuTempC);
    setBoostPolicy(def.cpuBoostPolicy);
    setFeedback({ type: 'ok', text: 'Reverted CPU sliders to manufacturer-safe defaults (click Apply to save).' });
  };

  const applyGpuTuning = async () => {
    const updatedProfiles = {
      ...config.profiles,
      [config.activeMode]: {
        ...activeProfile,
        gpuPerformanceMode: gpuMode,
        gpuPowerLimitWatts: gpuPower,
      },
    };
    const res = await onSaveConfig({ profiles: updatedProfiles });
    setFeedback(
      res.ok
        ? { type: 'ok', text: `Saved GPU tuning (${gpuMode}, ${gpuPower}W target).` }
        : { type: 'err', text: res.error ?? 'Failed to save GPU tuning.' },
    );
  };

  const selectFanPreset = (preset: FanPresetId) => {
    setFanPreset(preset);
    if (preset !== 'custom') {
      setCpuCurve([...DEFAULT_FAN_PRESETS[preset]]);
      setGpuCurve([...DEFAULT_FAN_PRESETS[preset]]);
    }
    setFeedback(null);
  };

  const updateCurvePoint = (idx: number, field: 'tempC' | 'speedPct', value: number) => {
    setFanPreset('custom');
    setCpuCurve((prev) => prev.map((pt, i) => (i === idx ? { ...pt, [field]: value } : pt)));
    setGpuCurve((prev) => prev.map((pt, i) => (i === idx ? { ...pt, [field]: value } : pt)));
  };

  const applyFanCurve = async () => {
    const check = validateFanCurve(cpuCurve);
    if (!check.valid) {
      setFeedback({ type: 'err', text: check.error ?? 'Unsafe fan curve rejected.' });
      return;
    }
    const res = await onSaveConfig({ fanPreset, cpuFanCurve: cpuCurve, gpuFanCurve: gpuCurve });
    setFeedback(
      res.ok
        ? { type: 'ok', text: `Saved ${fanPreset} fan curve profile with thermal safety validation.` }
        : { type: 'err', text: res.error ?? 'Failed to save fan curve.' },
    );
  };

  if (section === 'cpu-control') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-100">
              CPU Performance &amp; Power Limits ({activeProfile.label})
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Safely bounded PL1/PL2 wattage and Windows processor boost configuration for Intel 12th/13th Gen H-series.
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {telemetry.capabilities.cpuPowerLimits.supported ? 'Windows PowrProf Active' : 'Profile Intent Stored (Windows Agent Required for MSR)'}
          </div>
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg border text-xs flex items-center gap-2 ${
              feedback.type === 'ok'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/30 border-red-500/40 text-red-200'
            }`}
          >
            {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <label htmlFor="pl1-range" className="text-slate-200 font-medium">Sustained Power Limit (PL1)</label>
                <span className="font-mono tabular-nums text-sky-400">{pl1} W</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="pl1-range"
                  type="range"
                  min={EVOL_P15_SAFE_LIMITS.minPl1W}
                  max={EVOL_P15_SAFE_LIMITS.maxPl1W}
                  value={pl1}
                  onChange={(e) => setPl1(Number(e.target.value))}
                  className="flex-1 accent-sky-400"
                />
                <input
                  type="number"
                  aria-label="PL1 watts input"
                  min={EVOL_P15_SAFE_LIMITS.minPl1W}
                  max={EVOL_P15_SAFE_LIMITS.maxPl1W}
                  value={pl1}
                  onChange={(e) => setPl1(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 rounded bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-xs text-slate-100"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Approved range: {EVOL_P15_SAFE_LIMITS.minPl1W}W – {EVOL_P15_SAFE_LIMITS.maxPl1W}W</p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <label htmlFor="pl2-range" className="text-slate-200 font-medium">Short-Term Boost Limit (PL2)</label>
                <span className="font-mono tabular-nums text-sky-400">{pl2} W</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="pl2-range"
                  type="range"
                  min={EVOL_P15_SAFE_LIMITS.minPl2W}
                  max={EVOL_P15_SAFE_LIMITS.maxPl2W}
                  value={pl2}
                  onChange={(e) => setPl2(Number(e.target.value))}
                  className="flex-1 accent-sky-400"
                />
                <input
                  type="number"
                  aria-label="PL2 watts input"
                  min={EVOL_P15_SAFE_LIMITS.minPl2W}
                  max={EVOL_P15_SAFE_LIMITS.maxPl2W}
                  value={pl2}
                  onChange={(e) => setPl2(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 rounded bg-[#090B0F] border border-white/[0.12] font-mono tabular-nums text-xs text-slate-100"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Approved range: {EVOL_P15_SAFE_LIMITS.minPl2W}W – {EVOL_P15_SAFE_LIMITS.maxPl2W}W</p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <label htmlFor="cputemp-range" className="text-slate-200 font-medium">Thermal Throttle Ceiling</label>
                <span className="font-mono tabular-nums text-amber-400">{maxCpuTemp} °C</span>
              </div>
              <input
                id="cputemp-range"
                type="range"
                min={EVOL_P15_SAFE_LIMITS.minCpuTempLimitC}
                max={EVOL_P15_SAFE_LIMITS.maxCpuTempLimitC}
                value={maxCpuTemp}
                onChange={(e) => setMaxCpuTemp(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-200 font-medium mb-2">
                Windows CPU Boost Policy (PERFBOOSTMODE)
                <select
                  value={boostPolicy}
                  onChange={(e) => setBoostPolicy(e.target.value as typeof boostPolicy)}
                  className="mt-1.5 w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] text-sm text-slate-100"
                >
                  <option value="Aggressive">Aggressive (Maximum Boost)</option>
                  <option value="Efficient Enabled">Efficient Enabled (Balanced)</option>
                  <option value="Disabled">Disabled (Base Clock Efficiency)</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void applyCpuTuning()}
                className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs"
              >
                Apply CPU Limits
              </button>
              <button
                type="button"
                onClick={resetCpuDefaults}
                className="px-4 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
              </button>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Hardware Capability &amp; Voltage Disclosure
            </h3>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-md bg-[#090B0F] border border-white/[0.07]">
                <div className="font-medium text-amber-300">Voltage Undervolting (FIVR) — Unavailable</div>
                <p className="mt-1 text-slate-400">
                  {telemetry.capabilities.cpuVoltageControl.reason}
                </p>
              </div>
              <div className="p-3.5 rounded-md bg-[#090B0F] border border-white/[0.07]">
                <div className="font-medium text-slate-200">Live Host CPU Telemetry</div>
                <div className="mt-2 space-y-1 font-mono tabular-nums text-slate-400">
                  <div>Model: {telemetry.cpu.model}</div>
                  <div>Load: {telemetry.cpu.utilizationPct}% · Clock: {telemetry.cpu.currentClockMhz ?? 'N/A'} MHz</div>
                  <div>Package Power: {telemetry.cpu.packagePowerW !== null ? `${telemetry.cpu.packagePowerW} W` : 'Requires Windows LibreHardwareMonitor'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'gpu-control') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            NVIDIA GPU Performance Control
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure NVIDIA PowerMizer performance state and safe TGP ceilings within vBIOS-enforced bounds.
          </p>
        </div>

        {feedback && (
          <div className="px-4 py-3 rounded-lg border bg-emerald-950/30 border-emerald-500/40 text-emerald-200 text-xs">
            {feedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200">
                NVIDIA PowerMizer Mode ({activeProfile.label})
                <select
                  value={gpuMode}
                  onChange={(e) => setGpuMode(e.target.value as typeof gpuMode)}
                  className="mt-2 w-full px-3 py-2 rounded-md bg-[#090B0F] border border-white/[0.12] text-sm text-slate-100"
                >
                  <option value="Maximum Performance">Prefer Maximum Performance</option>
                  <option value="Optimal Power">Optimal Power</option>
                  <option value="Adaptive">Adaptive</option>
                </select>
              </label>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <label htmlFor="gpu-pwr" className="text-slate-200 font-medium">Target GPU TGP Cap</label>
                <span className="font-mono tabular-nums text-orange-400">{gpuPower} W</span>
              </div>
              <input
                id="gpu-pwr"
                type="range"
                min={EVOL_P15_SAFE_LIMITS.minGpuPowerW}
                max={EVOL_P15_SAFE_LIMITS.maxGpuPowerW}
                value={gpuPower}
                onChange={(e) => setGpuPower(Number(e.target.value))}
                className="w-full accent-orange-400"
              />
              <p className="mt-1 text-xs text-slate-500">
                vBIOS ceiling on Evol P15 RTX 4050/4060 is enforced by NVIDIA driver/EC Dynamic Boost.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void applyGpuTuning()}
              className="px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 font-medium text-xs"
            >
              Apply GPU Settings
            </button>
          </div>

          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-3 text-xs">
            <h3 className="font-display text-base font-semibold text-slate-100">NVML Sensor Status</h3>
            <div className="p-3.5 rounded-md bg-[#090B0F] border border-white/[0.07] text-slate-300">
              <div className="font-medium">
                {telemetry.gpu.available ? telemetry.gpu.model : 'Discrete GPU Telemetry Unavailable on Current Host'}
              </div>
              <p className="mt-1 text-slate-400">
                {telemetry.capabilities.gpuNvml.reason}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
              <div className="p-3 rounded bg-[#090B0F] border border-white/[0.06]">
                <div className="text-slate-500">Core Clock</div>
                <div className="text-sm text-slate-100 mt-1">{telemetry.gpu.clockMhz ?? 'N/A'} MHz</div>
              </div>
              <div className="p-3 rounded bg-[#090B0F] border border-white/[0.06]">
                <div className="text-slate-500">Board Power</div>
                <div className="text-sm text-slate-100 mt-1">{telemetry.gpu.powerW ?? 'N/A'} W</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Thermal & Fan Control
  const svgW = 540;
  const svgH = 210;
  const pad = 32;
  const curvePolyline = cpuCurve
    .map((pt) => {
      const x = pad + ((pt.tempC - 30) / 65) * (svgW - pad * 2);
      const y = svgH - pad - (pt.speedPct / 100) * (svgH - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            Smart Fan Control &amp; Thermal Curves
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure thermal fan curves with strict monotonic safety enforcement (minimum 75% duty at 85°C+).
          </p>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          EC Direct Override: {telemetry.fans.ecControlSupported ? 'Supported' : 'OEM WMI / Safe Fallback'}
        </span>
      </div>

      {!telemetry.fans.ecControlSupported && (
        <div className="px-4 py-3 rounded-lg bg-[#11151C] border border-white/[0.08] text-xs text-slate-300">
          <strong className="text-amber-300">Hardware Notice:</strong> {telemetry.capabilities.fanCurveWrite.reason} Your preferred curve is saved and used alongside thermal-coupled CPU/GPU power scaling.
        </div>
      )}

      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg border text-xs flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/30 border-red-500/40 text-red-200'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Fan Presets */}
      <div className="flex flex-wrap gap-2">
        {(['silent', 'balanced', 'performance', 'max', 'custom'] as FanPresetId[]).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectFanPreset(preset)}
            className={`px-3.5 py-2 rounded-md text-xs font-medium capitalize border transition-colors ${
              fanPreset === preset
                ? 'bg-sky-500/15 border-sky-400 text-sky-200'
                : 'bg-[#11151C] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            {preset === 'max' ? 'Maximum Cooling' : preset}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
            Temperature-to-Fan Duty Curve Preview
          </h3>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
            {[20, 40, 60, 80, 100].map((pct) => {
              const y = svgH - pad - (pct / 100) * (svgH - pad * 2);
              return (
                <g key={pct}>
                  <line x1={pad} y1={y} x2={svgW - pad} y2={y} stroke="rgba(255,255,255,0.07)" />
                  <text x={pad - 6} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono">
                    {pct}%
                  </text>
                </g>
              );
            })}
            <polyline fill="none" stroke="#38BDF8" strokeWidth="2.5" points={curvePolyline} />
            {cpuCurve.map((pt, idx) => {
              const x = pad + ((pt.tempC - 30) / 65) * (svgW - pad * 2);
              const y = svgH - pad - (pt.speedPct / 100) * (svgH - pad * 2);
              return (
                <g key={idx}>
                  <circle cx={x} cy={y} r="5" fill="#090B0F" stroke="#38BDF8" strokeWidth="2.5" />
                  <text x={x} y={y - 10} textAnchor="middle" fill="#CBD5E1" fontSize="10" fontFamily="JetBrains Mono">
                    {pt.tempC}°C
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="lg:col-span-5 p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-100">Anchor Points</h3>
          <div className="space-y-2.5">
            {cpuCurve.map((pt, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-3 text-xs">
                <label className="flex items-center justify-between gap-2 bg-[#090B0F] px-3 py-2 rounded border border-white/[0.08]">
                  <span className="text-slate-400">Temp °C</span>
                  <input
                    type="number"
                    min={30}
                    max={95}
                    value={pt.tempC}
                    onChange={(e) => updateCurvePoint(idx, 'tempC', Number(e.target.value))}
                    className="w-14 bg-transparent text-right font-mono tabular-nums text-slate-100 focus:outline-none"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 bg-[#090B0F] px-3 py-2 rounded border border-white/[0.08]">
                  <span className="text-slate-400">Duty %</span>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={pt.speedPct}
                    onChange={(e) => updateCurvePoint(idx, 'speedPct', Number(e.target.value))}
                    className="w-14 bg-transparent text-right font-mono tabular-nums text-slate-100 focus:outline-none"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void applyFanCurve()}
              className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs"
            >
              Save Fan Curve
            </button>
            <button
              type="button"
              onClick={() => selectFanPreset('balanced')}
              className="px-3 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs"
            >
              Revert Balanced
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
