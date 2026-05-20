import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyRollup } from "@/lib/types";

export function WeeklyChart({ rollups }: { rollups: DailyRollup[] }) {
  const data = rollups.map((r) => ({
    date: r.date.slice(5),
    minutes: r.totalMinutes,
    budget: r.budgetMinutes ?? 0,
  }));

  return (
    <div className="h-64 w-full">
      <h3 className="text-sm font-medium text-slate-700 mb-2">Last 7 days</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Bar dataKey="minutes" name="Used" fill="#3b82f6" />
          <Bar dataKey="budget" name="Budget" fill="#94a3b8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TodayTimeline({
  byTarget,
}: {
  byTarget: Record<string, { name: string; minutes: number }>;
}) {
  const entries = Object.entries(byTarget).sort((a, b) => b[1].minutes - a[1].minutes);
  const max = Math.max(1, ...entries.map(([, v]) => v.minutes));

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">Today&apos;s timeline</h3>
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-slate-500">No usage recorded yet today.</p>
        )}
        {entries.map(([id, { name, minutes }]) => (
          <div key={id}>
            <div className="flex justify-between text-xs text-slate-600 mb-0.5">
              <span>{name}</span>
              <span>{minutes} min</span>
            </div>
            <div className="h-3 rounded bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded"
                style={{ width: `${(minutes / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TargetTable({
  rows,
}: {
  rows: Array<{ id: string; name: string; minutes: number; category?: string }>;
}) {
  const sorted = [...rows].sort((a, b) => b.minutes - a.minutes);
  return (
    <div className="overflow-x-auto">
      <h3 className="text-sm font-medium text-slate-700 mb-2">Per-target (today)</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2 pr-4">Target</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">{r.name}</td>
              <td className="py-2 pr-4 text-slate-500">{r.category ?? "—"}</td>
              <td className="py-2">{r.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsageSummaryBar({
  minutes,
  budget,
}: {
  minutes: number;
  budget: number | null;
}) {
  const pct = budget ? Math.min(100, (minutes / budget) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-600">
        <span>{minutes} min used</span>
        <span>{budget != null ? `${budget} min budget` : "No budget"}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-200">
        <div
          className={`h-2 rounded-full ${pct >= 100 ? "bg-red-500" : "bg-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
