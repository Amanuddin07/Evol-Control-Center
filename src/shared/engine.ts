import type {
  CsvLogEntry,
  EvolConfig,
  FanCurvePoint,
  FanPresetId,
  HardwareCapabilities,
  ModeComparisonMetric,
  PerformanceModeId,
  ProfileExecutionPlan,
  StabilityEvent,
  StabilityReport,
  TelemetrySnapshot,
  ThermalAlert,
  ThermalThresholds,
} from './types.ts';

export const EVOL_P15_SAFE_LIMITS = {
  minPl1W: 15,
  maxPl1W: 55,
  minPl2W: 25,
  maxPl2W: 115,
  minCpuTempLimitC: 70,
  maxCpuTempLimitC: 95,
  minGpuPowerW: 35,
  maxGpuPowerW: 115,
};

export const DEFAULT_FAN_PRESETS: Record<Exclude<FanPresetId, 'custom'>, FanCurvePoint[]> = {
  silent: [
    { tempC: 40, speedPct: 20 },
    { tempC: 55, speedPct: 30 },
    { tempC: 70, speedPct: 48 },
    { tempC: 80, speedPct: 68 },
    { tempC: 90, speedPct: 88 },
  ],
  balanced: [
    { tempC: 40, speedPct: 25 },
    { tempC: 55, speedPct: 42 },
    { tempC: 70, speedPct: 62 },
    { tempC: 80, speedPct: 80 },
    { tempC: 90, speedPct: 95 },
  ],
  performance: [
    { tempC: 40, speedPct: 35 },
    { tempC: 55, speedPct: 55 },
    { tempC: 68, speedPct: 75 },
    { tempC: 78, speedPct: 90 },
    { tempC: 88, speedPct: 100 },
  ],
  max: [
    { tempC: 35, speedPct: 75 },
    { tempC: 50, speedPct: 85 },
    { tempC: 65, speedPct: 95 },
    { tempC: 75, speedPct: 100 },
    { tempC: 85, speedPct: 100 },
  ],
};

export function createDefaultConfig(): EvolConfig {
  return {
    activeMode: 'work',
    samplingIntervalMs: 2000,
    loggingIntervalSec: 5,
    loggingDirectory: 'logs/',
    launchWithWindows: false,
    minimizeToTray: true,
    alwaysOnTopOverlay: false,
    autoUpdateCheck: true,
    autoGameDetection: true,
    detectedGamesList: ['cs2.exe', 'valorant.exe', 'cyberpunk2077.exe', 'eldenring.exe', 'gta5.exe'],
    agentUrl: 'http://127.0.0.1:17830',
    profiles: {
      gaming: {
        id: 'gaming',
        label: 'Gaming Mode',
        description: 'Sustained CPU/GPU boost, highest supported display refresh rate, and proactive cooling.',
        windowsPowerPlan: 'High Performance',
        cpuBoostPolicy: 'Aggressive',
        pl1Watts: 45,
        pl2Watts: 95,
        maxCpuTempC: 92,
        gpuPerformanceMode: 'Maximum Performance',
        gpuPowerLimitWatts: 100,
        targetRefreshRateHz: 144,
        fanPreset: 'performance',
        brightnessPct: 90,
        autoGameDetection: true,
      },
      work: {
        id: 'work',
        label: 'Work Mode',
        description: 'Balanced acoustics and sustained single/multi-core responsiveness for productivity.',
        windowsPowerPlan: 'Balanced',
        cpuBoostPolicy: 'Efficient Enabled',
        pl1Watts: 35,
        pl2Watts: 65,
        maxCpuTempC: 88,
        gpuPerformanceMode: 'Optimal Power',
        gpuPowerLimitWatts: 75,
        targetRefreshRateHz: 144,
        fanPreset: 'balanced',
        brightnessPct: 75,
        autoGameDetection: true,
      },
      battery: {
        id: 'battery',
        label: 'Battery Saver Mode',
        description: 'Maximum runtime efficiency with constrained boost, 60 Hz panel refresh, and quiet fans.',
        windowsPowerPlan: 'Power Saver',
        cpuBoostPolicy: 'Disabled',
        pl1Watts: 20,
        pl2Watts: 35,
        maxCpuTempC: 82,
        gpuPerformanceMode: 'Adaptive',
        gpuPowerLimitWatts: 45,
        targetRefreshRateHz: 60,
        fanPreset: 'silent',
        brightnessPct: 50,
        autoGameDetection: false,
      },
    },
    fanPreset: 'balanced',
    cpuFanCurve: [...DEFAULT_FAN_PRESETS.balanced],
    gpuFanCurve: [...DEFAULT_FAN_PRESETS.balanced],
    thermalThresholds: {
      cpuWarningC: 85,
      cpuCriticalC: 95,
      gpuWarningC: 82,
      gpuCriticalC: 89,
      ssdWarningC: 68,
      lowBatteryPct: 18,
      enableNotifications: true,
    },
    keyboard: {
      backlightEnabled: true,
      brightnessPct: 70,
      effect: 'static',
      primaryHex: '#38BDF8',
      secondaryHex: '#F97316',
      effectSpeed: 50,
      macrosEnabled: true,
      activeMacroProfile: 'Default Productivity',
      macros: [
        {
          id: 'macro-1',
          name: 'Switch to Gaming Profile',
          triggerKey: 'Ctrl+Alt+G',
          sequence: ['EVOL:MODE_GAMING'],
          delayMs: 25,
          enabled: true,
        },
        {
          id: 'macro-2',
          name: 'Open Performance Overlay',
          triggerKey: 'Ctrl+Alt+O',
          sequence: ['EVOL:TOGGLE_OVERLAY'],
          delayMs: 25,
          enabled: true,
        },
      ],
    },
    display: {
      activePreset: 'standard',
      refreshRateHz: 144,
      colorTempK: 6500,
      gamma: 1.0,
      contrastPct: 100,
      brightnessPct: 75,
      rgbGain: { r: 100, g: 100, b: 100 },
    },
    power: {
      activePlan: 'Balanced',
      minProcessorPct: 5,
      maxProcessorPct: 100,
      cpuBoostPolicy: 'Efficient Enabled',
      pcieLinkPowerManagement: 'Moderate',
      usbSelectiveSuspend: true,
      wirelessPowerMode: 'Medium Power Saving',
      screenTimeoutMinutes: 10,
      sleepTimeoutMinutes: 20,
      hibernateEnabled: true,
      batteryConservationMode: true,
    },
    customPowerProfiles: [],
    automationHistory: [],
  };
}

export function validateFanCurve(points: FanCurvePoint[]): { valid: boolean; error?: string } {
  if (!Array.isArray(points) || points.length < 3) {
    return { valid: false, error: 'Fan curve requires at least 3 thermal anchor points.' };
  }
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.tempC < 30 || pt.tempC > 95) {
      return { valid: false, error: `Temperature point ${pt.tempC}°C must stay within 30°C–95°C.` };
    }
    if (pt.speedPct < 20 || pt.speedPct > 100) {
      return { valid: false, error: `Fan duty ${pt.speedPct}% must stay within 20%–100%.` };
    }
    if (pt.tempC >= 85 && pt.speedPct < 75) {
      return { valid: false, error: `Thermal safety requires >= 75% fan duty at ${pt.tempC}°C.` };
    }
    if (i > 0) {
      if (pt.tempC <= points[i - 1].tempC) {
        return { valid: false, error: 'Curve temperatures must be strictly ascending.' };
      }
      if (pt.speedPct < points[i - 1].speedPct) {
        return { valid: false, error: 'Fan duty cannot decrease as temperature rises.' };
      }
    }
  }
  return { valid: true };
}

export function interpolateFanSpeed(points: FanCurvePoint[], tempC: number): number {
  if (points.length === 0) return 50;
  const sorted = [...points].sort((a, b) => a.tempC - b.tempC);
  if (tempC <= sorted[0].tempC) return sorted[0].speedPct;
  if (tempC >= sorted[sorted.length - 1].tempC) return sorted[sorted.length - 1].speedPct;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (tempC <= curr.tempC) {
      const ratio = (tempC - prev.tempC) / (curr.tempC - prev.tempC);
      return Math.round(prev.speedPct + ratio * (curr.speedPct - prev.speedPct));
    }
  }
  return sorted[sorted.length - 1].speedPct;
}

export function validatePowerLimits(pl1W: number, pl2W: number): { valid: boolean; error?: string } {
  if (pl1W < EVOL_P15_SAFE_LIMITS.minPl1W || pl1W > EVOL_P15_SAFE_LIMITS.maxPl1W) {
    return {
      valid: false,
      error: `PL1 must stay within manufacturer-approved range (${EVOL_P15_SAFE_LIMITS.minPl1W}W–${EVOL_P15_SAFE_LIMITS.maxPl1W}W).`,
    };
  }
  if (pl2W < EVOL_P15_SAFE_LIMITS.minPl2W || pl2W > EVOL_P15_SAFE_LIMITS.maxPl2W) {
    return {
      valid: false,
      error: `PL2 must stay within manufacturer-approved range (${EVOL_P15_SAFE_LIMITS.minPl2W}W–${EVOL_P15_SAFE_LIMITS.maxPl2W}W).`,
    };
  }
  if (pl2W < pl1W) {
    return { valid: false, error: 'Short-term boost limit (PL2) cannot be lower than sustained limit (PL1).' };
  }
  return { valid: true };
}

export function evaluateThermalAlerts(
  snapshot: TelemetrySnapshot,
  thresholds: ThermalThresholds,
): ThermalAlert[] {
  const alerts: ThermalAlert[] = [];

  if (snapshot.cpu.temperatureC !== null) {
    if (snapshot.cpu.temperatureC >= thresholds.cpuCriticalC) {
      alerts.push({
        id: 'cpu-critical',
        severity: 'critical',
        component: 'CPU',
        message: 'CPU package temperature reached critical threshold. Cooling prioritized.',
        valueLabel: `${snapshot.cpu.temperatureC}°C`,
      });
    } else if (snapshot.cpu.temperatureC >= thresholds.cpuWarningC) {
      alerts.push({
        id: 'cpu-warning',
        severity: 'warning',
        component: 'CPU',
        message: 'CPU temperature elevated above warning threshold.',
        valueLabel: `${snapshot.cpu.temperatureC}°C`,
      });
    }
  }

  if (snapshot.cpu.thermalThrottling === true) {
    alerts.push({
      id: 'cpu-throttle',
      severity: 'warning',
      component: 'CPU',
      message: 'CPU thermal throttling detected by PROCHOT hardware flag.',
      valueLabel: 'Active',
    });
  }

  if (snapshot.gpu.temperatureC !== null) {
    if (snapshot.gpu.temperatureC >= thresholds.gpuCriticalC) {
      alerts.push({
        id: 'gpu-critical',
        severity: 'critical',
        component: 'GPU',
        message: 'Discrete GPU reached critical thermal ceiling.',
        valueLabel: `${snapshot.gpu.temperatureC}°C`,
      });
    } else if (snapshot.gpu.temperatureC >= thresholds.gpuWarningC) {
      alerts.push({
        id: 'gpu-warning',
        severity: 'warning',
        component: 'GPU',
        message: 'Discrete GPU temperature elevated.',
        valueLabel: `${snapshot.gpu.temperatureC}°C`,
      });
    }
  }

  if (snapshot.storage.temperatureC !== null && snapshot.storage.temperatureC >= thresholds.ssdWarningC) {
    alerts.push({
      id: 'ssd-warning',
      severity: 'warning',
      component: 'SSD',
      message: 'NVMe SSD controller temperature elevated.',
      valueLabel: `${snapshot.storage.temperatureC}°C`,
    });
  }

  if (
    snapshot.battery.present &&
    snapshot.battery.percentage !== null &&
    snapshot.battery.acConnected === false &&
    snapshot.battery.percentage <= thresholds.lowBatteryPct
  ) {
    alerts.push({
      id: 'battery-low',
      severity: 'warning',
      component: 'Battery',
      message: 'Battery level below configured reserve threshold.',
      valueLabel: `${snapshot.battery.percentage}%`,
    });
  }

  return alerts;
}

export function computeStabilityScore(events: StabilityEvent[]): StabilityReport {
  const categoryMap = new Map<string, { count: number; points: number }>();
  let totalDeduction = 0;

  for (const ev of events) {
    totalDeduction += ev.weight;
    const prev = categoryMap.get(ev.category) ?? { count: 0, points: 0 };
    categoryMap.set(ev.category, {
      count: prev.count + 1,
      points: prev.points + ev.weight,
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  const rating: StabilityReport['rating'] = score >= 85 ? 'Optimal' : score >= 65 ? 'Attention' : 'Degraded';

  const deductions = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    points: data.points,
  }));

  return { score, rating, deductions };
}

export function buildProfilePlan(
  mode: PerformanceModeId,
  config: EvolConfig,
  capabilities: HardwareCapabilities,
): ProfileExecutionPlan {
  const profile = config.profiles[mode];
  const appliedSteps: string[] = [];
  const skippedSteps: Array<{ setting: string; reason: string }> = [];
  const validationErrors: string[] = [];

  const plCheck = validatePowerLimits(profile.pl1Watts, profile.pl2Watts);
  if (!plCheck.valid && plCheck.error) {
    validationErrors.push(plCheck.error);
  }

  if (capabilities.cpuPowerLimits.supported) {
    appliedSteps.push(
      `Applied Windows Power Plan (${profile.windowsPowerPlan}) and CPU PL1=${profile.pl1Watts}W / PL2=${profile.pl2Watts}W`,
    );
  } else {
    appliedSteps.push(`Saved EVOL profile intent (${profile.label}) in persistent configuration`);
    skippedSteps.push({
      setting: 'Windows PowerCfg & Intel PL1/PL2 Registers',
      reason: capabilities.cpuPowerLimits.reason,
    });
  }

  if (capabilities.gpuNvml.supported) {
    appliedSteps.push(`Set NVIDIA GPU PowerMizer policy to ${profile.gpuPerformanceMode}`);
  } else {
    skippedSteps.push({
      setting: 'NVIDIA NVML / NVAPI Performance Policy',
      reason: capabilities.gpuNvml.reason,
    });
  }

  if (capabilities.fanCurveWrite.supported) {
    appliedSteps.push(`Activated ${profile.fanPreset} fan curve policy`);
  } else {
    appliedSteps.push(`Updated target fan preset preference (${profile.fanPreset})`);
    skippedSteps.push({
      setting: 'Embedded Controller (EC) Direct Fan Duty',
      reason: capabilities.fanCurveWrite.reason,
    });
  }

  if (capabilities.displayRefreshSwitch.supported) {
    appliedSteps.push(`Set display refresh target to ${profile.targetRefreshRateHz} Hz`);
  } else {
    skippedSteps.push({
      setting: 'DXGI / User32 Refresh Rate Switch',
      reason: capabilities.displayRefreshSwitch.reason,
    });
  }

  return { mode, appliedSteps, skippedSteps, validationErrors };
}

export const CSV_HEADERS = [
  'timestamp',
  'cpu_temp_c',
  'cpu_utilization_pct',
  'cpu_clock_mhz',
  'cpu_power_w',
  'gpu_temp_c',
  'gpu_utilization_pct',
  'gpu_clock_mhz',
  'gpu_power_w',
  'ram_utilization_pct',
  'vram_utilization_pct',
  'fan_rpm',
  'ssd_temp_c',
  'battery_pct',
  'battery_power_w',
  'active_mode',
  'thermal_throttling',
] as const;

export function formatTelemetryCsvHeader(): string {
  return CSV_HEADERS.join(',');
}

function fmtOpt(val: number | null | undefined, digits = 1): string {
  if (val === null || val === undefined || Number.isNaN(val)) return 'N/A';
  return Number.isInteger(val) ? String(val) : val.toFixed(digits);
}

export function formatTelemetryCsvRow(snapshot: TelemetrySnapshot, activeMode: PerformanceModeId): string {
  const vramPct =
    snapshot.gpu.vramUsedMb !== null &&
    snapshot.gpu.vramTotalMb !== null &&
    snapshot.gpu.vramTotalMb > 0
      ? (snapshot.gpu.vramUsedMb / snapshot.gpu.vramTotalMb) * 100
      : null;

  const fanVal = snapshot.fans.cpuFanRpm ?? snapshot.fans.gpuFanRpm ?? null;
  const throttleStr =
    snapshot.cpu.thermalThrottling === null && snapshot.gpu.thermalThrottling === null
      ? 'N/A'
      : snapshot.cpu.thermalThrottling || snapshot.gpu.thermalThrottling
        ? 'YES'
        : 'NO';

  const fields = [
    snapshot.timestamp,
    fmtOpt(snapshot.cpu.temperatureC),
    fmtOpt(snapshot.cpu.utilizationPct),
    fmtOpt(snapshot.cpu.currentClockMhz, 0),
    fmtOpt(snapshot.cpu.packagePowerW),
    fmtOpt(snapshot.gpu.temperatureC),
    fmtOpt(snapshot.gpu.utilizationPct),
    fmtOpt(snapshot.gpu.clockMhz, 0),
    fmtOpt(snapshot.gpu.powerW),
    fmtOpt(snapshot.ram.utilizationPct),
    fmtOpt(vramPct),
    fmtOpt(fanVal, 0),
    fmtOpt(snapshot.storage.temperatureC),
    fmtOpt(snapshot.battery.percentage, 0),
    fmtOpt(snapshot.battery.chargeRateW),
    activeMode,
    throttleStr,
  ];
  return fields.join(',');
}

export function parseTelemetryCsv(csvText: string): CsvLogEntry[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const entries: CsvLogEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 17) continue;
    entries.push({
      timestamp: cols[0],
      cpuTempC: cols[1],
      cpuUtilPct: cols[2],
      cpuClockMhz: cols[3],
      cpuPowerW: cols[4],
      gpuTempC: cols[5],
      gpuUtilPct: cols[6],
      gpuClockMhz: cols[7],
      gpuPowerW: cols[8],
      ramUtilPct: cols[9],
      vramUtilPct: cols[10],
      fanRpm: cols[11],
      ssdTempC: cols[12],
      batteryPct: cols[13],
      batteryPowerW: cols[14],
      activeMode: cols[15],
      thermalThrottling: cols[16],
    });
  }
  return entries;
}

function parseNumericField(val: string): number | null {
  if (!val || val === 'N/A') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function computeModeComparison(rows: CsvLogEntry[]): ModeComparisonMetric[] {
  const byMode = new Map<string, CsvLogEntry[]>();
  for (const row of rows) {
    const list = byMode.get(row.activeMode) ?? [];
    list.push(row);
    byMode.set(row.activeMode, list);
  }

  const results: ModeComparisonMetric[] = [];
  for (const [mode, list] of byMode.entries()) {
    const cpuUtils = list.map((r) => parseNumericField(r.cpuUtilPct)).filter((v): v is number => v !== null);
    const cpuTemps = list.map((r) => parseNumericField(r.cpuTempC)).filter((v): v is number => v !== null);
    const gpuTemps = list.map((r) => parseNumericField(r.gpuTempC)).filter((v): v is number => v !== null);
    const ramUtils = list.map((r) => parseNumericField(r.ramUtilPct)).filter((v): v is number => v !== null);

    const avg = (arr: number[]) =>
      arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

    results.push({
      mode,
      samples: list.length,
      avgCpuUtilPct: avg(cpuUtils),
      peakCpuUtilPct: cpuUtils.length > 0 ? Number(Math.max(...cpuUtils).toFixed(1)) : null,
      avgCpuTempC: avg(cpuTemps),
      avgGpuTempC: avg(gpuTemps),
      avgRamUtilPct: avg(ramUtils),
    });
  }

  return results;
}
