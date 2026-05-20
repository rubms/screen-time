import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";

interface TamperEvent {
  id: string;
  deviceId: string;
  type: string;
  timestamp: Date;
}

export function TamperBanner() {
  const { familyId } = useAuth();
  const [events, setEvents] = useState<TamperEvent[]>([]);

  useEffect(() => {
    if (!familyId) return;
    const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const db = getDb();
    const q = query(
      collection(db, "families", familyId, "tamper-attempts"),
      where("timestamp", ">=", since),
      orderBy("timestamp", "desc"),
    );
    getDocs(q)
      .then((snap) => {
        setEvents(
          snap.docs.map((d) => ({
            id: d.id,
            deviceId: (d.data().deviceId as string) ?? "unknown",
            type: (d.data().type as string) ?? "tamper",
            timestamp: (d.data().timestamp as Timestamp)?.toDate() ?? new Date(),
          })),
        );
      })
      .catch(() => setEvents([]));
  }, [familyId]);

  if (events.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">Tamper alerts (last 24h)</p>
      <ul className="mt-1 list-disc pl-5 space-y-0.5">
        {events.slice(0, 5).map((e) => (
          <li key={e.id}>
            {e.type} on device {e.deviceId.slice(0, 8)}… at{" "}
            {e.timestamp.toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
