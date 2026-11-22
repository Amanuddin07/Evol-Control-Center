import React from 'react';

export interface TelemetryPoint {
  timeLabel: string;
  cpuUtil: number;
  ramUtil: number;
  cpuClockMhz: number | null;
  cpuTempC: number | null;
  gpuUtil: number | null;
  gpuTempC: number | null;
}

interface TelemetryChartProps {
  points: TelemetryPoint[];
  height?: number;
  showTemp?: boolean;
}

export function TelemetryChart({ points, height = 220, showTemp = true }: TelemetryChartProps) {
  const width = 680;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const buildPath = (values: Array<number | null>, maxVal = 100): string | null => {
    const valid = values
      .map((v, idx) => ({ v, idx }))
      .filter((item): item is { v: number; idx: number } => item.v !== null && Number.isFinite(item.v));
    if (valid.length < 2) return null;

    const denom = Math.max(1, values.length - 1);
    return valid
      .map((pt, i) => {
        const x = padL + (pt.idx / denom) * plotW;
        const clamped = Math.max(0, Math.min(maxVal, pt.v));
        const y = padT + plotH - (clamped / maxVal) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const cpuPath = buildPath(points.map((p) => p.cpuUtil), 100);
  const ramPath = buildPath(points.map((p) => p.ramUtil), 100);
  const cpuTempPath = showTemp ? buildPath(points.map((p) => p.cpuTempC), 105) : null;
  const gpuUtilPath = buildPath(points.map((p) => p.gpuUtil), 100);

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
        role="img"
        aria-label="Live hardware telemetry performance chart"
      >
        {gridLines.map((val) => {
          const y = padT + plotH - (val / 100) * plotH;
          return (
            <g key={val}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {ramPath && (
          <path d={ramPath} fill="none" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />
        )}
        {cpuPath && (
          <path d={cpuPath} fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinejoin="round" />
        )}
        {gpuUtilPath && (
          <path d={gpuUtilPath} fill="none" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" />
        )}
        {cpuTempPath && (
          <path
            d={cpuTempPath}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1.75"
            strokeDasharray="5 3"
            strokeLinejoin="round"
          />
        )}

        {points.length > 0 && (
          <>
            <text
              x={padL}
              y={height - 6}
              fill="#64748B"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {points[0].timeLabel}
            </text>
            <text
              x={width - padR}
              y={height - 6}
              textAnchor="end"
              fill="#64748B"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {points[points.length - 1].timeLabel}
            </text>
          </>
        )}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-0.5 bg-sky-400 inline-block" />
          CPU Utilization
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
          RAM Utilization
        </span>
        {gpuUtilPath && (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 bg-orange-500 inline-block" />
            GPU Utilization (NVML)
          </span>
        )}
        {cpuTempPath && (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 bg-amber-500 inline-block" />
            CPU Temp (°C)
          </span>
        )}
      </div>
    </div>
  );
}
