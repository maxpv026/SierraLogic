"use client";

import React from "react";
import {
  ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadarChart, Radar, PolarGrid, PolarRadiusAxis,
} from "recharts";
import type { AnalysisResult, Sentiment } from "@/types";

// ─── Color helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 67) return "#10b981"; // emerald-500
  if (score >= 34) return "#f59e0b"; // amber-500
  return          "#ef4444";         // red-500
}

function sentimentLabel(s: Sentiment): string {
  return s === "positive" ? "Positive" : s === "negative" ? "Negative" : "Neutral";
}

// Keyword relevance decreases logarithmically with position (position 0 = most relevant).
function kwScore(idx: number): number {
  return Math.round(100 * Math.pow(0.84, idx));
}

// ─── Custom Recharts tooltip ──────────────────────────────────────────────────

interface TooltipPayload { payload: { fullName: string; relevance: number } }
function KwTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const { fullName, relevance } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">{fullName}</span>
      <span className="ml-2 text-muted-foreground">relevance {relevance}%</span>
    </div>
  );
}

interface RadarTooltipPayload { payload: { subject: string; A: number } }
function RadarTooltip({ active, payload }: { active?: boolean; payload?: RadarTooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const { subject, A } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">{subject}</span>
      <span className="ml-2 text-muted-foreground">{Math.round(A)}/100</span>
    </div>
  );
}

// ─── Individual chart components ──────────────────────────────────────────────

/** Half-circle radial gauge for sentiment score. */
function SentimentGaugeChart({ score, sentiment }: { score: number; sentiment: Sentiment }) {
  const color  = scoreColor(score);
  const data   = [{ value: score, fill: color }];

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sentiment Score
      </p>
      <div className="relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            cx="50%" cy="80%"
            innerRadius="55%" outerRadius="85%"
            startAngle={180} endAngle={0}
            data={data}
          >
            {/* Full-range background arc */}
            <RadialBar
              dataKey="value"
              background={{ fill: "rgba(100,116,139,0.15)" }}
              cornerRadius={8}
              isAnimationActive
              animationDuration={900}
            />
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Center overlay — score + label */}
        <div className="pointer-events-none absolute bottom-4 flex flex-col items-center">
          <span className="text-4xl font-extrabold tracking-tight" style={{ color }}>
            {score}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{sentimentLabel(sentiment)}</span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal bar chart showing keyword relevance by position. */
function KeywordRelevanceChart({ keywords }: { keywords: string[] }) {
  const data = keywords.map((kw, i) => ({
    name:      kw.length > 15 ? kw.slice(0, 15) + "…" : kw,
    fullName:  kw,
    relevance: kwScore(i),
  }));

  const BAR_COLORS = [
    "#6366f1","#7c3aed","#8b5cf6","#a78bfa","#818cf8","#93c5fd","#60a5fa",
  ];

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Keyword Relevance
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickCount={5}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<KwTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
          <Bar dataKey="relevance" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Radar chart showing five content quality dimensions. */
function ContentRadarChart({ result }: { result: AnalysisResult }) {
  const wordCount = (result.summary ?? "").split(/\s+/).filter(Boolean).length;

  const data = [
    { subject: "Sentiment",    A: result.sentimentScore ?? 50 },
    { subject: "Topic Depth",  A: Math.min(result.topics.length / 5 * 100, 100) },
    { subject: "SEO Coverage", A: Math.min(result.keywords.length / 7 * 100, 100) },
    { subject: "Content",      A: Math.min(wordCount / 50 * 100, 100) },
    { subject: "Profile",      A: (result.category ? 50 : 0) + (result.designStyle ? 50 : 0) },
  ];

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Content Profile
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="rgba(100,116,139,0.2)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickCount={3}
            axisLine={false}
          />
          <Radar
            dataKey="A"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.22}
            dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
            isAnimationActive
            animationDuration={900}
          />
          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stat pill for the summary row. */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface AnalyticsChartsProps { result: AnalysisResult }

export function AnalyticsCharts({ result }: AnalyticsChartsProps) {
  const score = result.sentimentScore ?? 50;

  return (
    <div className="space-y-6">
      {/* Row 1 — gauge + keywords */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SentimentGaugeChart score={score} sentiment={result.sentiment} />
        <KeywordRelevanceChart keywords={result.keywords} />
      </div>

      {/* Row 2 — radar */}
      <ContentRadarChart result={result} />

      {/* Row 3 — stat pills */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Topics"   value={result.topics.length} />
        <Stat label="Keywords" value={result.keywords.length} />
        <Stat label="Category" value={result.category ?? "—"} />
      </div>
    </div>
  );
}
