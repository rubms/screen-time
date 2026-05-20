import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import type { Child, Device } from "@/lib/types";
import { AVATAR_COLORS } from "@/lib/constants";
import { TamperBanner } from "@/components/TamperBanner";
import { PairingModal } from "@/components/PairingModal";
import { UsageSummaryBar } from "@/components/usage/UsageCharts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomePage() {
  const { familyId } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [devicesByChild, setDevicesByChild] = useState<Record<string, Device[]>>({});
  const [usageByChild, setUsageByChild] = useState<
    Record<string, { minutes: number; budget: number | null }>
  >({});
  const [pairingChild, setPairingChild] = useState<Child | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!familyId) return;
    const db = getDb();
    const q = query(
      collection(db, "families", familyId, "children"),
      where("archived", "==", false),
    );
    return onSnapshot(q, (snap) => {
      setChildren(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child)),
      );
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const db = getDb();
    return onSnapshot(collection(db, "families", familyId, "devices"), (snap) => {
      const map: Record<string, Device[]> = {};
      snap.docs.forEach((d) => {
        const dev = { id: d.id, ...d.data() } as Device;
        if (dev.revoked) return;
        if (!map[dev.childId]) map[dev.childId] = [];
        map[dev.childId]!.push(dev);
      });
      setDevicesByChild(map);
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId || children.length === 0) return;
    const db = getDb();
    const date = todayKey();
    children.forEach((child) => {
      const rollupRef = doc(
        db,
        "families",
        familyId,
        "children",
        child.id,
        "dailyRollups",
        date,
      );
      getDocs(collection(db, "families", familyId, "devices"))
        .then(() => {})
        .catch(() => {});
      onSnapshot(rollupRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUsageByChild((prev) => ({
            ...prev,
            [child.id]: {
              minutes: (data.totalMinutes as number) ?? 0,
              budget: (data.budgetMinutes as number | null) ?? null,
            },
          }));
        }
      });
    });
  }, [familyId, children]);

  const createChild = async () => {
    if (!familyId || !newName.trim()) return;
    const db = getDb();
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
    await addDoc(collection(db, "families", familyId, "children"), {
      displayName: newName.trim(),
      avatarColor: color,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      archived: false,
      createdAt: serverTimestamp(),
    });
    setNewName("");
    setAddOpen(false);
  };

  const archiveChild = async (child: Child) => {
    if (!familyId) return;
    const db = getDb();
    await updateDoc(doc(db, "families", familyId, "children", child.id), {
      archived: true,
    });
  };

  return (
    <div>
      <TamperBanner />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold">Children</h1>
        <Button onClick={() => setAddOpen(true)}>Add child</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => {
          const usage = usageByChild[child.id] ?? { minutes: 0, budget: 120 };
          const devices = devicesByChild[child.id] ?? [];
          return (
            <Card key={child.id}>
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: child.avatarColor }}
                />
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/children/${child.id}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {child.displayName}
                  </Link>
                  <UsageSummaryBar
                    minutes={usage.minutes}
                    budget={usage.budget}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {devices.length} device{devices.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPairingChild(child)}
                >
                  Add device
                </Button>
                <Link to={`/children/${child.id}/rules`}>
                  <Button size="sm" variant="ghost">
                    Rules
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => archiveChild(child)}
                >
                  Archive
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {children.length === 0 && (
        <p className="text-slate-500 text-sm">No children yet. Add one to get started.</p>
      )}

      <Modal open={addOpen} title="Add child" onClose={() => setAddOpen(false)}>
        <Input
          label="Display name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button className="mt-4" onClick={createChild} disabled={!newName.trim()}>
          Create
        </Button>
      </Modal>

      {pairingChild && (
        <PairingModal
          open
          childId={pairingChild.id}
          childName={pairingChild.displayName}
          onClose={() => setPairingChild(null)}
        />
      )}
    </div>
  );
}
