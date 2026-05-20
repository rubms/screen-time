import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import type { TempUnlock } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { formatCountdown } from "@/lib/pairing";

interface ActiveUnlocksProps {
  deviceId: string;
}

export function ActiveUnlocks({ deviceId }: ActiveUnlocksProps) {
  const { familyId, user } = useAuth();
  const [unlocks, setUnlocks] = useState<TempUnlock[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!familyId) return;
    const db = getDb();
    const q = query(
      collection(db, "families", familyId, "temp-unlocks"),
      where("deviceId", "==", deviceId),
      where("revoked", "==", false),
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TempUnlock))
        .filter((u) => u.expiresAt.toMillis() > now);
      setUnlocks(list);
    });
  }, [familyId, deviceId, now]);

  const revoke = async (unlockId: string) => {
    if (!familyId || !user) return;
    const db = getDb();
    await updateDoc(doc(db, "families", familyId, "temp-unlocks", unlockId), {
      revoked: true,
      revokedAt: Timestamp.now(),
      revokedByUid: user.uid,
    });
  };

  if (unlocks.length === 0) return null;

  return (
    <ul className="mt-2 space-y-2">
      {unlocks.map((u) => {
        const remaining = u.expiresAt.toMillis() - now;
        return (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm"
          >
            <span>
              Unlocked ({u.scope}): {formatCountdown(remaining)} remaining
            </span>
            <Button size="sm" variant="danger" onClick={() => revoke(u.id)}>
              Revoke
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
