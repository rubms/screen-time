import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import type { Child, Device, DailyRollup, RulesDocument, UsageEvent } from "@/lib/types";
import { ActiveUnlocks } from "@/components/ActiveUnlocks";
import { TempUnlockModal } from "@/components/TempUnlockModal";
import {
  TargetTable,
  TodayTimeline,
  WeeklyChart,
} from "@/components/usage/UsageCharts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function ChildDetailPage() {
  const { childId } = useParams<{ childId: string }>();
  const { familyId } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rules, setRules] = useState<RulesDocument | null>(null);
  const [rollups, setRollups] = useState<DailyRollup[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [unlockDevice, setUnlockDevice] = useState<Device | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("all");

  useEffect(() => {
    if (!familyId || !childId) return;
    const db = getDb();
    getDoc(doc(db, "families", familyId, "children", childId)).then((snap) => {
      if (snap.exists()) setChild({ id: snap.id, ...snap.data() } as Child);
    });
    getDoc(doc(db, "families", familyId, "children", childId, "rules", "current")).then(
      (snap) => {
        if (snap.exists()) setRules(snap.data() as RulesDocument);
      },
    );
  }, [familyId, childId]);

  useEffect(() => {
    if (!familyId || !childId) return;
    const db = getDb();
    const q = query(
      collection(db, "families", familyId, "devices"),
      where("childId", "==", childId),
    );
    return onSnapshot(q, (snap) => {
      setDevices(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Device))
          .filter((d) => !d.revoked),
      );
    });
  }, [familyId, childId]);

  useEffect(() => {
    if (!familyId || !childId) return;
    const db = getDb();
    const days = last7Days();
    Promise.all(
      days.map(async (date) => {
        const snap = await getDoc(
          doc(db, "families", familyId, "children", childId, "dailyRollups", date),
        );
        if (!snap.exists()) {
          return { date, totalMinutes: 0, budgetMinutes: null, byTarget: {} };
        }
        const data = snap.data();
        return {
          date,
          totalMinutes: (data.totalMinutes as number) ?? 0,
          budgetMinutes: (data.budgetMinutes as number | null) ?? null,
          byTarget: (data.byTarget as Record<string, number>) ?? {},
        };
      }),
    ).then(setRollups);
  }, [familyId, childId]);

  useEffect(() => {
    if (!familyId || !childId || devices.length === 0) return;
    const db = getDb();
    const date = todayKey();
    const unsubscribes = devices.map((device) =>
      onSnapshot(
        query(
          collection(db, "families", familyId, "devices", device.id, "events"),
          where("localDate", "==", date),
          orderBy("timestamp", "desc"),
          limit(100),
        ),
        (snap) => {
          const batch = snap.docs.map(
            (d) => ({ id: d.id, deviceId: device.id, ...d.data() } as UsageEvent),
          );
          setEvents((prev) => {
            const others = prev.filter((e) => e.deviceId !== device.id);
            return [...others, ...batch].sort(
              (a, b) =>
                (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0),
            );
          });
        },
      ),
    );
    return () => unsubscribes.forEach((u) => u());
  }, [familyId, childId, devices]);

  const todayRollup = rollups.find((r) => r.date === todayKey());
  const byTargetTimeline: Record<string, { name: string; minutes: number }> = {};
  if (todayRollup?.byTarget) {
    Object.entries(todayRollup.byTarget).forEach(([id, minutes]) => {
      const target = rules?.targets.find((t) => t.id === id);
      byTargetTimeline[id] = {
        name: target?.displayName ?? id,
        minutes,
      };
    });
  }

  const tableRows =
    rules?.targets.map((t) => ({
      id: t.id,
      name: t.displayName,
      category: t.category,
      minutes: todayRollup?.byTarget?.[t.id] ?? 0,
    })) ?? [];

  const filteredEvents =
    eventFilter === "all"
      ? events
      : events.filter((e) => e.type.includes(eventFilter));

  if (!child) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/" className="text-sm text-brand-600">
          ← Home
        </Link>
        <h1 className="text-xl font-semibold flex-1">{child.displayName}</h1>
        <Link to={`/children/${childId}/rules`}>
          <Button variant="secondary" size="sm">
            Edit rules
          </Button>
        </Link>
      </div>

      <Card>
        <WeeklyChart rollups={rollups} />
      </Card>

      <Card>
        <TodayTimeline byTarget={byTargetTimeline} />
        <div className="mt-6">
          <TargetTable rows={tableRows} />
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Devices</h2>
        <ul className="space-y-4">
          {devices.map((device) => (
            <li key={device.id} className="border-b border-slate-100 pb-4 last:border-0">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{device.displayName}</p>
                  <p className="text-xs text-slate-500 capitalize">{device.platform}</p>
                </div>
                <Button size="sm" onClick={() => setUnlockDevice(device)}>
                  Temp unlock
                </Button>
              </div>
              <ActiveUnlocks deviceId={device.id} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2 mb-3">
          <h2 className="font-medium flex-1">Event log</h2>
          <select
            className="text-sm border border-slate-300 rounded-lg px-2 py-1"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="warning">Warnings</option>
            <option value="force-close">Force close</option>
            <option value="tamper">Tamper</option>
            <option value="sync-error">Sync errors</option>
          </select>
        </div>
        <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
          {filteredEvents.slice(0, 50).map((e) => (
            <li key={`${e.deviceId}-${e.id}`} className="text-slate-600">
              <span className="font-mono text-xs">{e.type}</span>
              {e.displayName && ` — ${e.displayName}`}
              {e.minutes != null && ` (${e.minutes}m)`}
            </li>
          ))}
          {filteredEvents.length === 0 && (
            <li className="text-slate-400">No events for today.</li>
          )}
        </ul>
      </Card>

      {unlockDevice && rules && (
        <TempUnlockModal
          open
          device={unlockDevice}
          childId={childId!}
          targets={rules.targets}
          onClose={() => setUnlockDevice(null)}
        />
      )}
    </div>
  );
}
