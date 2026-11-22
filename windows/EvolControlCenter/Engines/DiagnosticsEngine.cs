using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace EvolControlCenter.Engines;

public sealed record SystemEventRecord(DateTime Timestamp, string Source, string Category, string Message, int Weight);

public sealed class DiagnosticsEngine
{
    public IReadOnlyList<SystemEventRecord> ReadCriticalSystemEvents(int maxRecords = 25)
    {
        var records = new List<SystemEventRecord>();
        try
        {
            using var log = new EventLog("System");
            for (int i = log.Entries.Count - 1; i >= 0 && records.Count < maxRecords; i--)
            {
                var entry = log.Entries[i];
                bool isCriticalRaw = (int)entry.EntryType == 0;
                if (entry.EntryType != EventLogEntryType.Error && !isCriticalRaw)
                    continue;

                var category = isCriticalRaw ? "Critical" : entry.EntryType.ToString();
                var weight = entry.InstanceId == 41 ? 15 : entry.Source.Contains("WHEA", StringComparison.OrdinalIgnoreCase) ? 12 : 4;
                records.Add(new SystemEventRecord(entry.TimeGenerated, entry.Source, category, entry.Message, weight));
            }
        }
        catch
        {
            // Requires standard EventLog read permissions
        }
        return records;
    }
}
