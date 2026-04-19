"use client";

import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

export interface SparklinePoint {
  ano: number;
  nota_media: number | null;
}

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
  /**
   * When true, picks the color automatically based on whether the series is
   * trending up (emerald) or down (rose) across its range.
   */
  autoColor?: boolean;
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = "#3b82f6",
  autoColor = true,
}: SparklineProps) {
  const cleaned = useMemo(
    () => (data ?? []).filter((p) => p.nota_media != null).map((p) => ({
      ano: p.ano,
      nota_media: p.nota_media as number,
    })),
    [data]
  );

  const strokeColor = useMemo(() => {
    if (!autoColor) return color;
    if (cleaned.length < 2) return "#64748b";
    const first = cleaned[0].nota_media;
    const last = cleaned[cleaned.length - 1].nota_media;
    if (last > first + 2) return "#10b981"; // emerald
    if (last < first - 2) return "#f43f5e"; // rose
    return "#64748b"; // slate
  }, [cleaned, color, autoColor]);

  if (cleaned.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-300"
        style={{ width, height }}
        aria-label="Sem histórico suficiente"
      >
        —
      </div>
    );
  }

  return (
    <div style={{ width, height }} aria-label="Tendência histórica">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={cleaned} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Tooltip
            cursor={false}
            wrapperStyle={{ outline: "none" }}
            contentStyle={{
              padding: "4px 8px",
              fontSize: "11px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
            }}
            formatter={(value) => [
              typeof value === "number" ? value.toFixed(1) : String(value),
              "Média",
            ]}
            labelFormatter={(label) => `ENEM ${label}`}
          />
          <Line
            type="monotone"
            dataKey="nota_media"
            stroke={strokeColor}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
