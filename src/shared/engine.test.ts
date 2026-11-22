import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfilePlan,
  computeModeComparison,
  computeStabilityScore,
  createDefaultConfig,
  DEFAULT_FAN_PRESETS,
  evaluateThermalAlerts,
  formatTelemetryCsvHeader,
  formatTelemetryCsvRow,
  interpolateFanSpeed,
  parseTelemetryCsv,
  validateFanCurve,
  validatePowerLimits,
} from './engine.ts';
import type { TelemetrySnapshot } from './types.ts';

function makeSnapshot(overrides?: Partial<TelemetrySnapshot>): TelemetrySnapshot {
  const base: TelemetrySnapshot = {
    timestamp: '2026-11-21T22:00:00.000Z',
    source: 'linux-host',
    hostPlatform: 'linux',
    agentConnected: false,
    agentUrl: 'http://127.0.0.1:17830',
    cpu: {
      model: 'Test Host CPU',
      vendor: 'AuthenticAMD',
      cores: 8,
      threads: 8,
      baseClockMhz: 3000,
      maxBoostClockMhz: null,
      currentClockMhz: 3096,
      utilizationPct: 24.5,
      temperatureC: null,
      coreTempsC: null,
      packagePowerW: null,
      voltageV: null,
      thermalThrottling: null,
      powerLimitThrottling: null,
    },
    gpu: {
      available: false,
      model: null,
      utilizationPct: null,
      temperatureC: null,
      hotspotC: null,
      clockMhz: null,
      vramUsedMb: null,
      vramTotalMb: null,
      powerW: null,
      voltageV: null,
      fanRpm: null,
      thermalThrottling: null,
      powerThrottling: null,
    },
    ram: {
      totalGb: 16,
      availableGb: 10,
      usedGb: 6,
      utilizationPct: 37.5,
      frequencyMhz: null,
      ddrGen: null,
      modules: null,
      channelConfig: null,
    },
    storage: {
      mount: '/',
      model: null,
      totalGb: 100,
      availableGb: 70,
      usedGb: 30,
      utilizationPct: 30,
      temperatureC: null,
      readMbPerSec: null,
      writeMbPerSec: null,
      smartHealth: null,
      remainingLifePct: null,
    },
    fans: {
      cpuFanRpm: null,
      gpuFanRpm: null,
      ecControlSupported: false,
    },
    battery: {
      present: false,
      percentage: null,
      status: 'Unavailable',
      wearLevelPct: null,
      fullChargeWh: null,
      designCapacityWh: null,
      chargeRateW: null,
      cycleCount: null,
      temperatureC: null,
      acConnected: null,
      acWattageW: null,
    },
    system: {
      motherboard: null,
      biosVendor: null,
      biosVersion: null,
      biosDate: null,
      osName: 'Linux',
      osBuild: '6.x',
      hostname: 'host',
      uptimeSeconds: 1200,
      loadAvg1m: 0.4,
      secureBoot: null,
      tpmStatus: null,
      virtualization: null,
    },
    network: [],
    display: {
      resolution: null,
      refreshRateHz: null,
      supportedRefreshRates: [],
      scalingPct: null,
      brightnessPct: null,
    },
    totalSystemPowerW: null,
    capabilities: {
      cpuSensors: { supported: true, provider: '/proc', reason: 'Host CPU utilization active' },
      cpuPowerLimits: { supported: false, provider: 'Windows PowrProf', reason: 'Requires Windows Agent' },
      cpuVoltageControl: { supported: false, provider: 'Intel FIVR', reason: 'Locked by BIOS' },
      gpuNvml: { supported: false, provider: 'NVML', reason: 'Requires Windows Agent' },
      gpuPowerLimit: { supported: false, provider: 'NVML', reason: 'Requires Windows Agent' },
      fanRpmRead: { supported: false, provider: 'EC WMI', reason: 'Requires Windows Agent' },
      fanCurveWrite: { supported: false, provider: 'EC WMI', reason: 'Requires Windows Agent' },
      keyboardRgb: { supported: false, provider: 'HID', reason: 'Requires Windows Agent' },
      keyboardPerKey: { supported: false, provider: 'HID', reason: 'Single-zone hardware' },
      displayRefreshSwitch: { supported: false, provider: 'User32', reason: 'Requires Windows Agent' },
      displaySoftwareColor: { supported: true, provider: 'CSS/Gamma', reason: 'Preview active' },
      batteryAcpi: { supported: false, provider: 'ACPI', reason: 'Requires Windows Agent' },
      uefiFirmwareReboot: { supported: false, provider: 'Windows', reason: 'Requires Windows Agent' },
      biosFlashing: { supported: false, provider: 'OEM', reason: 'Blocked for safety' },
    },
  };
  return { ...base, ...overrides };
}

test('validateFanCurve accepts safe presets and rejects unsafe low fan speed at high temp', () => {
  assert.equal(validateFanCurve(DEFAULT_FAN_PRESETS.balanced).valid, true);
  assert.equal(validateFanCurve(DEFAULT_FAN_PRESETS.max).valid, true);

  const unsafe = validateFanCurve([
    { tempC: 40, speedPct: 25 },
    { tempC: 60, speedPct: 40 },
    { tempC: 88, speedPct: 35 },
  ]);
  assert.equal(unsafe.valid, false);
});

test('interpolateFanSpeed computes linear fan duty between points', () => {
  const curve = [
    { tempC: 40, speedPct: 20 },
    { tempC: 60, speedPct: 60 },
    { tempC: 85, speedPct: 100 },
  ];
  assert.equal(interpolateFanSpeed(curve, 30), 20);
  assert.equal(interpolateFanSpeed(curve, 50), 40);
  assert.equal(interpolateFanSpeed(curve, 90), 100);
});

test('validatePowerLimits prevents exceeding Evol P15 manufacturer bounds', () => {
  assert.equal(validatePowerLimits(45, 95).valid, true);
  assert.equal(validatePowerLimits(70, 95).valid, false);
  assert.equal(validatePowerLimits(45, 140).valid, false);
  assert.equal(validatePowerLimits(50, 40).valid, false);
});

test('evaluateThermalAlerts never triggers on null sensors and catches real spikes', () => {
  const config = createDefaultConfig();
  const clean = makeSnapshot();
  assert.equal(evaluateThermalAlerts(clean, config.thermalThresholds).length, 0);

  const hot = makeSnapshot({
    cpu: { ...clean.cpu, temperatureC: 96, thermalThrottling: true },
    gpu: { ...clean.gpu, available: true, temperatureC: 85 },
  });
  const alerts = evaluateThermalAlerts(hot, config.thermalThresholds);
  assert.equal(alerts.length, 3);
  assert.equal(alerts[0].severity, 'critical');
});

test('computeStabilityScore deducts transparently from real stability events', () => {
  assert.equal(computeStabilityScore([]).score, 100);
  const report = computeStabilityScore([
    {
      id: '1',
      timestamp: '2026-11-21T20:00:00Z',
      category: 'app_crash',
      source: 'Application Error',
      message: 'Process crashed',
      weight: 5,
    },
    {
      id: '2',
      timestamp: '2026-11-21T21:00:00Z',
      category: 'unexpected_shutdown',
      source: 'Kernel-Power 41',
      message: 'Unexpected loss of power',
      weight: 15,
    },
  ]);
  assert.equal(report.score, 80);
  assert.equal(report.rating, 'Attention');
  assert.equal(report.deductions.length, 2);
});

test('buildProfilePlan separates supported actions from Windows-only skipped steps', () => {
  const config = createDefaultConfig();
  const snap = makeSnapshot();
  const plan = buildProfilePlan('gaming', config, snap.capabilities);
  assert.equal(plan.validationErrors.length, 0);
  assert.ok(plan.appliedSteps.length >= 1);
  assert.ok(plan.skippedSteps.length >= 2);
});

test('CSV formatting and parsing round-trips with N/A for missing sensors', () => {
  const snap = makeSnapshot();
  const csv = `${formatTelemetryCsvHeader()}\n${formatTelemetryCsvRow(snap, 'gaming')}\n${formatTelemetryCsvRow(
    { ...snap, cpu: { ...snap.cpu, utilizationPct: 45.5, temperatureC: 74 } },
    'gaming',
  )}`;
  const parsed = parseTelemetryCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].gpuTempC, 'N/A');
  assert.equal(parsed[0].activeMode, 'gaming');

  const comp = computeModeComparison(parsed);
  assert.equal(comp.length, 1);
  assert.equal(comp[0].avgCpuUtilPct, 35);
  assert.equal(comp[0].avgCpuTempC, 74);
});
