"use client";

import {
  ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, Legend,
} from "recharts";
import type { RadarDataPoint } from "@/types";

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function BattleTooltip({
  active, payload, label,
  site1Label, site2Label,
}: {
  active?:     boolean;
  payload?:    Array<{ name: string; value: number; color: string }>;
  label?:      string;
  site1Label:  string;
  site2Label:  string;
}) {
  if (!active || !payload?.length) return null;
  const nameMap: Record<string, string> = { site1: site1Label, site2: site2Label };
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-xs">
          {nameMap[entry.name] ?? entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Custom legend ────────────────────────────────────────────────────────────

function BattleLegend({ site1Label, site2Label }: { site1Label: string; site2Label: string }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-6 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6366f1]" />
        <span className="max-w-[140px] truncate font-medium text-foreground">{site1Label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#10b981]" />
        <span className="max-w-[140px] truncate font-medium text-foreground">{site2Label}</span>
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface BattleChartProps {
  data:        RadarDataPoint[];
  site1Label:  string;
  site2Label:  string;
}

export function BattleChart({ data, site1Label, site2Label }: BattleChartProps) {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="rgba(100,116,139,0.18)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickCount={4}
            axisLine={false}
          />

          {/* Site 1 — indigo */}
          <Radar
            name="site1"
            dataKey="site1"
            stroke="#6366f1"
            fill="rgba(99,102,241,0.35)"
            fillOpacity={1}
            dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
            isAnimationActive
            animationDuration={900}
          />

          {/* Site 2 — emerald */}
          <Radar
            name="site2"
            dataKey="site2"
            stroke="#10b981"
            fill="rgba(16,185,129,0.35)"
            fillOpacity={1}
            dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
            isAnimationActive
            animationDuration={900}
            animationBegin={150}
          />

          <Tooltip
            content={
              <BattleTooltip site1Label={site1Label} site2Label={site2Label} />
            }
          />
          <Legend content={<BattleLegend site1Label={site1Label} site2Label={site2Label} />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
