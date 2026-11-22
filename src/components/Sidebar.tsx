import React from 'react';
import {
  Activity,
  BatteryCharging,
  Cpu,
  Download,
  Fan,
  FileSpreadsheet,
  Gauge,
  HardDrive,
  Home,
  Keyboard,
  Monitor,
  Settings,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import type { NavSectionId } from '../shared/types';

export interface NavItem {
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home Dashboard', icon: Home },
  { id: 'system-info', label: 'System Information', icon: HardDrive },
  { id: 'performance-monitor', label: 'Performance Monitor', icon: Activity },
  { id: 'cpu-control', label: 'CPU Control', icon: Cpu },
  { id: 'gpu-control', label: 'GPU Control', icon: Gauge },
  { id: 'thermal-fan', label: 'Thermal & Fan Control', icon: Fan },
  { id: 'profiles', label: 'Performance Profiles', icon: Sliders },
  { id: 'keyboard-macros', label: 'Keyboard & Macros', icon: Keyboard },
  { id: 'display', label: 'Display Management', icon: Monitor },
  { id: 'bios-firmware', label: 'BIOS & Firmware', icon: ShieldAlert },
  { id: 'power', label: 'Power Management', icon: BatteryCharging },
  { id: 'updates', label: 'Driver & Software Updates', icon: Download },
  { id: 'diagnostics', label: 'System Diagnostics', icon: Activity },
  { id: 'logging', label: 'Data Logging & Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  activeSection: NavSectionId;
  onSelectSection: (id: NavSectionId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  agentConnected: boolean;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
  agentConnected,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-[#0D1016] border-r border-white/[0.08]">
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.08]">
        <div>
          <div className="font-display text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap">
            EVOL CONTROL CENTER
          </div>
          <div className="mt-1 text-xs text-slate-400">Colorful Evol P15 2024</div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left whitespace-nowrap ${
                isActive
                  ? 'bg-white/[0.09] text-slate-50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3.5 border-t border-white/[0.08] text-xs text-slate-400">
        <div className="font-medium text-slate-300">
          {agentConnected ? 'Windows Agent Connected' : 'Host Telemetry Active'}
        </div>
        <div className="mt-0.5 text-slate-500">
          {agentConnected ? 'Live NVML · LHM · WMI' : 'Linux /proc · Safe Mode'}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
}
