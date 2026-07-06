"use client";

import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "./ui";

export const PALETTE = ["#1683E2", "#F5C542", "#0A66B2", "#22C55E", "#B8C2CC", "#FFD84D", "#7C93A8", "#E11A22"];

export function ChartCard({ title, height = 240, children }: { title: string; height?: number; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink mb-2">{title}</h3>
      <div style={{ width: "100%", height }}>{children}</div>
    </Card>
  );
}

export function Gauge({ value, max, label, color = "#1683E2" }: { value: number; max: number; label: string; color?: string }) {
  const pctVal = max ? Math.min(100, (value / max) * 100) : 0;
  const data = [{ name: label, value: pctVal, fill: color }];
  return (
    <Card className="p-4 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-ink mb-1 self-start">{label}</h3>
      <div style={{ width: "100%", height: 170 }}>
        <ResponsiveContainer>
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "#0E2A45" }} dataKey="value" cornerRadius={20} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-24 text-center">
        <div className="text-3xl font-bold text-ink">{value}</div>
        <div className="text-xs text-muted">of {max} · {pctVal.toFixed(0)}%</div>
      </div>
      <div className="h-16" />
    </Card>
  );
}

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const shown = data.filter((d) => d.value > 0);
  if (!shown.length) return <div className="h-full flex items-center justify-center text-muted text-sm">No data.</div>;
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={shown} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
          {shown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, xKey, yKey, color = "#1683E2", money = false }: { data: Record<string, unknown>[]; xKey: string; yKey: string; color?: string; money?: boolean }) {
  if (!data.length) return <div className="h-full flex items-center justify-center text-muted text-sm">No data.</div>;
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (money ? `$${Math.round(Number(v) / 1000)}k` : String(v))} width={40} />
        <Tooltip formatter={(v) => (money ? `$${Number(v).toLocaleString()}` : v)} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, xKey, yKey, color = "#F5C542", money = false }: { data: Record<string, unknown>[]; xKey: string; yKey: string; color?: string; money?: boolean }) {
  if (!data.length) return <div className="h-full flex items-center justify-center text-muted text-sm">No data.</div>;
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (money ? `$${Math.round(Number(v) / 1000)}k` : String(v))} width={40} />
        <Tooltip formatter={(v) => (money ? `$${Number(v).toLocaleString()}` : v)} />
        <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
