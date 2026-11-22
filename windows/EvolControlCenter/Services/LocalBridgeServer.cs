using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EvolControlCenter.Engines;

namespace EvolControlCenter.Services;

/// <summary>
/// Exposes local-only (127.0.0.1:17830) HTTP telemetry and mode-control bridge
/// so the EVOL CONTROL CENTER web console can connect directly to live Windows hardware.
/// </summary>
public sealed class LocalBridgeServer : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly HardwareMonitoringEngine _monitor;
    private readonly AutomationEngine _automation;
    private CancellationTokenSource? _cts;

    public LocalBridgeServer(HardwareMonitoringEngine monitor, AutomationEngine automation)
    {
        _monitor = monitor;
        _automation = automation;
        _listener.Prefixes.Add("http://127.0.0.1:17830/");
    }

    private bool _started;

    public bool Start()
    {
        try
        {
            _cts = new CancellationTokenSource();
            _listener.Start();
            _started = true;
            _ = Task.Run(() => ListenLoop(_cts.Token));
            return true;
        }
        catch
        {
            _started = false;
            return false;
        }
    }

    private async Task ListenLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && _listener.IsListening)
        {
            try
            {
                var ctx = await _listener.GetContextAsync();
                ctx.Response.AddHeader("Access-Control-Allow-Origin", "*");
                ctx.Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                ctx.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type");
                ctx.Response.AddHeader("Content-Type", "application/json");

                if (ctx.Request.HttpMethod == "OPTIONS")
                {
                    ctx.Response.StatusCode = 204;
                }
                else if (ctx.Request.Url?.AbsolutePath == "/api/telemetry")
                {
                    var sample = _monitor.Sample();
                    var json = JsonSerializer.Serialize(sample);
                    var bytes = Encoding.UTF8.GetBytes(json);
                    await ctx.Response.OutputStream.WriteAsync(bytes, ct);
                }
                else if (ctx.Request.Url?.AbsolutePath == "/api/mode" && ctx.Request.HttpMethod == "POST")
                {
                    using var reader = new StreamReader(ctx.Request.InputStream);
                    var body = await reader.ReadToEndAsync(ct);
                    try
                    {
                        using var doc = JsonDocument.Parse(body);
                        var mode = doc.RootElement.TryGetProperty("mode", out var modeEl) ? (modeEl.GetString() ?? "work") : "work";
                        var result = _automation.SwitchMode(mode);
                        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { result.Success, result.Summary, activeMode = _automation.ActiveMode }));
                        await ctx.Response.OutputStream.WriteAsync(bytes, ct);
                    }
                    catch (JsonException)
                    {
                        ctx.Response.StatusCode = 400;
                        var err = Encoding.UTF8.GetBytes("{\"error\":\"Invalid JSON payload.\"}");
                        await ctx.Response.OutputStream.WriteAsync(err, ct);
                    }
                }
                else
                {
                    ctx.Response.StatusCode = 404;
                }
                ctx.Response.Close();
            }
            catch when (ct.IsCancellationRequested) { break; }
            catch { }
        }
    }

    public void Dispose()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        if (_started)
        {
            try { _listener.Stop(); } catch { }
        }
        try { _listener.Close(); } catch { }
    }
}
