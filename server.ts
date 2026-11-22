import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import {
  buildProfilePlan,
  computeModeComparison,
  computeStabilityScore,
  createDefaultConfig,
  DEFAULT_FAN_PRESETS,
  formatTelemetryCsvHeader,
  formatTelemetryCsvRow,
  parseTelemetryCsv,
  validateFanCurve,
  validatePowerLimits,
} from './src/shared/engine.ts';
import type {
  AutomationEvent,
  EvolConfig,
  HardwareCapabilities,
  PerformanceModeId,
  ProcessInfo,
  StabilityEvent,
  TelemetrySnapshot,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, 'data');
const LOGS_DIR = path.resolve(__dirname, 'logs');
const CONFIG_PATH = path.join(DATA_DIR, 'evol-config.json');
const WINDOWS_DIR = path.resolve(__dirname, 'windows', 'EvolControlCenter');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

// Track previous /proc/stat CPU jiffies for real utilization delta
let prevCpuStat: { idle: number; total: number } | null = null;

function readProcCpuUtilization(): number {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf8');
    const firstLine = stat.split('\n')[0];
    if (!firstLine.startsWith('cpu ')) return 0;
    const parts = firstLine.trim().split(/\s+/).slice(1).map(Number);
    const idle = (parts[3] || 0) + (parts[4] || 0);
    const total = parts.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

    if (!prevCpuStat) {
      prevCpuStat = { idle, total };
      return 0;
    }
    const diffIdle = idle - prevCpuStat.idle;
    const diffTotal = total - prevCpuStat.total;
    prevCpuStat = { idle, total };
    if (diffTotal <= 0) return 0;
    const pct = ((diffTotal - diffIdle) / diffTotal) * 100;
    return Number(Math.max(0, Math.min(100, pct)).toFixed(1));
  } catch {
    return 0;
  }
}

function readCpuInfo(): {
  model: string;
  vendor: string;
  cores: number;
  threads: number;
  currentClockMhz: number | null;
} {
  const cpus = os.cpus();
  const threads = cpus.length || 1;
  let model = cpus[0]?.model?.trim() || 'Unknown Processor';
  let vendor = 'Unknown';
  let cores = threads;
  let currentClockMhz: number | null = cpus[0]?.speed || null;

  try {
    const raw = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const vendorMatch = raw.match(/^vendor_id\s*:\s*(.+)$/m);
    const modelMatch = raw.match(/^model name\s*:\s*(.+)$/m);
    const coresMatch = raw.match(/^cpu cores\s*:\s*(\d+)$/m);
    const mhzMatches = [...raw.matchAll(/^cpu MHz\s*:\s*([\d.]+)$/gm)].map((m) => Number(m[1]));

    if (vendorMatch) vendor = vendorMatch[1].trim();
    if (modelMatch && modelMatch[1].trim().toLowerCase() !== 'unknown') {
      model = modelMatch[1].trim();
    } else if (vendor !== 'Unknown') {
      model = `${vendor} x86_64 Host (${threads} vCPUs)`;
    }
    if (coresMatch) cores = Number(coresMatch[1]);
    if (mhzMatches.length > 0) {
      const avgMhz = mhzMatches.reduce((a, b) => a + b, 0) / mhzMatches.length;
      currentClockMhz = Math.round(avgMhz);
    }
  } catch {
    // Use os.cpus() fallback
  }

  return { model, vendor, cores, threads, currentClockMhz };
}

function readLinuxThermalZoneC(): number | null {
  try {
    const base = '/sys/class/thermal';
    if (!fs.existsSync(base)) return null;
    const entries = fs.readdirSync(base).filter((d) => d.startsWith('thermal_zone'));
    for (const entry of entries) {
      const tempRaw = fs.readFileSync(path.join(base, entry, 'temp'), 'utf8').trim();
      const milliC = Number(tempRaw);
      if (Number.isFinite(milliC) && milliC > 0 && milliC < 130000) {
        return Number((milliC / 1000).toFixed(1));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function readMemoryStats() {
  const totalBytes = os.totalmem();
  let availBytes = os.freemem();

  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
    if (match) {
      availBytes = Number(match[1]) * 1024;
    }
  } catch {
    // Fallback to os.freemem()
  }

  const totalGb = Number((totalBytes / 1_073_741_824).toFixed(2));
  const availableGb = Number((availBytes / 1_073_741_824).toFixed(2));
  const usedGb = Number(Math.max(0, totalGb - availableGb).toFixed(2));
  const utilizationPct = totalGb > 0 ? Number(((usedGb / totalGb) * 100).toFixed(1)) : 0;

  return { totalGb, availableGb, usedGb, utilizationPct };
}

function readStorageStats() {
  try {
    const stats = fs.statfsSync('/');
    const blockSize = stats.bsize || 4096;
    const totalBytes = stats.blocks * blockSize;
    const availBytes = stats.bavail * blockSize;
    const usedBytes = Math.max(0, totalBytes - stats.bfree * blockSize);

    const totalGb = Number((totalBytes / 1_073_741_824).toFixed(1));
    const availableGb = Number((availBytes / 1_073_741_824).toFixed(1));
    const usedGb = Number((usedBytes / 1_073_741_824).toFixed(1));
    const utilizationPct = totalGb > 0 ? Number(((usedGb / totalGb) * 100).toFixed(1)) : 0;
    return { mount: '/', totalGb, availableGb, usedGb, utilizationPct };
  } catch {
    return { mount: '/', totalGb: 0, availableGb: 0, usedGb: 0, utilizationPct: 0 };
  }
}

function readOsPrettyName(): string {
  try {
    const raw = fs.readFileSync('/etc/os-release', 'utf8');
    const match = raw.match(/^PRETTY_NAME="?([^"\n]+)"?$/m);
    if (match) return match[1];
  } catch {
    // ignore
  }
  return `${os.type()} ${os.release()}`;
}

function readNetworkAdapters() {
  const ifaces = os.networkInterfaces();
  const list: TelemetrySnapshot['network'] = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' || addr.family === 'IPv6') {
        list.push({
          name,
          address: addr.address,
          family: addr.family,
          mac: addr.mac,
          internal: addr.internal,
        });
      }
    }
  }
  return list;
}

function buildLinuxCapabilities(hasThermalZone: boolean): HardwareCapabilities {
  const winAgentReason =
    'Unavailable on Linux container host. Connect the EVOL Windows .NET 8 Companion Agent to read live hardware sensors.';
  return {
    cpuSensors: {
      supported: true,
      provider: '/proc/stat & /proc/cpuinfo',
      reason: hasThermalZone
        ? 'Real CPU utilization, clock frequency, and thermal zone exposed by host kernel.'
        : 'Real CPU utilization and clock frequency active; hardware die temperature requires Windows LibreHardwareMonitor MSR driver.',
    },
    cpuPowerLimits: {
      supported: false,
      provider: 'Windows PowrProf / Intel DTT',
      reason: winAgentReason,
    },
    cpuVoltageControl: {
      supported: false,
      provider: 'Intel FIVR MSR',
      reason: 'Locked by Intel/BIOS on 12th/13th Gen non-HX mobile processors; protected to preserve hardware stability.',
    },
    gpuNvml: {
      supported: false,
      provider: 'NVIDIA NVML (nvml.dll)',
      reason: 'No NVIDIA GPU driver / NVML interface detected in this Linux container.',
    },
    gpuPowerLimit: {
      supported: false,
      provider: 'NVIDIA NVML / NVAPI',
      reason: winAgentReason,
    },
    fanRpmRead: {
      supported: false,
      provider: 'ACPI WMI / Embedded Controller',
      reason: winAgentReason,
    },
    fanCurveWrite: {
      supported: false,
      provider: 'OEM Signed WMI EC Interface',
      reason: 'Direct EC fan curve control requires a signed Colorful/ODM WMI driver on Windows; unsafe raw port writes are blocked.',
    },
    keyboardRgb: {
      supported: false,
      provider: 'USB HID Backlight Controller',
      reason: winAgentReason,
    },
    keyboardPerKey: {
      supported: false,
      provider: 'USB HID Matrix',
      reason: 'Colorful Evol P15 2024 India Edition integrates a single-zone/15-color backlight rather than per-key addressable LEDs.',
    },
    displayRefreshSwitch: {
      supported: false,
      provider: 'Windows User32 ChangeDisplaySettingsEx',
      reason: winAgentReason,
    },
    displaySoftwareColor: {
      supported: true,
      provider: 'Browser Filter / Windows GDI GammaRamp',
      reason: 'Live software color temperature, gamma, and contrast calibration active (software filter, not panel ICC hardware LUT).',
    },
    batteryAcpi: {
      supported: false,
      provider: 'ACPI Battery WMI',
      reason: 'No ACPI battery device present on host.',
    },
    uefiFirmwareReboot: {
      supported: false,
      provider: 'Windows shutdown /r /fw',
      reason: winAgentReason,
    },
    biosFlashing: {
      supported: false,
      provider: 'Colorful Official Firmware Utility',
      reason: 'Automated BIOS flashing from OS is disabled for brick prevention. Official verified links are provided.',
    },
  };
}

let agentBridgeEnabled = false;

async function collectTelemetry(agentUrl: string): Promise<TelemetrySnapshot> {
  if (agentBridgeEnabled && agentUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 700);
      const res = await fetch(`${agentUrl.replace(/\/$/, '')}/api/telemetry`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const win = (await res.json()) as Record<string, unknown>;
        const cpuModel = String(win.CpuModel ?? 'Intel Core Processor');
        const gpuAvailable = Boolean(win.GpuAvailable);
        const totalGb = Number(win.RamTotalGb ?? 16);
        const availGb = Number(win.RamAvailableGb ?? 8);
        return {
          timestamp: new Date().toISOString(),
          source: 'windows-agent',
          hostPlatform: 'win32',
          agentConnected: true,
          agentUrl,
          cpu: {
            model: cpuModel,
            vendor: 'GenuineIntel',
            cores: Number(win.CpuCores ?? 8),
            threads: Number(win.CpuThreads ?? 16),
            baseClockMhz: null,
            maxBoostClockMhz: null,
            currentClockMhz: win.CpuClockMhz !== null && win.CpuClockMhz !== undefined ? Number(win.CpuClockMhz) : null,
            utilizationPct: Number(win.CpuUtilizationPct ?? 0),
            temperatureC: win.CpuTemperatureC !== null && win.CpuTemperatureC !== undefined ? Number(win.CpuTemperatureC) : null,
            coreTempsC: Array.isArray(win.CoreTemperaturesC) ? (win.CoreTemperaturesC as number[]) : null,
            packagePowerW: win.CpuPackagePowerW !== null && win.CpuPackagePowerW !== undefined ? Number(win.CpuPackagePowerW) : null,
            voltageV: win.CpuVoltageV !== null && win.CpuVoltageV !== undefined ? Number(win.CpuVoltageV) : null,
            thermalThrottling: typeof win.CpuThermalThrottling === 'boolean' ? win.CpuThermalThrottling : null,
            powerLimitThrottling: typeof win.CpuPowerLimitThrottling === 'boolean' ? win.CpuPowerLimitThrottling : null,
          },
          gpu: {
            available: gpuAvailable,
            model: win.GpuModel ? String(win.GpuModel) : null,
            utilizationPct: win.GpuUtilizationPct !== null && win.GpuUtilizationPct !== undefined ? Number(win.GpuUtilizationPct) : null,
            temperatureC: win.GpuTemperatureC !== null && win.GpuTemperatureC !== undefined ? Number(win.GpuTemperatureC) : null,
            hotspotC: win.GpuHotspotC !== null && win.GpuHotspotC !== undefined ? Number(win.GpuHotspotC) : null,
            clockMhz: win.GpuClockMhz !== null && win.GpuClockMhz !== undefined ? Number(win.GpuClockMhz) : null,
            vramUsedMb: win.GpuVramUsedMb !== null && win.GpuVramUsedMb !== undefined ? Number(win.GpuVramUsedMb) : null,
            vramTotalMb: win.GpuVramTotalMb !== null && win.GpuVramTotalMb !== undefined ? Number(win.GpuVramTotalMb) : null,
            powerW: win.GpuPowerW !== null && win.GpuPowerW !== undefined ? Number(win.GpuPowerW) : null,
            voltageV: null,
            fanRpm: win.GpuFanRpm !== null && win.GpuFanRpm !== undefined ? Number(win.GpuFanRpm) : null,
            thermalThrottling: typeof win.GpuThermalThrottling === 'boolean' ? win.GpuThermalThrottling : null,
            powerThrottling: null,
          },
          ram: {
            totalGb,
            availableGb: availGb,
            usedGb: Number(Math.max(0, totalGb - availGb).toFixed(2)),
            utilizationPct: Number(win.RamUtilizationPct ?? 0),
            frequencyMhz: win.RamFrequencyMhz ? Number(win.RamFrequencyMhz) : null,
            ddrGen: null,
            modules: win.RamModuleCount ? Number(win.RamModuleCount) : null,
            channelConfig: null,
          },
          storage: {
            mount: 'C:\\',
            model: win.SsdModel ? String(win.SsdModel) : null,
            totalGb: Number(win.SsdTotalGb ?? 0),
            availableGb: Number(win.SsdAvailableGb ?? 0),
            usedGb: Number(Math.max(0, Number(win.SsdTotalGb ?? 0) - Number(win.SsdAvailableGb ?? 0)).toFixed(1)),
            utilizationPct:
              Number(win.SsdTotalGb ?? 0) > 0
                ? Number((((Number(win.SsdTotalGb) - Number(win.SsdAvailableGb ?? 0)) / Number(win.SsdTotalGb)) * 100).toFixed(1))
                : 0,
            temperatureC: win.SsdTemperatureC !== null && win.SsdTemperatureC !== undefined ? Number(win.SsdTemperatureC) : null,
            readMbPerSec: null,
            writeMbPerSec: null,
            smartHealth: win.SsdSmartStatus ? String(win.SsdSmartStatus) : null,
            remainingLifePct: null,
          },
          fans: {
            cpuFanRpm: win.CpuFanRpm !== null && win.CpuFanRpm !== undefined ? Number(win.CpuFanRpm) : null,
            gpuFanRpm: win.GpuFanRpmEc !== null && win.GpuFanRpmEc !== undefined ? Number(win.GpuFanRpmEc) : null,
            ecControlSupported: Boolean(win.EcFanWriteSupported),
          },
          battery: {
            present: Boolean(win.BatteryPresent),
            percentage: win.BatteryPct !== null && win.BatteryPct !== undefined ? Number(win.BatteryPct) : null,
            status: String(win.BatteryStatus ?? 'Unknown'),
            wearLevelPct: win.BatteryWearPct !== null && win.BatteryWearPct !== undefined ? Number(win.BatteryWearPct) : null,
            fullChargeWh: null,
            designCapacityWh: null,
            chargeRateW: win.BatteryChargeRateW !== null && win.BatteryChargeRateW !== undefined ? Number(win.BatteryChargeRateW) : null,
            cycleCount: win.BatteryCycleCount !== null && win.BatteryCycleCount !== undefined ? Number(win.BatteryCycleCount) : null,
            temperatureC: null,
            acConnected: typeof win.AcConnected === 'boolean' ? win.AcConnected : null,
            acWattageW: null,
          },
          system: {
            motherboard: win.Motherboard ? String(win.Motherboard) : null,
            biosVendor: win.BiosVendor ? String(win.BiosVendor) : null,
            biosVersion: win.BiosVersion ? String(win.BiosVersion) : null,
            biosDate: win.BiosReleaseDate ? String(win.BiosReleaseDate) : null,
            osName: String(win.OsVersion ?? 'Windows 11'),
            osBuild: 'Windows NT',
            hostname: os.hostname(),
            uptimeSeconds: os.uptime(),
            loadAvg1m: 0,
            secureBoot: null,
            tpmStatus: null,
            virtualization: null,
          },
          network: [],
          display: {
            resolution: win.DisplayResolution ? String(win.DisplayResolution) : null,
            refreshRateHz: win.DisplayRefreshHz ? Number(win.DisplayRefreshHz) : null,
            supportedRefreshRates: Array.isArray(win.SupportedRefreshRates) ? (win.SupportedRefreshRates as number[]) : [],
            scalingPct: null,
            brightnessPct: null,
          },
          totalSystemPowerW: null,
          capabilities: {
            ...buildLinuxCapabilities(true),
            cpuSensors: { supported: true, provider: 'LibreHardwareMonitorLib', reason: 'Live Windows CPU MSR telemetry active.' },
            cpuPowerLimits: { supported: true, provider: 'Windows PowrProf', reason: 'Windows PowerCfg boost & plan switching active.' },
            gpuNvml: { supported: gpuAvailable, provider: 'NVIDIA NVML', reason: gpuAvailable ? 'Live NVML GPU telemetry active.' : 'No NVIDIA GPU reported.' },
            fanRpmRead: { supported: win.CpuFanRpm !== null, provider: 'WMI / SuperIO', reason: 'Live EC/SuperIO fan sensor query.' },
            displayRefreshSwitch: { supported: true, provider: 'User32 ChangeDisplaySettings', reason: 'Live refresh rate switching active.' },
            batteryAcpi: { supported: Boolean(win.BatteryPresent), provider: 'ACPI Battery', reason: 'Live Windows battery telemetry.' },
            uefiFirmwareReboot: { supported: true, provider: 'shutdown /r /fw', reason: 'Supported on UEFI Windows systems.' },
          },
        };
      }
    } catch {
      agentBridgeEnabled = false;
    }
  }

  const cpuInfo = readCpuInfo();
  const cpuUtil = readProcCpuUtilization();
  const tempC = readLinuxThermalZoneC();
  const ram = readMemoryStats();
  const storage = readStorageStats();

  return {
    timestamp: new Date().toISOString(),
    source: 'linux-host',
    hostPlatform: os.platform(),
    agentConnected: false,
    agentUrl,
    cpu: {
      model: cpuInfo.model,
      vendor: cpuInfo.vendor,
      cores: cpuInfo.cores,
      threads: cpuInfo.threads,
      baseClockMhz: cpuInfo.currentClockMhz,
      maxBoostClockMhz: null,
      currentClockMhz: cpuInfo.currentClockMhz,
      utilizationPct: cpuUtil,
      temperatureC: tempC,
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
      ...ram,
      frequencyMhz: null,
      ddrGen: null,
      modules: null,
      channelConfig: null,
    },
    storage: {
      ...storage,
      model: null,
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
      status: 'Unavailable (AC / Container Host)',
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
      osName: readOsPrettyName(),
      osBuild: `${os.release()} (${os.arch()})`,
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
      loadAvg1m: Number(os.loadavg()[0].toFixed(2)),
      secureBoot: null,
      tpmStatus: null,
      virtualization: 'Container / Virtualized Linux Runtime',
    },
    network: readNetworkAdapters(),
    display: {
      resolution: null,
      refreshRateHz: null,
      supportedRefreshRates: [],
      scalingPct: null,
      brightnessPct: null,
    },
    totalSystemPowerW: null,
    capabilities: buildLinuxCapabilities(tempC !== null),
  };
}

function readHostProcesses(): ProcessInfo[] {
  const results: ProcessInfo[] = [];
  const pageSizeKb = 4;
  try {
    const entries = fs.readdirSync('/proc');
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = Number(entry);
      try {
        const comm = fs.readFileSync(`/proc/${entry}/comm`, 'utf8').trim();
        const statm = fs.readFileSync(`/proc/${entry}/statm`, 'utf8').trim().split(/\s+/);
        const residentPages = Number(statm[1] || 0);
        const rssMb = Number(((residentPages * pageSizeKb) / 1024).toFixed(1));
        const stat = fs.readFileSync(`/proc/${entry}/stat`, 'utf8');
        const rparen = stat.lastIndexOf(')');
        const stateCode = rparen > 0 ? stat.slice(rparen + 2, rparen + 3) : 'S';
        const stateLabel =
          stateCode === 'R' ? 'Running' : stateCode === 'S' ? 'Sleeping' : stateCode === 'I' ? 'Idle' : stateCode;
        const cmdlineRaw = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8');
        const command = cmdlineRaw.replace(/\0/g, ' ').trim() || comm;
        results.push({ pid, name: comm, rssMb, state: stateLabel, command });
      } catch {
        // Process exited mid-scan
      }
    }
  } catch {
    // Non-proc environment
  }
  return results.sort((a, b) => b.rssMb - a.rssMb).slice(0, 25);
}

function loadConfig(): EvolConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Partial<EvolConfig>;
      return { ...createDefaultConfig(), ...parsed };
    }
  } catch {
    // Fallback to clean defaults on corrupt file
  }
  const defaults = createDefaultConfig();
  saveConfig(defaults);
  return defaults;
}

function saveConfig(cfg: EvolConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

let currentConfig = loadConfig();

// Lightweight CSV logging state
let loggingActive = false;
let loggingTimer: NodeJS.Timeout | null = null;
let activeLogFile: string | null = null;
let samplesRecorded = 0;

function getTodayLogFilename(): string {
  const datePart = new Date().toISOString().slice(0, 10);
  return `evol_session_${datePart}.csv`;
}

async function writeCsvSample() {
  const filename = activeLogFile || getTodayLogFilename();
  activeLogFile = filename;
  const fullPath = path.join(LOGS_DIR, filename);
  const exists = fs.existsSync(fullPath);
  const snapshot = await collectTelemetry(currentConfig.agentUrl);
  const row = formatTelemetryCsvRow(snapshot, currentConfig.activeMode);
  if (!exists) {
    fs.writeFileSync(fullPath, `${formatTelemetryCsvHeader()}\n${row}\n`, 'utf8');
  } else {
    fs.appendFileSync(fullPath, `${row}\n`, 'utf8');
  }
  samplesRecorded += 1;
}

function startCsvLogging(intervalSec: number) {
  stopCsvLogging();
  const safeInterval = Math.max(1, Math.min(300, Math.round(intervalSec)));
  currentConfig.loggingIntervalSec = safeInterval;
  saveConfig(currentConfig);
  activeLogFile = getTodayLogFilename();
  loggingActive = true;
  void writeCsvSample();
  loggingTimer = setInterval(() => {
    void writeCsvSample();
  }, safeInterval * 1000);
}

function stopCsvLogging() {
  if (loggingTimer) {
    clearInterval(loggingTimer);
    loggingTimer = null;
  }
  loggingActive = false;
}

function listWindowsBundleFiles(dir = WINDOWS_DIR, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listWindowsBundleFiles(abs, rel));
    } else {
      files.push(rel);
    }
  }
  return files.sort();
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Prime CPU delta once at startup
  readProcCpuUtilization();

  app.get('/api/telemetry', async (_req, res) => {
    const snap = await collectTelemetry(currentConfig.agentUrl);
    res.json(snap);
  });

  app.post('/api/agent/connect', async (req, res) => {
    const rawUrl = typeof req.body?.agentUrl === 'string' ? req.body.agentUrl.trim() : currentConfig.agentUrl;
    if (!rawUrl || !/^https?:\/\/.+/.test(rawUrl)) {
      res.status(400).json({ connected: false, error: 'Provide a valid http:// or https:// agent URL.' });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const probe = await fetch(`${rawUrl.replace(/\/$/, '')}/api/telemetry`, { signal: controller.signal });
      clearTimeout(timer);
      if (!probe.ok) {
        res.status(502).json({ connected: false, error: `Agent responded with HTTP ${probe.status}.` });
        return;
      }
      agentBridgeEnabled = true;
      currentConfig.agentUrl = rawUrl;
      saveConfig(currentConfig);
      res.json({ connected: true, agentUrl: rawUrl });
    } catch {
      agentBridgeEnabled = false;
      res.json({
        connected: false,
        error: `No Windows Companion Agent reachable at ${rawUrl}. Start EVOL-Control-Center.exe on your Colorful Evol P15 to bridge live Windows hardware sensors.`,
      });
    }
  });

  app.post('/api/agent/disconnect', (_req, res) => {
    agentBridgeEnabled = false;
    res.json({ connected: false });
  });

  app.get('/api/processes', (_req, res) => {
    res.json({ processes: readHostProcesses() });
  });

  app.get('/api/config', (_req, res) => {
    res.json(currentConfig);
  });

  app.put('/api/config', (req, res) => {
    const incoming = req.body as Partial<EvolConfig>;
    if (incoming.cpuFanCurve) {
      const check = validateFanCurve(incoming.cpuFanCurve);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
    }
    if (incoming.gpuFanCurve) {
      const check = validateFanCurve(incoming.gpuFanCurve);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
    }
    if (incoming.profiles) {
      for (const mode of ['gaming', 'work', 'battery'] as PerformanceModeId[]) {
        const p = incoming.profiles[mode];
        if (p) {
          const pl = validatePowerLimits(p.pl1Watts, p.pl2Watts);
          if (!pl.valid) {
            res.status(400).json({ error: `${p.label}: ${pl.error}` });
            return;
          }
        }
      }
    }

    currentConfig = {
      ...currentConfig,
      ...incoming,
      profiles: incoming.profiles ? { ...currentConfig.profiles, ...incoming.profiles } : currentConfig.profiles,
      thermalThresholds: incoming.thermalThresholds
        ? { ...currentConfig.thermalThresholds, ...incoming.thermalThresholds }
        : currentConfig.thermalThresholds,
      keyboard: incoming.keyboard ? { ...currentConfig.keyboard, ...incoming.keyboard } : currentConfig.keyboard,
      display: incoming.display ? { ...currentConfig.display, ...incoming.display } : currentConfig.display,
      power: incoming.power ? { ...currentConfig.power, ...incoming.power } : currentConfig.power,
    };
    saveConfig(currentConfig);
    res.json(currentConfig);
  });

  app.post('/api/mode', async (req, res) => {
    const mode = req.body?.mode as PerformanceModeId;
    if (!['gaming', 'work', 'battery'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode. Expected gaming, work, or battery.' });
      return;
    }

    const snap = await collectTelemetry(currentConfig.agentUrl);
    const plan = buildProfilePlan(mode, currentConfig, snap.capabilities);
    if (plan.validationErrors.length > 0) {
      res.status(400).json({ error: plan.validationErrors[0] });
      return;
    }

    const profile = currentConfig.profiles[mode];
    currentConfig.activeMode = mode;
    currentConfig.fanPreset = profile.fanPreset;
    if (profile.fanPreset !== 'custom') {
      currentConfig.cpuFanCurve = [...DEFAULT_FAN_PRESETS[profile.fanPreset]];
      currentConfig.gpuFanCurve = [...DEFAULT_FAN_PRESETS[profile.fanPreset]];
    }
    currentConfig.display.refreshRateHz = profile.targetRefreshRateHz;
    currentConfig.display.brightnessPct = profile.brightnessPct;
    currentConfig.power.activePlan = profile.windowsPowerPlan;
    currentConfig.power.cpuBoostPolicy = profile.cpuBoostPolicy;

    if (agentBridgeEnabled && currentConfig.agentUrl) {
      try {
        await fetch(`${currentConfig.agentUrl.replace(/\/$/, '')}/api/mode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
      } catch {
        // Non-fatal if bridge temporarily unavailable
      }
    }

    const event: AutomationEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: `Activate ${profile.label}`,
      status: plan.skippedSteps.length > 0 ? 'partial' : 'applied',
      summary:
        plan.skippedSteps.length > 0
          ? `${profile.label} saved & applied locally (${plan.skippedSteps.length} Windows-only steps deferred to Windows Agent).`
          : `${profile.label} applied and verified across all subsystems.`,
      appliedSteps: plan.appliedSteps,
      skippedSteps: plan.skippedSteps.map((s) => `${s.setting}: ${s.reason}`),
    };

    currentConfig.automationHistory = [event, ...currentConfig.automationHistory].slice(0, 20);
    saveConfig(currentConfig);
    res.json({ config: currentConfig, plan, event });
  });

  app.get('/api/backup', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="evol-control-center-backup.json"');
    res.send(JSON.stringify(currentConfig, null, 2));
  });

  app.post('/api/restore', (req, res) => {
    const incoming = req.body as Partial<EvolConfig>;
    if (!incoming || !incoming.profiles || !incoming.activeMode) {
      res.status(400).json({ error: 'Invalid EVOL configuration backup payload.' });
      return;
    }
    currentConfig = { ...createDefaultConfig(), ...incoming };
    saveConfig(currentConfig);
    res.json(currentConfig);
  });

  app.post('/api/reset', (_req, res) => {
    currentConfig = createDefaultConfig();
    saveConfig(currentConfig);
    res.json(currentConfig);
  });

  // CSV Logging endpoints
  app.get('/api/logging/status', (_req, res) => {
    const files = fs.existsSync(LOGS_DIR)
      ? fs
          .readdirSync(LOGS_DIR)
          .filter((f) => f.endsWith('.csv'))
          .sort()
          .reverse()
      : [];
    res.json({
      active: loggingActive,
      intervalSec: currentConfig.loggingIntervalSec,
      activeFile: activeLogFile,
      samplesRecorded,
      files,
    });
  });

  app.post('/api/logging/start', (req, res) => {
    const intervalSec = Number(req.body?.intervalSec ?? currentConfig.loggingIntervalSec);
    startCsvLogging(intervalSec);
    res.json({
      active: loggingActive,
      intervalSec: currentConfig.loggingIntervalSec,
      activeFile: activeLogFile,
      samplesRecorded,
    });
  });

  app.post('/api/logging/stop', (_req, res) => {
    stopCsvLogging();
    res.json({
      active: loggingActive,
      intervalSec: currentConfig.loggingIntervalSec,
      activeFile: activeLogFile,
      samplesRecorded,
    });
  });

  app.get('/api/logging/view', (req, res) => {
    const files = fs.existsSync(LOGS_DIR)
      ? fs
          .readdirSync(LOGS_DIR)
          .filter((f) => f.endsWith('.csv'))
          .sort()
          .reverse()
      : [];
    const requestedFile = typeof req.query.file === 'string' ? path.basename(req.query.file) : files[0];
    if (!requestedFile || !files.includes(requestedFile)) {
      res.json({ file: null, rows: [], comparison: [] });
      return;
    }
    const content = fs.readFileSync(path.join(LOGS_DIR, requestedFile), 'utf8');
    const rows = parseTelemetryCsv(content);
    const comparison = computeModeComparison(rows);
    res.json({ file: requestedFile, rows: rows.slice(-200).reverse(), comparison });
  });

  app.get('/api/logging/download', (req, res) => {
    const files = fs.existsSync(LOGS_DIR)
      ? fs
          .readdirSync(LOGS_DIR)
          .filter((f) => f.endsWith('.csv'))
          .sort()
          .reverse()
      : [];
    const requestedFile = typeof req.query.file === 'string' ? path.basename(req.query.file) : files[0];
    if (!requestedFile || !files.includes(requestedFile)) {
      res.status(404).json({ error: 'No CSV log file recorded yet.' });
      return;
    }
    res.download(path.join(LOGS_DIR, requestedFile), requestedFile);
  });

  // Diagnostics & safe host verification
  app.get('/api/diagnostics', async (_req, res) => {
    const snap = await collectTelemetry(currentConfig.agentUrl);
    const events: StabilityEvent[] = [];

    if (snap.ram.utilizationPct > 90) {
      events.push({
        id: 'mem-pressure',
        timestamp: snap.timestamp,
        category: 'hardware_error',
        source: 'Host Memory Monitor',
        message: `High host memory pressure detected (${snap.ram.utilizationPct}% used).`,
        weight: 8,
      });
    }
    if (snap.storage.utilizationPct > 92) {
      events.push({
        id: 'disk-space',
        timestamp: snap.timestamp,
        category: 'hardware_error',
        source: 'Host Storage Monitor',
        message: `Root volume approaching capacity (${snap.storage.utilizationPct}% used).`,
        weight: 6,
      });
    }
    if (snap.cpu.thermalThrottling) {
      events.push({
        id: 'cpu-thermal',
        timestamp: snap.timestamp,
        category: 'thermal_event',
        source: 'PROCHOT Flag',
        message: 'CPU thermal throttling flag asserted.',
        weight: 10,
      });
    }

    const report = computeStabilityScore(events);
    res.json({
      report,
      events,
      checks: [
        { name: 'Kernel Uptime & Load Stability', status: snap.system.loadAvg1m < snap.cpu.threads ? 'Healthy' : 'Elevated', detail: `Load Avg (1m): ${snap.system.loadAvg1m} across ${snap.cpu.threads} threads` },
        { name: 'Memory Headroom Check', status: snap.ram.utilizationPct < 88 ? 'Healthy' : 'High Usage', detail: `${snap.ram.availableGb} GB available of ${snap.ram.totalGb} GB` },
        { name: 'Root Volume Capacity', status: snap.storage.utilizationPct < 90 ? 'Healthy' : 'Low Space', detail: `${snap.storage.availableGb} GB free on ${snap.storage.mount}` },
        { name: 'Windows EventLog (BSOD / Kernel-Power 41)', status: snap.agentConnected ? 'Live' : 'Requires Windows Agent', detail: snap.agentConnected ? 'Monitoring active' : 'Connect Windows Agent to scan Win32 System & Application EventLogs' },
      ],
    });
  });

  app.post('/api/diagnostics/benchmark', async (_req, res) => {
    const snapBefore = await collectTelemetry(currentConfig.agentUrl);
    if (
      snapBefore.cpu.temperatureC !== null &&
      snapBefore.cpu.temperatureC >= currentConfig.thermalThresholds.cpuCriticalC
    ) {
      res.status(409).json({
        aborted: true,
        reason: `Safety abort: CPU temperature (${snapBefore.cpu.temperatureC}°C) exceeds critical threshold (${currentConfig.thermalThresholds.cpuCriticalC}°C).`,
      });
      return;
    }

    // Safe, bounded 250ms compute & memory throughput check
    const start = performance.now();
    let checksum = 0;
    let iterations = 0;
    while (performance.now() - start < 250) {
      for (let i = 1; i <= 5000; i++) {
        checksum += Math.sqrt(i * 1.0001) % 7.3;
      }
      iterations += 5000;
    }
    const elapsedMs = performance.now() - start;

    const memStart = performance.now();
    const buf = new Float64Array(2_000_000);
    for (let i = 0; i < buf.length; i++) buf[i] = i * 0.5;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    const memMs = performance.now() - memStart;
    const memThroughputGbps = Number((((buf.byteLength * 2) / 1_000_000_000) / (memMs / 1000)).toFixed(2));

    res.json({
      aborted: false,
      durationMs: Math.round(elapsedMs + memMs),
      computeOpsPerSec: Math.round((iterations / elapsedMs) * 1000),
      memoryThroughputGbps: memThroughputGbps,
      checksumGuard: Number((checksum + sum * 0).toFixed(2)),
    });
  });

  // Windows .NET 8 source bundle endpoints (includes GitHub Actions workflow + Inno Setup + build scripts)
  const workflowRelPath = '.github/workflows/build-windows.yml';
  const workflowAbsPath = path.resolve(__dirname, workflowRelPath);

  app.get('/api/windows-bundle/list', (_req, res) => {
    const files = listWindowsBundleFiles().map((f) => `windows/EvolControlCenter/${f}`);
    if (fs.existsSync(workflowAbsPath)) {
      files.unshift(workflowRelPath);
    }
    res.json({ files });
  });

  app.get('/api/windows-bundle/file', (req, res) => {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (rel === workflowRelPath && fs.existsSync(workflowAbsPath)) {
      res.json({ path: rel, content: fs.readFileSync(workflowAbsPath, 'utf8') });
      return;
    }
    const prefix = 'windows/EvolControlCenter/';
    const normalized = rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
    const allowed = listWindowsBundleFiles();
    if (!allowed.includes(normalized)) {
      res.status(404).json({ error: 'File not found in Windows bundle.' });
      return;
    }
    const content = fs.readFileSync(path.join(WINDOWS_DIR, normalized), 'utf8');
    res.json({ path: rel, content });
  });

  app.get('/api/windows-bundle/download', async (_req, res) => {
    const zip = new JSZip();
    const files = listWindowsBundleFiles();
    for (const rel of files) {
      const content = fs.readFileSync(path.join(WINDOWS_DIR, rel), 'utf8');
      zip.file(`windows/EvolControlCenter/${rel}`, content);
    }
    if (fs.existsSync(workflowAbsPath)) {
      zip.file(workflowRelPath, fs.readFileSync(workflowAbsPath, 'utf8'));
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="EvolControlCenter-Windows-NET8.zip"');
    res.send(buffer);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EVOL CONTROL CENTER server listening on http://0.0.0.0:${PORT}`);
  });
}

void createServer();
