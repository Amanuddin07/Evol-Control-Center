using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using EvolControlCenter.Engines;
using EvolControlCenter.Models;
using EvolControlCenter.Services;

namespace EvolControlCenter.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly HardwareMonitoringEngine _monitor;
    private readonly AutomationEngine _automation;
    private readonly DataLoggingEngine _logger;
    private readonly FanManagementEngine _fanEngine;
    private readonly KeyboardEngine _keyboardEngine;
    private readonly DisplayManagementEngine _displayEngine;
    private readonly DiagnosticsEngine _diagnosticsEngine;
    private readonly UpdateDetectionEngine _updateDetectionEngine;
    private readonly ConfigStore _configStore;
    private readonly EvolAppConfig _config;
    private readonly DispatcherTimer _timer;

    private HardwareTelemetry _telemetry = new();
    private string _statusMessage = "Initializing Windows hardware sensors...";
    private string _activeMode = "work";
    private bool _isLogging;
    private bool _launchWithWindows;
    private int _stabilityScore = 100;

    public event PropertyChangedEventHandler? PropertyChanged;

    public MainViewModel(
        HardwareMonitoringEngine monitor,
        AutomationEngine automation,
        DataLoggingEngine logger,
        FanManagementEngine fanEngine,
        KeyboardEngine keyboardEngine,
        DisplayManagementEngine displayEngine,
        DiagnosticsEngine diagnosticsEngine,
        UpdateDetectionEngine updateDetectionEngine,
        ConfigStore configStore,
        EvolAppConfig config,
        FirstRunReport firstRunReport)
    {
        _monitor = monitor;
        _automation = automation;
        _logger = logger;
        _fanEngine = fanEngine;
        _keyboardEngine = keyboardEngine;
        _displayEngine = displayEngine;
        _diagnosticsEngine = diagnosticsEngine;
        _updateDetectionEngine = updateDetectionEngine;
        _configStore = configStore;
        _config = config;

        _activeMode = _config.ActiveMode;
        _launchWithWindows = _config.LaunchWithWindows;

        CompatibilityChecks = new ObservableCollection<CapabilityCheckItem>(firstRunReport.Capabilities);
        SystemEvents = new ObservableCollection<SystemEventRecord>();
        AvailableUpdates = new ObservableCollection<InstalledAppUpdate>();
        _statusMessage = firstRunReport.Summary;

        SwitchModeCommand = new RelayCommand(mode =>
        {
            if (mode is string m)
            {
                var res = _automation.SwitchMode(m);
                ActiveMode = _automation.ActiveMode;
                _config.ActiveMode = ActiveMode;
                _configStore.Save(_config);
                StatusMessage = res.Summary;
            }
        });

        ToggleLoggingCommand = new RelayCommand(_ =>
        {
            if (_isLogging)
            {
                _logger.Stop();
                _isLogging = false;
                _config.BackgroundLoggingEnabled = false;
                StatusMessage = "CSV telemetry logging stopped.";
            }
            else
            {
                _logger.Start(() => Telemetry, () => ActiveMode, _config.LoggingIntervalSeconds);
                _isLogging = true;
                _config.BackgroundLoggingEnabled = true;
                StatusMessage = $"CSV telemetry logging active ({_config.LoggingIntervalSeconds}s interval).";
            }
            _configStore.Save(_config);
            OnPropertyChanged(nameof(LoggingButtonText));
        });

        ScanDiagnosticsCommand = new RelayCommand(_ => RunDiagnostics());
        ScanUpdatesCommand = new RelayCommand(_ => RunUpdateScan());
        ResetConfigCommand = new RelayCommand(_ =>
        {
            var def = _configStore.ResetToDefaults();
            _config.ActiveMode = def.ActiveMode;
            _config.LaunchWithWindows = def.LaunchWithWindows;
            LaunchWithWindows = def.LaunchWithWindows;
            var res = _automation.SwitchMode(def.ActiveMode);
            ActiveMode = _automation.ActiveMode;
            StatusMessage = $"Configuration reset to safe defaults. {res.Summary}";
        });

        SetRefreshRateCommand = new RelayCommand(hzObj =>
        {
            if (int.TryParse(hzObj?.ToString(), out var hz))
            {
                var res = _displayEngine.SetRefreshRate(hz);
                StatusMessage = res.Message;
                Refresh();
            }
        });

        RebootUefiCommand = new RelayCommand(_ =>
        {
            try
            {
                Process.Start(new ProcessStartInfo("shutdown.exe", "/r /fw /t 10") { UseShellExecute = true });
                StatusMessage = "Scheduled Windows restart into UEFI Firmware Settings in 10 seconds.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Unable to schedule UEFI reboot: {ex.Message}";
            }
        });

        if (_config.BackgroundLoggingEnabled)
        {
            _logger.Start(() => Telemetry, () => ActiveMode, _config.LoggingIntervalSeconds);
            _isLogging = true;
        }

        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(Math.Max(1000, _config.SamplingIntervalMs)) };
        _timer.Tick += (_, _) => Refresh();
        _timer.Start();
        Refresh();
    }

    public ObservableCollection<CapabilityCheckItem> CompatibilityChecks { get; }
    public ObservableCollection<SystemEventRecord> SystemEvents { get; }
    public ObservableCollection<InstalledAppUpdate> AvailableUpdates { get; }

    public HardwareTelemetry Telemetry
    {
        get => _telemetry;
        private set { _telemetry = value; OnPropertyChanged(); }
    }

    public string ActiveMode
    {
        get => _activeMode;
        private set { _activeMode = value; OnPropertyChanged(); }
    }

    public string StatusMessage
    {
        get => _statusMessage;
        private set { _statusMessage = value; OnPropertyChanged(); }
    }

    public bool LaunchWithWindows
    {
        get => _launchWithWindows;
        set
        {
            if (_launchWithWindows == value) return;
            _launchWithWindows = value;
            _config.LaunchWithWindows = value;
            _configStore.Save(_config);
            var res = _configStore.SetStartupWithWindows(value);
            StatusMessage = res.Message;
            OnPropertyChanged();
        }
    }

    public int StabilityScore
    {
        get => _stabilityScore;
        private set { _stabilityScore = value; OnPropertyChanged(); }
    }

    public string FanCapabilitySummary => _fanEngine.CapabilityNote;
    public string KeyboardCapabilitySummary => _keyboardEngine.ControllerSummary;
    public string LoggingButtonText => _isLogging ? "Stop CSV Logging" : "Start CSV Logging";
    public string AppVersion { get; } = new UpdateCheckerService().CurrentVersion;

    public void SetBridgeUnavailableNotice()
    {
        StatusMessage = $"{StatusMessage} (Local web bridge port 17830 unavailable or already in use.)";
    }

    public ICommand SwitchModeCommand { get; }
    public ICommand ToggleLoggingCommand { get; }
    public ICommand ScanDiagnosticsCommand { get; }
    public ICommand ScanUpdatesCommand { get; }
    public ICommand ResetConfigCommand { get; }
    public ICommand SetRefreshRateCommand { get; }
    public ICommand RebootUefiCommand { get; }

    public void Refresh()
    {
        var sample = _monitor.Sample();
        var (res, hz) = _displayEngine.GetCurrentMode();
        sample.DisplayResolution = res;
        sample.DisplayRefreshHz = hz;
        sample.SupportedRefreshRates = _displayEngine.GetSupportedRefreshRates().ToList();
        Telemetry = sample;
    }

    private async void RunDiagnostics()
    {
        StatusMessage = "Scanning Windows System EventLog...";
        var events = await Task.Run(() => _diagnosticsEngine.ReadCriticalSystemEvents(25));
        SystemEvents.Clear();
        int deduction = 0;
        foreach (var ev in events)
        {
            SystemEvents.Add(ev);
            deduction += ev.Weight;
        }
        StabilityScore = Math.Max(0, 100 - deduction);
        StatusMessage = $"Diagnostics complete: {events.Count} recent System error/critical events · Stability Score {StabilityScore}/100.";
    }

    private async void RunUpdateScan()
    {
        StatusMessage = "Scanning installed packages via winget...";
        var updates = await Task.Run(() => _updateDetectionEngine.ScanWithWinget());
        AvailableUpdates.Clear();
        foreach (var u in updates) AvailableUpdates.Add(u);
        StatusMessage = updates.Count > 0
            ? $"Found {updates.Count} winget package updates."
            : "No pending winget updates detected (or winget CLI unavailable).";
    }

    private void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    private sealed class RelayCommand(Action<object?> execute) : ICommand
    {
        public event EventHandler? CanExecuteChanged { add { } remove { } }
        public bool CanExecute(object? parameter) => true;
        public void Execute(object? parameter) => execute(parameter);
    }
}
