using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace EvolControlCenter.Engines;

public sealed record InstalledAppUpdate(string Name, string Id, string CurrentVersion, string AvailableVersion);

public sealed class UpdateDetectionEngine
{
    public IReadOnlyList<InstalledAppUpdate> ScanWithWinget()
    {
        var results = new List<InstalledAppUpdate>();
        try
        {
            using var proc = Process.Start(new ProcessStartInfo
            {
                FileName = "winget.exe",
                Arguments = "upgrade --accept-source-agreements",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            if (proc is null) return results;
            var output = proc.StandardOutput.ReadToEnd();
            proc.WaitForExit(15000);

            foreach (var line in output.Split('\n'))
            {
                var trimmed = line.Trim();
                if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("Name") || trimmed.StartsWith("---"))
                    continue;
                var parts = trimmed.Split("  ", StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 4)
                {
                    results.Add(new InstalledAppUpdate(parts[0].Trim(), parts[1].Trim(), parts[2].Trim(), parts[3].Trim()));
                }
            }
        }
        catch
        {
            // Winget optional if not installed
        }
        return results;
    }
}
