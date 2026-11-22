using System;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;

namespace EvolControlCenter.Services;

public sealed record UpdateCheckResult(bool UpdateAvailable, string CurrentVersion, string LatestVersion, string? DownloadUrl, string? ExpectedSha256, string StatusMessage);

/// <summary>
/// Provides version inspection and SHA-256 verified update checks without auto-installing unverified binaries.
/// </summary>
public sealed class UpdateCheckerService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(8) };

    public string CurrentVersion =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

    public async Task<UpdateCheckResult> CheckManifestAsync(string manifestUrl)
    {
        if (string.IsNullOrWhiteSpace(manifestUrl))
            return new UpdateCheckResult(false, CurrentVersion, CurrentVersion, null, null, "No remote update feed configured.");

        try
        {
            var json = await Http.GetStringAsync(manifestUrl);
            using var doc = JsonDocument.Parse(json);
            var latest = doc.RootElement.GetProperty("version").GetString() ?? CurrentVersion;
            var url = doc.RootElement.TryGetProperty("downloadUrl", out var u) ? u.GetString() : null;
            var sha = doc.RootElement.TryGetProperty("sha256", out var s) ? s.GetString() : null;

            bool newer = Version.TryParse(latest, out var vNew) && Version.TryParse(CurrentVersion, out var vCur) && vNew > vCur;
            return new UpdateCheckResult(
                newer,
                CurrentVersion,
                latest,
                url,
                sha,
                newer ? $"Update {latest} available (SHA-256 verification required before install)." : "You are running the latest version.");
        }
        catch (Exception ex)
        {
            return new UpdateCheckResult(false, CurrentVersion, CurrentVersion, null, null, $"Update check failed: {ex.Message}");
        }
    }

    public static bool VerifyFileSha256(string filePath, string expectedHex)
    {
        using var stream = File.OpenRead(filePath);
        var hash = SHA256.HashData(stream);
        var actualHex = Convert.ToHexString(hash);
        return string.Equals(actualHex, expectedHex.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
