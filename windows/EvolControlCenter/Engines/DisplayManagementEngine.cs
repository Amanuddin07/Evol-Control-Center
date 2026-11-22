using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;

namespace EvolControlCenter.Engines;

/// <summary>
/// Manages display refresh rates via User32 EnumDisplaySettings / ChangeDisplaySettings
/// and applies software color calibration via GDI SetDeviceGammaRamp.
/// </summary>
public sealed class DisplayManagementEngine
{
    public IReadOnlyList<int> GetSupportedRefreshRates()
    {
        var rates = new HashSet<int>();
        var dm = new DEVMODE { dmSize = (short)Marshal.SizeOf<DEVMODE>() };
        int idx = 0;
        while (EnumDisplaySettings(null, idx++, ref dm))
        {
            if (dm.dmDisplayFrequency > 0) rates.Add(dm.dmDisplayFrequency);
        }
        return rates.OrderBy(r => r).ToList();
    }

    public (string Resolution, int RefreshHz) GetCurrentMode()
    {
        var dm = new DEVMODE { dmSize = (short)Marshal.SizeOf<DEVMODE>() };
        if (!EnumDisplaySettings(null, -1, ref dm))
            return ("Unknown", 60);
        return ($"{dm.dmPelsWidth}x{dm.dmPelsHeight}", dm.dmDisplayFrequency);
    }

    public (bool Success, string Message) SetRefreshRate(int targetHz)
    {
        var dm = new DEVMODE { dmSize = (short)Marshal.SizeOf<DEVMODE>() };
        if (!EnumDisplaySettings(null, -1, ref dm))
            return (false, "Unable to query current display mode.");

        dm.dmDisplayFrequency = targetHz;
        dm.dmFields = 0x00400000;

        int result = ChangeDisplaySettings(ref dm, 0);
        return result == 0
            ? (true, $"Display refresh rate switched to {targetHz} Hz.")
            : (false, $"ChangeDisplaySettings returned error code {result}.");
    }

    public (bool Success, string Message) ApplySoftwareGammaPreset(double gamma = 1.0, double warmthFactor = 1.0)
    {
        try
        {
            var hdc = GetDC(IntPtr.Zero);
            if (hdc == IntPtr.Zero) return (false, "Unable to acquire primary display device context.");

            try
            {
                var ramp = new RAMP
                {
                    Red = new ushort[256],
                    Green = new ushort[256],
                    Blue = new ushort[256],
                };
                for (int i = 0; i < 256; i++)
                {
                    double normalized = Math.Pow(i / 255.0, 1.0 / Math.Clamp(gamma, 0.5, 2.2));
                    ramp.Red[i] = (ushort)Math.Clamp(normalized * 65535, 0, 65535);
                    ramp.Green[i] = (ushort)Math.Clamp(normalized * 65535 * (0.94 + 0.06 * warmthFactor), 0, 65535);
                    ramp.Blue[i] = (ushort)Math.Clamp(normalized * 65535 * warmthFactor, 0, 65535);
                }

                bool ok = SetDeviceGammaRamp(hdc, ref ramp);
                return ok
                    ? (true, "Applied software color calibration via Windows GDI GammaRamp.")
                    : (false, "Display driver rejected SetDeviceGammaRamp call.");
            }
            finally
            {
                ReleaseDC(IntPtr.Zero, hdc);
            }
        }
        catch (Exception ex)
        {
            return (false, $"Software gamma calibration error: {ex.Message}");
        }
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool EnumDisplaySettings(string? deviceName, int modeNum, ref DEVMODE devMode);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int ChangeDisplaySettings(ref DEVMODE devMode, int flags);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    private static extern bool SetDeviceGammaRamp(IntPtr hDC, ref RAMP lpRamp);

    [StructLayout(LayoutKind.Sequential)]
    private struct RAMP
    {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Red;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Green;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Blue;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DEVMODE
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string dmDeviceName;
        public short dmSpecVersion;
        public short dmDriverVersion;
        public short dmSize;
        public short dmDriverExtra;
        public int dmFields;
        public int dmPositionX;
        public int dmPositionY;
        public int dmDisplayOrientation;
        public int dmDisplayFixedOutput;
        public short dmColor;
        public short dmDuplex;
        public short dmYResolution;
        public short dmTTOption;
        public short dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel;
        public int dmPelsWidth;
        public int dmPelsHeight;
        public int dmDisplayFlags;
        public int dmDisplayFrequency;
        public int dmICMMethod;
        public int dmICMIntent;
        public int dmMediaType;
        public int dmDitherType;
        public int dmReserved1;
        public int dmReserved2;
        public int dmPanningWidth;
        public int dmPanningHeight;
    }
}
