using System;
using Drawing = System.Drawing;
using Forms = System.Windows.Forms;

namespace EvolControlCenter.Services;

/// <summary>
/// Manages the Windows System Tray icon, live tooltip telemetry, and quick profile switching.
/// </summary>
public sealed class TrayService : IDisposable
{
    private readonly Forms.NotifyIcon _notifyIcon;

    public TrayService(Action onOpenWindow, Action<string> onSwitchMode, Action onExitRequested)
    {
        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("Open EVOL CONTROL CENTER", null, (_, _) => onOpenWindow());
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("Gaming Mode", null, (_, _) => onSwitchMode("gaming"));
        menu.Items.Add("Work Mode", null, (_, _) => onSwitchMode("work"));
        menu.Items.Add("Battery Saver Mode", null, (_, _) => onSwitchMode("battery"));
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("Exit", null, (_, _) => onExitRequested());

        _notifyIcon = new Forms.NotifyIcon
        {
            Icon = Drawing.SystemIcons.Application,
            Text = "EVOL CONTROL CENTER",
            ContextMenuStrip = menu,
            Visible = true,
        };
        _notifyIcon.DoubleClick += (_, _) => onOpenWindow();
    }

    public void UpdateTooltip(double? cpuTempC, double? gpuTempC, string activeMode)
    {
        var cpu = cpuTempC.HasValue ? $"{cpuTempC:0}°C" : "N/A";
        var gpu = gpuTempC.HasValue ? $"{gpuTempC:0}°C" : "N/A";
        var text = $"EVOL [{activeMode.ToUpperInvariant()}] CPU:{cpu} GPU:{gpu}";
        // NotifyIcon.Text limit is 63 characters on Windows
        _notifyIcon.Text = text.Length <= 63 ? text : text[..63];
    }

    public void ShowAlert(string title, string message, bool critical)
    {
        _notifyIcon.ShowBalloonTip(
            4000,
            title,
            message,
            critical ? Forms.ToolTipIcon.Error : Forms.ToolTipIcon.Warning);
    }

    public void Dispose()
    {
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
    }
}
