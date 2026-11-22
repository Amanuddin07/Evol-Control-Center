export type PerformanceModeId = 'gaming' | 'work' | 'battery';
export type FanPresetId = 'silent' | 'balanced' | 'performance' | 'max' | 'custom';
export type DisplayPresetId = 'gaming' | 'cinema' | 'reading' | 'standard' | 'custom';
export type LightingEffectId = 'static' | 'breathing' | 'wave' | 'rainbow' | 'reactive' | 'custom';

export type NavSectionId =
  | 'dashboard'
  | 'system-info'
  | 'performance-monitor'
  | 'cpu-control'
  | 'gpu-control'
  | 'thermal-fan'
  | 'profiles'
  | 'keyboard-macros'
  | 'display'
  | 'bios-firmware'
  | 'power'
  | 'updates'
  | 'diagnostics'
  | 'logging'
  | 'settings';

export interface CapabilityDescriptor {
  supported: boolean;
  provider: string;
  reason: string;
}

export interface HardwareCapabilities {
  cpuSensors: CapabilityDescriptor;
  cpuPowerLimits: CapabilityDescriptor;
  cpuVoltageControl: CapabilityDescriptor;
  gpuNvml: CapabilityDescriptor;
  gpuPowerLimit: CapabilityDescriptor;
  fanRpmRead: CapabilityDescriptor;
  fanCurveWrite: CapabilityDescriptor;
  keyboardRgb: CapabilityDescriptor;
  keyboardPerKey: CapabilityDescriptor;
  displayRefreshSwitch: CapabilityDescriptor;
  displaySoftwareColor: CapabilityDescriptor;
  batteryAcpi: CapabilityDescriptor;
  uefiFirmwareReboot: CapabilityDescriptor;
  biosFlashing: CapabilityDescriptor;
}

export interface TelemetrySnapshot {
  timestamp: string;
  source: 'linux-host' | 'windows-agent';
  hostPlatform: string;
  agentConnected: boolean;
  agentUrl: string;
  cpu: {
    model: string;
    vendor: string;
    cores: number;
    threads: number;
    baseClockMhz: number | null;
    maxBoostClockMhz: number | null;
    currentClockMhz: number | null;
    utilizationPct: number;
    temperatureC: number | null;
    coreTempsC: number[] | null;
    packagePowerW: number | null;
    voltageV: number | null;
    thermalThrottling: boolean | null;
    powerLimitThrottling: boolean | null;
  };
  gpu: {
    available: boolean;
    model: string | null;
    utilizationPct: number | null;
    temperatureC: number | null;
    hotspotC: number | null;
    clockMhz: number | null;
    vramUsedMb: number | null;
    vramTotalMb: number | null;
    powerW: number | null;
    voltageV: number | null;
    fanRpm: number | null;
    thermalThrottling: boolean | null;
    powerThrottling: boolean | null;
  };
  ram: {
    totalGb: number;
    availableGb: number;
    usedGb: number;
    utilizationPct: number;
    frequencyMhz: number | null;
    ddrGen: string | null;
    modules: number | null;
    channelConfig: string | null;
  };
  storage: {
    mount: string;
    model: string | null;
    totalGb: number;
    availableGb: number;
    usedGb: number;
    utilizationPct: number;
    temperatureC: number | null;
    readMbPerSec: number | null;
    writeMbPerSec: number | null;
    smartHealth: string | null;
    remainingLifePct: number | null;
  };
  fans: {
    cpuFanRpm: number | null;
    gpuFanRpm: number | null;
    ecControlSupported: boolean;
  };
  battery: {
    present: boolean;
    percentage: number | null;
    status: string;
    wearLevelPct: number | null;
    fullChargeWh: number | null;
    designCapacityWh: number | null;
    chargeRateW: number | null;
    cycleCount: number | null;
    temperatureC: number | null;
    acConnected: boolean | null;
    acWattageW: number | null;
  };
  system: {
    motherboard: string | null;
    biosVendor: string | null;
    biosVersion: string | null;
    biosDate: string | null;
    osName: string;
    osBuild: string;
    hostname: string;
    uptimeSeconds: number;
    loadAvg1m: number;
    secureBoot: string | null;
    tpmStatus: string | null;
    virtualization: string | null;
  };
  network: Array<{
    name: string;
    address: string;
    family: string;
    mac: string;
    internal: boolean;
  }>;
  display: {
    resolution: string | null;
    refreshRateHz: number | null;
    supportedRefreshRates: number[];
    scalingPct: number | null;
    brightnessPct: number | null;
  };
  totalSystemPowerW: number | null;
  capabilities: HardwareCapabilities;
}

export interface FanCurvePoint {
  tempC: number;
  speedPct: number;
}

export interface PerformanceProfileSettings {
  id: PerformanceModeId;
  label: string;
  description: string;
  windowsPowerPlan: 'High Performance' | 'Balanced' | 'Power Saver';
  cpuBoostPolicy: 'Aggressive' | 'Efficient Enabled' | 'Disabled';
  pl1Watts: number;
  pl2Watts: number;
  maxCpuTempC: number;
  gpuPerformanceMode: 'Maximum Performance' | 'Optimal Power' | 'Adaptive';
  gpuPowerLimitWatts: number;
  targetRefreshRateHz: number;
  fanPreset: FanPresetId;
  brightnessPct: number;
  autoGameDetection: boolean;
}

export interface ThermalThresholds {
  cpuWarningC: number;
  cpuCriticalC: number;
  gpuWarningC: number;
  gpuCriticalC: number;
  ssdWarningC: number;
  lowBatteryPct: number;
  enableNotifications: boolean;
}

export interface MacroDefinition {
  id: string;
  name: string;
  triggerKey: string;
  sequence: string[];
  delayMs: number;
  enabled: boolean;
}

export interface KeyboardConfig {
  backlightEnabled: boolean;
  brightnessPct: number;
  effect: LightingEffectId;
  primaryHex: string;
  secondaryHex: string;
  effectSpeed: number;
  macrosEnabled: boolean;
  activeMacroProfile: string;
  macros: MacroDefinition[];
}

export interface DisplayConfig {
  activePreset: DisplayPresetId;
  refreshRateHz: number;
  colorTempK: number;
  gamma: number;
  contrastPct: number;
  brightnessPct: number;
  rgbGain: { r: number; g: number; b: number };
}

export interface PowerConfig {
  activePlan: 'High Performance' | 'Balanced' | 'Power Saver' | 'Custom';
  minProcessorPct: number;
  maxProcessorPct: number;
  cpuBoostPolicy: 'Aggressive' | 'Efficient Enabled' | 'Disabled';
  pcieLinkPowerManagement: 'Off' | 'Moderate' | 'Maximum Power Savings';
  usbSelectiveSuspend: boolean;
  wirelessPowerMode: 'Maximum Performance' | 'Low Power Saving' | 'Medium Power Saving';
  screenTimeoutMinutes: number;
  sleepTimeoutMinutes: number;
  hibernateEnabled: boolean;
  batteryConservationMode: boolean;
}

export interface AutomationEvent {
  id: string;
  timestamp: string;
  action: string;
  status: 'applied' | 'partial' | 'reverted' | 'blocked';
  summary: string;
  appliedSteps: string[];
  skippedSteps: string[];
}

export interface EvolConfig {
  activeMode: PerformanceModeId;
  samplingIntervalMs: number;
  loggingIntervalSec: number;
  loggingDirectory: string;
  launchWithWindows: boolean;
  minimizeToTray: boolean;
  alwaysOnTopOverlay: boolean;
  autoUpdateCheck: boolean;
  autoGameDetection: boolean;
  detectedGamesList: string[];
  agentUrl: string;
  profiles: Record<PerformanceModeId, PerformanceProfileSettings>;
  fanPreset: FanPresetId;
  cpuFanCurve: FanCurvePoint[];
  gpuFanCurve: FanCurvePoint[];
  thermalThresholds: ThermalThresholds;
  keyboard: KeyboardConfig;
  display: DisplayConfig;
  power: PowerConfig;
  customPowerProfiles: Array<{ id: string; name: string; config: PowerConfig }>;
  automationHistory: AutomationEvent[];
}

export interface ThermalAlert {
  id: string;
  severity: 'warning' | 'critical';
  component: 'CPU' | 'GPU' | 'SSD' | 'Battery';
  message: string;
  valueLabel: string;
}

export interface ProfileExecutionPlan {
  mode: PerformanceModeId;
  appliedSteps: string[];
  skippedSteps: Array<{ setting: string; reason: string }>;
  validationErrors: string[];
}

export interface CsvLogEntry {
  timestamp: string;
  cpuTempC: string;
  cpuUtilPct: string;
  cpuClockMhz: string;
  cpuPowerW: string;
  gpuTempC: string;
  gpuUtilPct: string;
  gpuClockMhz: string;
  gpuPowerW: string;
  ramUtilPct: string;
  vramUtilPct: string;
  fanRpm: string;
  ssdTempC: string;
  batteryPct: string;
  batteryPowerW: string;
  activeMode: string;
  thermalThrottling: string;
}

export interface ModeComparisonMetric {
  mode: string;
  samples: number;
  avgCpuUtilPct: number | null;
  peakCpuUtilPct: number | null;
  avgCpuTempC: number | null;
  avgGpuTempC: number | null;
  avgRamUtilPct: number | null;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  rssMb: number;
  state: string;
  command: string;
}

export interface StabilityEvent {
  id: string;
  timestamp: string;
  category: 'unexpected_shutdown' | 'bsod' | 'app_crash' | 'hardware_error' | 'thermal_event' | 'driver_failure';
  source: string;
  message: string;
  weight: number;
}

export interface StabilityReport {
  score: number;
  rating: 'Optimal' | 'Attention' | 'Degraded';
  deductions: Array<{ category: string; count: number; points: number }>;
}

export interface CompatibilityComponent {
  subsystem: string;
  evolP15Spec: string;
  interfaceUsed: string;
  supportLevel: 'Full Control' | 'Read-Only / Partial' | 'OS-Level Alternative' | 'Locked by BIOS/EC';
  notes: string;
}
