using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Win32;

namespace EvolControlCenter.Services;

public sealed class AppProfileConfig
{
    public string Name { get; set; } = "Work Mode";
    public string WindowsPowerPlan { get; set; } = "Balanced";
    public string CpuBoostPolicy { get; set; } = "Efficient Enabled";
    public int Pl1Watts { get; set; } = 35;
    public int Pl2Watts { get; set; } = 65;
    public int TargetRefreshHz { get; set; } = 144;
    public string FanPreset { get; set; } = "balanced";
}

public sealed class EvolAppConfig
{
    public string ActiveMode { get; set; } = "work";
    public bool FirstRunCompleted { get; set; }
    public bool LaunchWithWindows { get; set; }
    public bool MinimizeToTray { get; set; } = true;
    public bool BackgroundLoggingEnabled { get; set; }
    public int LoggingIntervalSeconds { get; set; } = 5;
    public int SamplingIntervalMs { get; set; } = 2000;
    public string FanPreset { get; set; } = "balanced";
    public int CpuWarningC { get; set; } = 85;
    public int CpuCriticalC { get; set; } = 95;
    public int GpuWarningC { get; set; } = 82;
    public int GpuCriticalC { get; set; } = 89;
    public int DisplayRefreshHz { get; set; } = 144;
    public Dictionary<string, AppProfileConfig> Profiles { get; set; } = new();
}

/// <summary>
/// Persists user configuration in %LOCALAPPDATA%\EvolControlCenter\config.json
/// so upgrades preserve settings and supports safe reset to factory defaults.
/// </summary>
public sealed class ConfigStore
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string StartupValueName = "EvolControlCenter";
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public string AppDataDirectory { get; }
    public string ConfigFilePath { get; }

    public ConfigStore()
    {
        AppDataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "EvolControlCenter");
        Directory.CreateDirectory(AppDataDirectory);
        ConfigFilePath = Path.Combine(AppDataDirectory, "config.json");
    }

    public EvolAppConfig Load()
    {
        try
        {
            if (File.Exists(ConfigFilePath))
            {
                var raw = File.ReadAllText(ConfigFilePath);
                var parsed = JsonSerializer.Deserialize<EvolAppConfig>(raw);
                if (parsed is not null)
                {
                    EnsureProfiles(parsed);
                    return parsed;
                }
            }
        }
        catch
        {
            // Fall back to default configuration if JSON is unreadable
        }

        var defaults = LoadDefaults();
        Save(defaults);
        return defaults;
    }

    public EvolAppConfig LoadDefaults()
    {
        try
        {
            var bundledPath = Path.Combine(AppContext.BaseDirectory, "default-config.json");
            if (File.Exists(bundledPath))
            {
                var parsed = JsonSerializer.Deserialize<EvolAppConfig>(File.ReadAllText(bundledPath));
                if (parsed is not null)
                {
                    EnsureProfiles(parsed);
                    return parsed;
                }
            }
        }
        catch
        {
        }

        var fallback = new EvolAppConfig();
        EnsureProfiles(fallback);
        return fallback;
    }

    public void Save(EvolAppConfig config)
    {
        EnsureProfiles(config);
        File.WriteAllText(ConfigFilePath, JsonSerializer.Serialize(config, JsonOpts));
    }

    public EvolAppConfig ResetToDefaults()
    {
        var defaults = LoadDefaults();
        defaults.FirstRunCompleted = true;
        Save(defaults);
        SetStartupWithWindows(defaults.LaunchWithWindows);
        return defaults;
    }

    public (bool Success, string Message) SetStartupWithWindows(bool enable)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            if (key is null) return (false, "Unable to open HKCU Run registry key.");

            if (enable)
            {
                var exePath = Environment.ProcessPath ?? Path.Combine(AppContext.BaseDirectory, "EVOL-Control-Center.exe");
                key.SetValue(StartupValueName, $"\"{exePath}\" --minimized");
                return (true, "Registered EVOL CONTROL CENTER for Windows startup.");
            }

            if (key.GetValue(StartupValueName) is not null)
                key.DeleteValue(StartupValueName, throwOnMissingValue: false);
            return (true, "Removed EVOL CONTROL CENTER from Windows startup.");
        }
        catch (Exception ex)
        {
            return (false, $"Startup registration error: {ex.Message}");
        }
    }

    private static void EnsureProfiles(EvolAppConfig cfg)
    {
        cfg.Profiles ??= new Dictionary<string, AppProfileConfig>();
        if (!cfg.Profiles.ContainsKey("gaming"))
        {
            cfg.Profiles["gaming"] = new AppProfileConfig
            {
                Name = "Gaming Mode",
                WindowsPowerPlan = "High Performance",
                CpuBoostPolicy = "Aggressive",
                Pl1Watts = 45,
                Pl2Watts = 95,
                TargetRefreshHz = 144,
                FanPreset = "performance",
            };
        }
        if (!cfg.Profiles.ContainsKey("work"))
        {
            cfg.Profiles["work"] = new AppProfileConfig
            {
                Name = "Work Mode",
                WindowsPowerPlan = "Balanced",
                CpuBoostPolicy = "Efficient Enabled",
                Pl1Watts = 35,
                Pl2Watts = 65,
                TargetRefreshHz = 144,
                FanPreset = "balanced",
            };
        }
        if (!cfg.Profiles.ContainsKey("battery"))
        {
            cfg.Profiles["battery"] = new AppProfileConfig
            {
                Name = "Battery Saver Mode",
                WindowsPowerPlan = "Power Saver",
                CpuBoostPolicy = "Disabled",
                Pl1Watts = 20,
                Pl2Watts = 35,
                TargetRefreshHz = 60,
                FanPreset = "silent",
            };
        }
    }
}
