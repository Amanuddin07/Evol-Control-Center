using System;
using System.Linq;
using System.Windows;

namespace EvolControlCenter;

public partial class App : System.Windows.Application
{
    public static bool StartMinimized { get; private set; }

    protected override void OnStartup(StartupEventArgs e)
    {
        StartMinimized = e.Args.Any(a => string.Equals(a, "--minimized", StringComparison.OrdinalIgnoreCase));
        base.OnStartup(e);
    }
}
