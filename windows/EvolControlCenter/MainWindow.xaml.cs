using System;
using System.ComponentModel;
using System.Windows;
using EvolControlCenter.Engines;
using EvolControlCenter.Services;
using EvolControlCenter.ViewModels;

namespace EvolControlCenter;

public partial class MainWindow : Window
{
    private readonly HardwareMonitoringEngine _monitor;
    private readonly DataLoggingEngine _logger;
    private readonly LocalBridgeServer _bridge;
    private readonly TrayService _tray;
    private readonly EvolAppConfig _config;
    private bool _allowClose;

    public MainWindow()
    {
        InitializeComponent();

        var configStore = new ConfigStore();
        _config = configStore.Load();

        _monitor = new HardwareMonitoringEngine();
        var cpuGpu = new CpuGpuControlEngine();
        var fanEngine = new FanManagementEngine();
        var powerEngine = new PowerProfileEngine();
        var keyboardEngine = new KeyboardEngine();
        var displayEngine = new DisplayManagementEngine();
        var diagnosticsEngine = new DiagnosticsEngine();
        var updateEngine = new UpdateDetectionEngine();
        var automation = new AutomationEngine(powerEngine, cpuGpu, displayEngine);
        _logger = new DataLoggingEngine();

        var initialSample = _monitor.Sample();
        var firstRun = new FirstRunService().Initialize(
            _config,
            configStore,
            initialSample,
            fanEngine,
            keyboardEngine,
            displayEngine);

        automation.SwitchMode(_config.ActiveMode);

        var vm = new MainViewModel(
            _monitor,
            automation,
            _logger,
            fanEngine,
            keyboardEngine,
            displayEngine,
            diagnosticsEngine,
            updateEngine,
            configStore,
            _config,
            firstRun);

        DataContext = vm;

        _bridge = new LocalBridgeServer(_monitor, automation);
        if (!_bridge.Start())
        {
            vm.SetBridgeUnavailableNotice();
        }

        _tray = new TrayService(
            onOpenWindow: () => Dispatcher.Invoke(() =>
            {
                ShowInTaskbar = true;
                Show();
                WindowState = WindowState.Normal;
                Activate();
            }),
            onSwitchMode: mode => Dispatcher.Invoke(() => vm.SwitchModeCommand.Execute(mode)),
            onExitRequested: () => Dispatcher.Invoke(() =>
            {
                _allowClose = true;
                Close();
            }));

        vm.PropertyChanged += (_, args) =>
        {
            if (args.PropertyName is nameof(MainViewModel.Telemetry) or nameof(MainViewModel.ActiveMode))
            {
                _tray.UpdateTooltip(vm.Telemetry.CpuTemperatureC, vm.Telemetry.GpuTemperatureC, vm.ActiveMode);
            }
        };

        if (App.StartMinimized && _config.MinimizeToTray)
        {
            ShowInTaskbar = false;
            WindowState = WindowState.Minimized;
            Loaded += (_, _) =>
            {
                Hide();
                ShowInTaskbar = true;
            };
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_allowClose && _config.MinimizeToTray)
        {
            e.Cancel = true;
            Hide();
            return;
        }
        base.OnClosing(e);
    }

    protected override void OnClosed(EventArgs e)
    {
        _tray.Dispose();
        _bridge.Dispose();
        _logger.Dispose();
        _monitor.Dispose();
        base.OnClosed(e);
    }
}
