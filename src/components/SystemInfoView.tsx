import React from 'react';
import { EVOL_P15_COMPATIBILITY_MATRIX } from '../shared/evolCompatibility';
import type { TelemetrySnapshot } from '../shared/types';

interface SystemInfoViewProps {
  telemetry: TelemetrySnapshot;
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-white/[0.05] last:border-b-0 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono tabular-nums text-slate-200 text-right">
        {value === null || value === undefined || value === '' ? 'Unavailable on current host' : String(value)}
      </span>
    </div>
  );
}

export function SystemInfoView({ telemetry }: SystemInfoViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-100">
          System Information &amp; Hardware Inventory
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Live sensor and OS inventory paired with the Colorful Evol P15 2024 India Edition hardware compatibility assessment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">CPU Subsystem</h3>
          <Row label="Processor Model" value={telemetry.cpu.model} />
          <Row label="Vendor" value={telemetry.cpu.vendor} />
          <Row label="Cores / Logical Threads" value={`${telemetry.cpu.cores} / ${telemetry.cpu.threads}`} />
          <Row label="Current Clock Speed" value={telemetry.cpu.currentClockMhz ? `${telemetry.cpu.currentClockMhz} MHz` : null} />
          <Row label="Utilization" value={`${telemetry.cpu.utilizationPct}%`} />
          <Row label="Package Temperature" value={telemetry.cpu.temperatureC !== null ? `${telemetry.cpu.temperatureC} °C` : null} />
          <Row label="Package Power" value={telemetry.cpu.packagePowerW !== null ? `${telemetry.cpu.packagePowerW} W` : null} />
          <Row label="Core Voltage" value={telemetry.cpu.voltageV !== null ? `${telemetry.cpu.voltageV} V` : null} />
          <Row label="Thermal Throttling (PROCHOT)" value={telemetry.cpu.thermalThrottling === null ? null : telemetry.cpu.thermalThrottling ? 'Yes' : 'No'} />
        </div>

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">NVIDIA GPU Subsystem</h3>
          <Row label="GPU Model" value={telemetry.gpu.model} />
          <Row label="Utilization" value={telemetry.gpu.utilizationPct !== null ? `${telemetry.gpu.utilizationPct}%` : null} />
          <Row label="Core / Hotspot Temp" value={telemetry.gpu.temperatureC !== null ? `${telemetry.gpu.temperatureC} °C / ${telemetry.gpu.hotspotC ?? 'N/A'} °C` : null} />
          <Row label="Core Clock" value={telemetry.gpu.clockMhz !== null ? `${telemetry.gpu.clockMhz} MHz` : null} />
          <Row label="VRAM Used / Total" value={telemetry.gpu.vramTotalMb ? `${telemetry.gpu.vramUsedMb} / ${telemetry.gpu.vramTotalMb} MB` : null} />
          <Row label="Board Power" value={telemetry.gpu.powerW !== null ? `${telemetry.gpu.powerW} W` : null} />
          <Row label="GPU Fan Speed" value={telemetry.gpu.fanRpm !== null ? `${telemetry.gpu.fanRpm} RPM` : null} />
          <Row label="Thermal / Power Throttling" value={telemetry.gpu.thermalThrottling === null ? null : telemetry.gpu.thermalThrottling ? 'Active' : 'Nominal'} />
        </div>

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">Memory &amp; Storage</h3>
          <Row label="Installed RAM" value={`${telemetry.ram.totalGb} GB`} />
          <Row label="Available RAM" value={`${telemetry.ram.availableGb} GB (${telemetry.ram.utilizationPct}% used)`} />
          <Row label="Memory Frequency / DDR Gen" value={telemetry.ram.frequencyMhz ? `${telemetry.ram.frequencyMhz} MHz (${telemetry.ram.ddrGen ?? ''})` : null} />
          <Row label="Channel Configuration" value={telemetry.ram.channelConfig} />
          <Row label="Primary Volume" value={`${telemetry.storage.mount} (${telemetry.storage.totalGb} GB)`} />
          <Row label="Available Capacity" value={`${telemetry.storage.availableGb} GB free`} />
          <Row label="SSD Model" value={telemetry.storage.model} />
          <Row label="SSD Temp / SMART Health" value={telemetry.storage.smartHealth} />
        </div>

        <div className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
          <h3 className="font-display text-sm font-semibold text-slate-100 mb-3">Platform, Battery &amp; Network</h3>
          <Row label="OS &amp; Kernel Build" value={`${telemetry.system.osName} · ${telemetry.system.osBuild}`} />
          <Row label="Hostname &amp; Uptime" value={`${telemetry.system.hostname} · ${Math.floor(telemetry.system.uptimeSeconds / 60)}m`} />
          <Row label="Motherboard" value={telemetry.system.motherboard} />
          <Row label="BIOS Version / Date" value={telemetry.system.biosVersion ? `${telemetry.system.biosVersion} (${telemetry.system.biosDate ?? ''})` : null} />
          <Row label="Battery Status" value={telemetry.battery.present ? `${telemetry.battery.percentage}% · ${telemetry.battery.status}` : telemetry.battery.status} />
          <Row label="Active Network Interfaces" value={telemetry.network.length > 0 ? telemetry.network.map((n) => `${n.name} (${n.address})`).slice(0, 2).join(', ') : 'None'} />
        </div>
      </div>

      {/* Evol P15 2024 India Edition Compatibility Assessment */}
      <section className="p-5 rounded-lg bg-[#11151C] border border-white/[0.08]">
        <h3 className="font-display text-base font-semibold text-slate-100">
          Colorful Evol P15 2024 India Edition — Hardware Compatibility Report
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Transparent engineering audit of hardware interfaces, documented APIs, and manufacturer-locked controls.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Subsystem</th>
                <th className="py-2.5 pr-4 font-medium">Evol P15 Hardware Spec</th>
                <th className="py-2.5 pr-4 font-medium">API / Driver Interface</th>
                <th className="py-2.5 pr-4 font-medium">Support Level</th>
                <th className="py-2.5 font-medium">Safety &amp; Limitation Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-slate-300">
              {EVOL_P15_COMPATIBILITY_MATRIX.map((item) => (
                <tr key={item.subsystem} className="hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-medium text-slate-100 align-top">{item.subsystem}</td>
                  <td className="py-3 pr-4 text-slate-400 align-top">{item.evolP15Spec}</td>
                  <td className="py-3 pr-4 font-mono text-slate-300 align-top">{item.interfaceUsed}</td>
                  <td className="py-3 pr-4 align-top whitespace-nowrap">
                    <span
                      className={`font-medium ${
                        item.supportLevel === 'Full Control'
                          ? 'text-emerald-400'
                          : item.supportLevel === 'Locked by BIOS/EC'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                      }`}
                    >
                      {item.supportLevel}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 align-top leading-relaxed">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
