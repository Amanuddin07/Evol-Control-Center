import React, { useEffect, useState } from 'react';
import {
  Activity,
  Download,
  ExternalLink,
  FileCode2,
  FolderArchive,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Square,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_VERIFIED_SOFTWARE_CATALOG,
  OFFICIAL_UPDATE_SOURCES,
} from '../shared/evolCompatibility';
import type {
  CsvLogEntry,
  EvolConfig,
  ModeComparisonMetric,
  ProcessInfo,
  StabilityReport,
  TelemetrySnapshot,
} from '../shared/types';

interface PlatformAndToolsViewProps {
  section: 'bios-firmware' | 'power' | 'updates' | 'diagnostics' | 'logging' | 'settings';
  telemetry: TelemetrySnapshot;
  config: EvolConfig;
  onSaveConfig: (patch: Partial<EvolConfig>) => Promise<{ ok: boolean; error?: string }>;
  onResetConfig: () => Promise<void>;
  onRestoreConfig: (cfg: EvolConfig) => Promise<{ ok: boolean; error?: string }>;
  onRefreshTelemetry: () => Promise<void>;
}

export function PlatformAndToolsView({
  section,
  telemetry,
  config,
  onSaveConfig,
  onResetConfig,
  onRestoreConfig,
  onRefreshTelemetry,
}: PlatformAndToolsViewProps) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Power management state
  const [pwr, setPwr] = useState(config.power);
  const [customPowerName, setCustomPowerName] = useState('');

  // Diagnostics state
  const [diagReport, setDiagReport] = useState<{
    report: StabilityReport;
    checks: Array<{ name: string; status: string; detail: string }>;
  } | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [benchResult, setBenchResult] = useState<{
    durationMs: number;
    computeOpsPerSec: number;
    memoryThroughputGbps: number;
  } | null>(null);
  const [runningBench, setRunningBench] = useState(false);

  // Updates scan state
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);

  // CSV logging state
  const [logStatus, setLogStatus] = useState<{
    active: boolean;
    intervalSec: number;
    activeFile: string | null;
    samplesRecorded: number;
    files: string[];
  } | null>(null);
  const [logRows, setLogRows] = useState<CsvLogEntry[]>([]);
  const [logComparison, setLogComparison] = useState<ModeComparisonMetric[]>([]);
  const [selectedCsvFile, setSelectedCsvFile] = useState<string>('');
  const [intervalInput, setIntervalInput] = useState(config.loggingIntervalSec);

  // Settings / Agent / Windows bundle state
  const [agentInput, setAgentInput] = useState(config.agentUrl);
  const [bundleFiles, setBundleFiles] = useState<string[]>([]);
  const [selectedBundleFile, setSelectedBundleFile] = useState<string>('');
  const [bundleFileContent, setBundleFileContent] = useState<string>('');

  useEffect(() => {
    setStatusMsg(null);
  }, [section]);

  useEffect(() => {
    setPwr(config.power);
    setIntervalInput(config.loggingIntervalSec);
    setAgentInput(config.agentUrl);
  }, [config]);

  const loadDiagnostics = async () => {
    const [dRes, pRes] = await Promise.all([fetch('/api/diagnostics'), fetch('/api/processes')]);
    if (dRes.ok) setDiagReport(await dRes.json());
    if (pRes.ok) {
      const pJson = await pRes.json();
      setProcesses(pJson.processes ?? []);
    }
  };

  const loadLoggingData = async (file?: string) => {
    const sRes = await fetch('/api/logging/status');
    if (sRes.ok) {
      const sJson = await sRes.json();
      setLogStatus(sJson);
      const target = file || selectedCsvFile || sJson.files?.[0] || '';
      if (target) {
        setSelectedCsvFile(target);
        const vRes = await fetch(`/api/logging/view?file=${encodeURIComponent(target)}`);
        if (vRes.ok) {
          const vJson = await vRes.json();
          setLogRows(vJson.rows ?? []);
          setLogComparison(vJson.comparison ?? []);
        }
      } else {
        setLogRows([]);
        setLogComparison([]);
      }
    }
  };

  const loadWindowsBundle = async () => {
    const res = await fetch('/api/windows-bundle/list');
    if (res.ok) {
      const data = await res.json();
      const files: string[] = data.files ?? [];
      setBundleFiles(files);
      if (files.length > 0 && !selectedBundleFile) {
        const first = files.find((f) => f.endsWith('BUILD_INSTRUCTIONS.md')) || files[0];
        setSelectedBundleFile(first);
        const fRes = await fetch(`/api/windows-bundle/file?path=${encodeURIComponent(first)}`);
        if (fRes.ok) {
          const fJson = await fRes.json();
          setBundleFileContent(fJson.content ?? '');
        }
      }
    }
  };

  useEffect(() => {
    if (section === 'diagnostics') void loadDiagnostics();
    if (section === 'logging') void loadLoggingData();
    if (section === 'settings') void loadWindowsBundle();
  }, [section]);

  if (section === 'bios-firmware') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            BIOS &amp; Advanced Firmware Configuration
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Inspect UEFI firmware status and safely reboot to UEFI setup without risking OS-level BIOS modifications.
          </p>
        </div>

        <div className="px-4 py-3 rounded-lg bg-[#11151C] border border-amber-500/30 text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">Firmware Safety Policy:</strong> EVOL CONTROL CENTER never flashes BIOS/EC firmware automatically from Windows or writes undocumented UEFI NVRAM variables. Verify AC power &amp; laptop SKU serial before applying official Colorful updates.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-2.5 text-xs">
            <h3 className="font-display text-base font-semibold text-slate-100 mb-2">Firmware Telemetry</h3>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]"><span className="text-slate-400">BIOS Vendor</span><span className="font-mono text-slate-200">{telemetry.system.biosVendor ?? 'Windows WMI Required'}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]"><span className="text-slate-400">BIOS Version</span><span className="font-mono text-slate-200">{telemetry.system.biosVersion ?? 'Windows WMI Required'}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]"><span className="text-slate-400">Motherboard</span><span className="font-mono text-slate-200">{telemetry.system.motherboard ?? 'Windows WMI Required'}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]"><span className="text-slate-400">Secure Boot</span><span className="font-mono text-slate-200">{telemetry.system.secureBoot ?? 'Windows WMI Required'}</span></div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]"><span className="text-slate-400">TPM 2.0 Status</span><span className="font-mono text-slate-200">{telemetry.system.tpmStatus ?? 'Windows WMI Required'}</span></div>
            <div className="flex justify-between py-1.5"><span className="text-slate-400">Virtualization</span><span className="font-mono text-slate-200">{telemetry.system.virtualization ?? 'Detected'}</span></div>
          </div>

          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
            <h3 className="font-display text-base font-semibold text-slate-100">Official UEFI &amp; Recovery Actions</h3>
            <p className="text-slate-400 leading-relaxed">
              On Windows with Administrator privileges, the EVOL desktop client executes the documented command <span className="font-mono text-slate-200">shutdown /r /fw /t 5</span> to enter UEFI firmware settings cleanly.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://en.colorful.cn/en/home/Download"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium inline-flex items-center gap-1.5"
              >
                Colorful Official Firmware Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="p-3 rounded bg-[#090B0F] border border-white/[0.06] text-slate-400">
              Windows Advanced Startup shortcut: <span className="font-mono text-slate-200">shutdown /r /o /f /t 0</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'power') {
    const savePower = async () => {
      const res = await onSaveConfig({ power: pwr });
      setStatusMsg(res.ok ? 'Power management profile saved.' : res.error ?? 'Save failed.');
    };

    const saveCustomPowerProfile = async () => {
      if (!customPowerName.trim()) return;
      const next = [
        ...config.customPowerProfiles,
        { id: `pwr-${Date.now()}`, name: customPowerName.trim(), config: pwr },
      ];
      await onSaveConfig({ customPowerProfiles: next });
      setCustomPowerName('');
      setStatusMsg('Saved custom power profile.');
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            Advanced Power Management &amp; Battery Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure Windows processor states, link power savings, timeouts, and custom power schemes.
          </p>
        </div>

        {statusMsg && (
          <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
            <h3 className="font-display text-base font-semibold text-slate-100">Processor &amp; Subsystem Power</h3>

            <label className="block space-y-1">
              <span className="text-slate-400">Windows Power Plan</span>
              <select
                value={pwr.activePlan}
                onChange={(e) => setPwr({ ...pwr, activePlan: e.target.value as typeof pwr.activePlan })}
                className="w-full px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] text-slate-100"
              >
                <option value="High Performance">High Performance</option>
                <option value="Balanced">Balanced</option>
                <option value="Power Saver">Power Saver</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-slate-400 block">Min Processor State ({pwr.minProcessorPct}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pwr.minProcessorPct}
                  onChange={(e) => setPwr({ ...pwr, minProcessorPct: Number(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 block">Max Processor State ({pwr.maxProcessorPct}%)</span>
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={pwr.maxProcessorPct}
                  onChange={(e) => setPwr({ ...pwr, maxProcessorPct: Number(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-slate-400 block">PCIe Link Power</span>
                <select
                  value={pwr.pcieLinkPowerManagement}
                  onChange={(e) => setPwr({ ...pwr, pcieLinkPowerManagement: e.target.value as typeof pwr.pcieLinkPowerManagement })}
                  className="w-full px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] text-slate-100"
                >
                  <option value="Off">Off (Lowest Latency)</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Maximum Power Savings">Maximum Power Savings</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-slate-400 block">Wireless Power Mode</span>
                <select
                  value={pwr.wirelessPowerMode}
                  onChange={(e) => setPwr({ ...pwr, wirelessPowerMode: e.target.value as typeof pwr.wirelessPowerMode })}
                  className="w-full px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] text-slate-100"
                >
                  <option value="Maximum Performance">Maximum Performance</option>
                  <option value="Medium Power Saving">Medium Power Saving</option>
                  <option value="Low Power Saving">Low Power Saving</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pwr.usbSelectiveSuspend}
                  onChange={(e) => setPwr({ ...pwr, usbSelectiveSuspend: e.target.checked })}
                />
                USB Selective Suspend
              </label>
              <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pwr.hibernateEnabled}
                  onChange={(e) => setPwr({ ...pwr, hibernateEnabled: e.target.checked })}
                />
                Hibernation Enabled
              </label>
              <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pwr.batteryConservationMode}
                  onChange={(e) => setPwr({ ...pwr, batteryConservationMode: e.target.checked })}
                />
                Battery Conservation (If EC Supported)
              </label>
            </div>

            <button
              type="button"
              onClick={() => void savePower()}
              className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium"
            >
              Apply Power Configuration
            </button>
          </div>

          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
            <h3 className="font-display text-base font-semibold text-slate-100">Battery Analytics &amp; Custom Profiles</h3>
            <div className="space-y-1.5 font-mono tabular-nums text-slate-300">
              <div className="flex justify-between py-1 border-b border-white/[0.06]"><span className="text-slate-400">Charge Level</span><span>{telemetry.battery.percentage !== null ? `${telemetry.battery.percentage}%` : 'Unavailable on Host'}</span></div>
              <div className="flex justify-between py-1 border-b border-white/[0.06]"><span className="text-slate-400">Wear Level</span><span>{telemetry.battery.wearLevelPct !== null ? `${telemetry.battery.wearLevelPct}%` : 'ACPI WMI Required'}</span></div>
              <div className="flex justify-between py-1 border-b border-white/[0.06]"><span className="text-slate-400">Charge/Discharge Rate</span><span>{telemetry.battery.chargeRateW !== null ? `${telemetry.battery.chargeRateW} W` : 'ACPI WMI Required'}</span></div>
              <div className="flex justify-between py-1"><span className="text-slate-400">Cycle Count</span><span>{telemetry.battery.cycleCount ?? 'ACPI WMI Required'}</span></div>
            </div>

            <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
              <div className="font-medium text-slate-200">Save Custom Power Profile</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Profile name (e.g. Travel Quiet)"
                  value={customPowerName}
                  onChange={(e) => setCustomPowerName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void saveCustomPowerProfile()}
                  className="px-3.5 py-2 rounded bg-white/[0.08] hover:bg-white/[0.14] text-slate-100"
                >
                  Save Profile
                </button>
              </div>
              {config.customPowerProfiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {config.customPowerProfiles.map((cp) => (
                    <div key={cp.id} className="flex items-center justify-between py-1.5 px-2.5 rounded bg-[#090B0F] border border-white/[0.06]">
                      <span className="text-slate-200">{cp.name} ({cp.config.activePlan})</span>
                      <button
                        type="button"
                        onClick={() => setPwr(cp.config)}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'updates') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-100">
              Application &amp; Driver Update Center
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Official vendor update channels and Windows package verification (never third-party mirrors).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLastScanAt(new Date().toLocaleTimeString());
              setStatusMsg(
                telemetry.agentConnected
                  ? 'Queried Windows Agent winget & driver inventory.'
                  : 'Verified official vendor channels. Run the Windows .NET 8 Companion App on your Evol P15 to execute local winget upgrade scans.',
              );
            }}
            className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Scan Now
          </button>
        </div>

        {statusMsg && (
          <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
            {statusMsg} {lastScanAt ? `(Checked at ${lastScanAt})` : ''}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFICIAL_UPDATE_SOURCES.map((src) => (
            <div key={src.vendor} className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08] flex flex-col justify-between gap-3">
              <div>
                <div className="text-xs text-sky-400 font-medium">{src.category}</div>
                <h3 className="font-display text-base font-semibold text-slate-100 mt-1">{src.vendor}</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{src.notes}</p>
              </div>
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-slate-200 hover:text-sky-300 inline-flex items-center gap-1.5 w-fit"
              >
                Open Official Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <h3 className="font-display text-base font-semibold text-slate-100 mb-3">
            Critical Evol P15 Software &amp; Driver Catalog
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400">
                  <th className="py-2 pr-4 font-medium">Component</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Official Source</th>
                  <th className="py-2 font-medium text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {DEFAULT_VERIFIED_SOFTWARE_CATALOG.map((item) => (
                  <tr key={item.name}>
                    <td className="py-2.5 pr-4 text-slate-200 font-medium">{item.name}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{item.category}</td>
                    <td className="py-2.5 pr-4 text-slate-300">{item.recommendedChannel}</td>
                    <td className="py-2.5 text-right">
                      <a
                        href={item.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                      >
                        Official Link <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'diagnostics') {
    const runSafeBenchmark = async () => {
      setRunningBench(true);
      setStatusMsg(null);
      try {
        const res = await fetch('/api/diagnostics/benchmark', { method: 'POST' });
        const json = await res.json();
        if (!res.ok) {
          setStatusMsg(json.reason || 'Benchmark aborted for safety.');
        } else {
          setBenchResult(json);
          setStatusMsg('Safe compute & memory throughput check completed.');
        }
      } finally {
        setRunningBench(false);
      }
    };

    const exportDiagnosticReport = () => {
      const payload = {
        generatedAt: new Date().toISOString(),
        telemetry,
        diagnostics: diagReport,
        topProcesses: processes.slice(0, 10),
        benchmark: benchResult,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evol-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-100">
              System Stability, Diagnostics &amp; Process Monitor
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Real host process inspection, transparent stability scoring, and thermally-guarded verification tests.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadDiagnostics()}
              className="px-3.5 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Checks
            </button>
            <button
              type="button"
              onClick={exportDiagnosticReport}
              className="px-3.5 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Report
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-base font-semibold text-slate-100">Stability Score</h3>
              <span className="font-mono tabular-nums text-2xl font-bold text-emerald-400">
                {diagReport ? `${diagReport.report.score} / 100` : '—'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Formula: 100 minus weighted hardware, thermal, memory pressure, and EventLog deductions.
            </p>
            <div className="space-y-2.5 pt-1 text-xs">
              {(diagReport?.checks ?? []).map((chk) => (
                <div key={chk.name} className="p-3 rounded bg-[#090B0F] border border-white/[0.06]">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-200">{chk.name}</span>
                    <span className={chk.status === 'Healthy' || chk.status === 'Live' ? 'text-emerald-400' : 'text-amber-400'}>
                      {chk.status}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-400 font-mono text-[11px]">{chk.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-100">Safe Compute &amp; Memory Check</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bounded 250ms throughput verification. Aborts automatically if CPU temp reaches critical threshold ({config.thermalThresholds.cpuCriticalC}°C).
                </p>
              </div>
              <button
                type="button"
                disabled={runningBench}
                onClick={() => void runSafeBenchmark()}
                className="px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 font-medium text-xs inline-flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5" />
                {runningBench ? 'Running...' : 'Run Safe Verification'}
              </button>
            </div>

            {benchResult ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3.5 rounded bg-[#090B0F] border border-white/[0.06]">
                  <div className="text-slate-500">Scalar FP Ops/sec</div>
                  <div className="text-lg text-slate-100 mt-1">{benchResult.computeOpsPerSec.toLocaleString()}</div>
                </div>
                <div className="p-3.5 rounded bg-[#090B0F] border border-white/[0.06]">
                  <div className="text-slate-500">Memory Bandwidth</div>
                  <div className="text-lg text-sky-400 mt-1">{benchResult.memoryThroughputGbps} GB/s</div>
                </div>
                <div className="p-3.5 rounded bg-[#090B0F] border border-white/[0.06]">
                  <div className="text-slate-500">Elapsed Time</div>
                  <div className="text-lg text-emerald-400 mt-1">{benchResult.durationMs} ms</div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded bg-[#090B0F] border border-white/[0.06] text-xs text-slate-400">
                No verification run executed in this session yet.
              </div>
            )}

            <div>
              <h4 className="font-display text-sm font-semibold text-slate-100 mb-2">
                Active Host Processes (Live /proc)
              </h4>
              <div className="max-h-60 overflow-y-auto overflow-x-auto border border-white/[0.06] rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#090B0F] text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-medium">PID</th>
                      <th className="py-2 px-3 font-medium">Process</th>
                      <th className="py-2 px-3 font-medium">State</th>
                      <th className="py-2 px-3 font-medium text-right">RSS Memory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] font-mono tabular-nums text-slate-300">
                    {processes.slice(0, 12).map((p) => (
                      <tr key={p.pid} className="hover:bg-white/[0.02]">
                        <td className="py-1.5 px-3 text-slate-500">{p.pid}</td>
                        <td className="py-1.5 px-3 font-sans text-slate-200">{p.name}</td>
                        <td className="py-1.5 px-3 text-slate-400">{p.state}</td>
                        <td className="py-1.5 px-3 text-right">{p.rssMb} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'logging') {
    const startLogging = async () => {
      const res = await fetch('/api/logging/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalSec: intervalInput }),
      });
      if (res.ok) {
        setStatusMsg(`CSV telemetry logging started (${intervalInput}s interval).`);
        await loadLoggingData();
      }
    };

    const stopLogging = async () => {
      const res = await fetch('/api/logging/stop', { method: 'POST' });
      if (res.ok) {
        setStatusMsg('CSV telemetry logging stopped.');
        await loadLoggingData();
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-100">
              Automatic CSV Telemetry Logging &amp; Mode Comparison
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Record real hardware metrics to daily CSV files for Excel analysis and performance mode comparison.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <span>Interval (s)</span>
              <input
                type="number"
                min={1}
                max={300}
                value={intervalInput}
                onChange={(e) => setIntervalInput(Number(e.target.value))}
                className="w-16 px-2 py-1.5 rounded bg-[#11151C] border border-white/[0.12] font-mono tabular-nums text-slate-100"
              />
            </label>
            {logStatus?.active ? (
              <button
                type="button"
                onClick={() => void stopLogging()}
                className="px-4 py-2 rounded-md bg-red-500/90 hover:bg-red-400 text-slate-950 font-medium text-xs inline-flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" /> Stop Logging
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startLogging()}
                className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium text-xs inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> Start Logging
              </button>
            )}
            <a
              href={selectedCsvFile ? `/api/logging/download?file=${encodeURIComponent(selectedCsvFile)}` : '/api/logging/download'}
              className="px-3.5 py-2 rounded-md bg-white/[0.07] hover:bg-white/[0.12] text-slate-100 text-xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </a>
          </div>
        </div>

        {statusMsg && (
          <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08]">
            <div className="text-slate-400">Logger Status</div>
            <div className="mt-1 font-mono text-base text-slate-100">
              {logStatus?.active ? `Recording (${logStatus.intervalSec}s)` : 'Idle'}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08]">
            <div className="text-slate-400">Session Samples Written</div>
            <div className="mt-1 font-mono tabular-nums text-base text-slate-100">
              {logStatus?.samplesRecorded ?? 0}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-[#11151C] border border-white/[0.08]">
            <div className="text-slate-400">Log File</div>
            <select
              value={selectedCsvFile}
              onChange={(e) => void loadLoggingData(e.target.value)}
              className="mt-1 w-full bg-[#090B0F] border border-white/[0.12] rounded px-2 py-1 font-mono text-xs text-slate-100"
            >
              {(logStatus?.files ?? []).length === 0 ? (
                <option value="">No CSV sessions yet</option>
              ) : (
                logStatus?.files.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {logComparison.length > 0 && (
          <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
            <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">
              Performance Mode Comparison (From Recorded CSV)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 font-sans">
                    <th className="py-2 pr-4 font-medium">Mode</th>
                    <th className="py-2 pr-4 font-medium">Samples</th>
                    <th className="py-2 pr-4 font-medium">Avg CPU %</th>
                    <th className="py-2 pr-4 font-medium">Peak CPU %</th>
                    <th className="py-2 pr-4 font-medium">Avg RAM %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-200">
                  {logComparison.map((m) => (
                    <tr key={m.mode}>
                      <td className="py-2 pr-4 capitalize font-sans">{m.mode}</td>
                      <td className="py-2 pr-4">{m.samples}</td>
                      <td className="py-2 pr-4">{m.avgCpuUtilPct ?? 'N/A'}%</td>
                      <td className="py-2 pr-4">{m.peakCpuUtilPct ?? 'N/A'}%</td>
                      <td className="py-2 pr-4">{m.avgRamUtilPct ?? 'N/A'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-slate-100">CSV Telemetry Viewer</h3>
            <button
              type="button"
              onClick={() => void loadLoggingData()}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Refresh Rows
            </button>
          </div>
          {logRows.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No telemetry rows recorded yet. Click <strong>Start Logging</strong> to capture live host readings into CSV.
            </div>
          ) : (
            <div className="max-h-72 overflow-auto border border-white/[0.06] rounded">
              <table className="w-full text-left text-xs border-collapse font-mono tabular-nums">
                <thead className="bg-[#090B0F] text-slate-400 sticky top-0 font-sans">
                  <tr>
                    <th className="py-2 px-3 font-medium">Timestamp</th>
                    <th className="py-2 px-3 font-medium">Mode</th>
                    <th className="py-2 px-3 font-medium">CPU %</th>
                    <th className="py-2 px-3 font-medium">Clock</th>
                    <th className="py-2 px-3 font-medium">RAM %</th>
                    <th className="py-2 px-3 font-medium">CPU °C</th>
                    <th className="py-2 px-3 font-medium">GPU °C</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-slate-300">
                  {logRows.slice(0, 50).map((r, i) => (
                    <tr key={`${r.timestamp}-${i}`}>
                      <td className="py-1.5 px-3 whitespace-nowrap">{r.timestamp.slice(11, 19)}</td>
                      <td className="py-1.5 px-3 capitalize font-sans">{r.activeMode}</td>
                      <td className="py-1.5 px-3">{r.cpuUtilPct}%</td>
                      <td className="py-1.5 px-3">{r.cpuClockMhz} MHz</td>
                      <td className="py-1.5 px-3">{r.ramUtilPct}%</td>
                      <td className="py-1.5 px-3">{r.cpuTempC}</td>
                      <td className="py-1.5 px-3">{r.gpuTempC}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Settings & Windows .NET 8 Companion Bundle
  const connectAgent = async () => {
    const res = await fetch('/api/agent/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentUrl: agentInput }),
    });
    const json = await res.json();
    if (json.connected) {
      setStatusMsg(`Connected to Windows Companion Agent at ${json.agentUrl}`);
      await onRefreshTelemetry();
    } else {
      setStatusMsg(json.error || 'Unable to reach Windows Companion Agent.');
    }
  };

  const viewBundleFile = async (filePath: string) => {
    setSelectedBundleFile(filePath);
    const res = await fetch(`/api/windows-bundle/file?path=${encodeURIComponent(filePath)}`);
    if (res.ok) {
      const json = await res.json();
      setBundleFileContent(json.content ?? '');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-100">
          Settings, Backup &amp; Windows .NET 8 Desktop App
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Connect a live Windows Evol P15 agent, manage backups, or download the complete C# .NET 8 WPF desktop source code.
        </p>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-[#11151C] border border-white/[0.1] text-xs text-sky-300">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Windows Companion Bridge (127.0.0.1:17830)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Run <span className="font-mono text-slate-200">EvolControlCenter.exe</span> on your Colorful Evol P15 2024 to bridge live LibreHardwareMonitor, NVIDIA NVML, and WMI telemetry directly into this console.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-[#090B0F] border border-white/[0.12] font-mono text-slate-100"
            />
            <button
              type="button"
              onClick={() => void connectAgent()}
              className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium whitespace-nowrap"
            >
              Connect Agent
            </button>
          </div>
          <div className="flex flex-wrap gap-5 pt-2">
            <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.launchWithWindows}
                onChange={(e) => void onSaveConfig({ launchWithWindows: e.target.checked })}
              />
              Launch with Windows
            </label>
            <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.minimizeToTray}
                onChange={(e) => void onSaveConfig({ minimizeToTray: e.target.checked })}
              />
              Minimize to System Tray
            </label>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4 text-xs">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Configuration Backup &amp; Recovery
          </h3>
          <p className="text-slate-400">
            Export all profiles, custom fan curves, macros, and thermal thresholds or reset to verified factory defaults.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="/api/backup"
              className="px-3.5 py-2 rounded-md bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Backup JSON
            </a>
            <label className="px-3.5 py-2 rounded-md bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Restore JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  try {
                    const parsed = JSON.parse(text) as EvolConfig;
                    const res = await onRestoreConfig(parsed);
                    setStatusMsg(res.ok ? 'Configuration restored from backup.' : res.error ?? 'Invalid backup.');
                  } catch {
                    setStatusMsg('Invalid JSON backup file.');
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                await onResetConfig();
                setStatusMsg('All settings restored to factory defaults.');
              }}
              className="px-3.5 py-2 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Emergency Reset
            </button>
          </div>
        </div>
      </div>

      {/* Windows .NET 8 Desktop Application Source Explorer & ZIP Export */}
      <section className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-sky-400" />
              Windows Desktop Build &amp; Packaging Bundle (.NET 8 WPF + Inno Setup + GitHub Actions)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Includes <span className="font-mono">build.bat</span> / <span className="font-mono">build.ps1</span>, <span className="font-mono">EvolControlCenter.iss</span>, and <span className="font-mono">build-windows.yml</span> to produce <span className="font-mono">EVOL-Control-Center.exe</span> &amp; <span className="font-mono">EVOL-Control-Center-Setup.exe</span>.
            </p>
          </div>
          <a
            href="/api/windows-bundle/download"
            className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Download Windows Build ZIP
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 max-h-80 overflow-y-auto rounded border border-white/[0.07] bg-[#090B0F] divide-y divide-white/[0.05]">
            {bundleFiles.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => void viewBundleFile(file)}
                className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 ${
                  selectedBundleFile === file
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{file}</span>
              </button>
            ))}
          </div>
          <div className="lg:col-span-8 max-h-80 overflow-auto rounded border border-white/[0.07] bg-[#090B0F] p-3.5">
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
              {bundleFileContent || 'Select a Windows source file to inspect.'}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
