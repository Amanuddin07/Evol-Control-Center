import type { CompatibilityComponent } from './types.ts';

export const EVOL_P15_COMPATIBILITY_MATRIX: CompatibilityComponent[] = [
  {
    subsystem: 'CPU (Intel Core i5-12450H / i7-12650H / i7-13620H)',
    evolP15Spec: '12th/13th Gen Intel Alder/Raptor Lake-H · 45W Base TDP · Up to 95W–115W PL2',
    interfaceUsed: 'LibreHardwareMonitor MSR + Windows PowrProf / PowerCfg',
    supportLevel: 'Read-Only / Partial',
    notes:
      'Temperatures, per-core clocks, package wattage, and PROCHOT throttling read via LibreHardwareMonitor. Voltage undervolting (FIVR) is locked by Intel/BIOS on non-HX 12th/13th Gen mobile SKUs; EVOL adjusts safe Windows Power Plans & processor boost policy instead.',
  },
  {
    subsystem: 'Discrete GPU (NVIDIA GeForce RTX 4050 / RTX 4060 Laptop)',
    evolP15Spec: 'Ada Lovelace Mobile · 6GB/8GB GDDR6 · Up to 100W–140W TGP w/ Dynamic Boost',
    interfaceUsed: 'NVIDIA NVML (nvml.dll) & NVAPI',
    supportLevel: 'Full Control',
    notes:
      'Real-time GPU utilization, die/hotspot temperature, core & memory clocks, VRAM allocation, board wattage, and throttling flags read directly via NVML. PowerMizer performance state and supported power limit clamping work within vBIOS bounds.',
  },
  {
    subsystem: 'Embedded Controller (EC) & Dual Cooling Fans',
    evolP15Spec: 'Clevo/Tongfang ODM Chassis · Dual 5V PWM Fans + Shared Heatpipes',
    interfaceUsed: 'ACPI WMI (root\\WMI) & LibreHardwareMonitor SuperIO/EC',
    supportLevel: 'Read-Only / Partial',
    notes:
      'Fan RPM telemetry is exposed if the OEM WMI ACPI table is populated. Direct EC fan-duty override requires signed OEM WMI methods; when undocumented or locked, EVOL never writes raw EC I/O ports and uses thermal-coupled Windows power & GPU TGP throttling safely.',
  },
  {
    subsystem: 'Memory & NVMe Storage',
    evolP15Spec: '16GB DDR4-3200 or DDR5-4800 Dual-Channel · M.2 PCIe Gen4 NVMe SSD',
    interfaceUsed: 'WMI Win32_PhysicalMemory + NVMe SMART IOCTL / LibreHardwareMonitor',
    supportLevel: 'Full Control',
    notes:
      'Capacity, slot count, speed, channel configuration, SSD SMART health, wear percentage, and controller temperature are fully readable through standard Windows APIs without risk.',
  },
  {
    subsystem: 'Keyboard Backlight & Macro Engine',
    evolP15Spec: 'Full-size Chiclet Keyboard w/ Single-Zone / 15-Color Backlight (USB HID)',
    interfaceUsed: 'Windows RawInput / HID + Low-Level Keyboard Hook + SendInput',
    supportLevel: 'OS-Level Alternative',
    notes:
      'The Evol P15 2024 India Edition integrates a single-zone/multi-color backlight rather than addressable per-key RGB LEDs. EVOL honestly disables per-key matrices when HID reports single-zone hardware and provides full OS-level macro profiles & hotkeys.',
  },
  {
    subsystem: 'Display Panel (15.6" IPS 144Hz / 165Hz)',
    evolP15Spec: '1920x1080 144Hz or 2560x1440 165Hz Adaptive Panel · Optimus / MUX-dependent',
    interfaceUsed: 'User32 EnumDisplaySettingsEx / ChangeDisplaySettingsEx + GDI GammaRamp',
    supportLevel: 'Full Control',
    notes:
      'Instant one-click refresh-rate switching (60Hz ↔ 144Hz/165Hz) with automatic 15-second rollback protection. Color temperature/gamma presets use Windows Display GammaRamp (clearly labeled as software color calibration).',
  },
  {
    subsystem: 'BIOS / UEFI & Firmware Updates',
    evolP15Spec: 'InsydeH2O / AMI Aptio V UEFI Firmware · TPM 2.0 · Secure Boot',
    interfaceUsed: 'WMI Win32_BIOS + Windows shutdown /fw UEFI Reboot',
    supportLevel: 'Locked by BIOS/EC',
    notes:
      'EVOL reads BIOS version, release date, TPM 2.0, and Secure Boot status safely and offers one-click Reboot to UEFI Setup. Direct BIOS register writes or silent flashing from Windows are intentionally blocked for brick prevention.',
  },
];

export const OFFICIAL_UPDATE_SOURCES = [
  {
    vendor: 'Colorful Official Support (India & Global)',
    category: 'BIOS, Chipset, EC & OEM Drivers',
    url: 'https://en.colorful.cn/en/home/Download',
    notes: 'Verify exact Evol P15 2024 SKU (e.g. P15 23/24 i5-12450H / i7-13620H) serial before downloading BIOS.',
  },
  {
    vendor: 'NVIDIA GeForce Game Ready / Studio Drivers',
    category: 'RTX 4050 / 4060 Laptop GPU Driver & NVML',
    url: 'https://www.nvidia.com/en-in/geforce/drivers/',
    notes: 'Use official WHQL Notebook drivers for optimal Dynamic Boost and NVML telemetry compatibility.',
  },
  {
    vendor: 'Intel Driver & Support Assistant (DSA)',
    category: '12th/13th Gen Chipset, UHD Graphics, Wi-Fi 6 & DTT',
    url: 'https://www.intel.com/content/www/us/en/support/detect.html',
    notes: 'Keeps Intel Dynamic Tuning Technology (DTT) and AX201/AX211 wireless drivers current.',
  },
  {
    vendor: 'Microsoft Windows Update & Winget',
    category: 'OS Security & Runtime Dependencies',
    url: 'https://learn.microsoft.com/en-us/windows/package-manager/winget/',
    notes: 'Windows Companion App uses native `winget upgrade` for verified application package checks.',
  },
];

export const DEFAULT_VERIFIED_SOFTWARE_CATALOG = [
  {
    name: 'NVIDIA GeForce RTX Laptop Driver',
    category: 'Graphics & Compute',
    recommendedChannel: 'NVIDIA Official WHQL',
    officialUrl: 'https://www.nvidia.com/en-in/geforce/drivers/',
  },
  {
    name: 'Intel Dynamic Tuning & Chipset INF',
    category: 'Platform & Thermal',
    recommendedChannel: 'Intel DSA / Colorful OEM',
    officialUrl: 'https://www.intel.com/content/www/us/en/support/detect.html',
  },
  {
    name: '.NET 8 Desktop Runtime (x64)',
    category: 'EVOL Windows Companion Runtime',
    recommendedChannel: 'Microsoft Official',
    officialUrl: 'https://dotnet.microsoft.com/en-us/download/dotnet/8.0',
  },
  {
    name: 'Colorful Evol P15 BIOS / EC Package',
    category: 'System Firmware',
    recommendedChannel: 'Colorful Support Portal',
    officialUrl: 'https://en.colorful.cn/en/home/Download',
  },
];
