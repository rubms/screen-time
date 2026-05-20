import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import bcrypt from "bcryptjs";
import { useAuth } from "@/contexts/AuthContext";
import { getDb, getProjectId } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function SettingsPage() {
  const { familyId, family, user } = useAuth();
  const [displayName, setDisplayName] = useState(family?.displayName ?? "");
  const [pin, setPin] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [parents, setParents] = useState<Array<{ id: string; email?: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [familyIdCopied, setFamilyIdCopied] = useState(false);

  useEffect(() => {
    setDisplayName(family?.displayName ?? "");
  }, [family]);

  useEffect(() => {
    if (!familyId) return;
    getDocs(collection(getDb(), "families", familyId, "parents")).then((snap) => {
      setParents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [familyId]);

  const saveFamilyName = async () => {
    if (!familyId) return;
    await updateDoc(doc(getDb(), "families", familyId), { displayName });
    setMessage("Family name saved.");
  };

  const savePin = async () => {
    if (!familyId || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      setMessage("PIN must be 4–8 digits.");
      return;
    }
    const hash = await bcrypt.hash(pin, 10);
    await setDoc(
      doc(getDb(), "families", familyId, "private", "secrets"),
      { parentPinHash: hash, updatedAt: serverTimestamp() },
      { merge: true },
    );
    setPin("");
    setMessage("Parent PIN saved.");
  };

  const inviteParent = async () => {
    if (!familyId || !user || !inviteEmail.trim()) return;
    const pendingId = `invite_${inviteEmail.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    await setDoc(doc(getDb(), "families", familyId, "parents", pendingId), {
      email: inviteEmail.trim(),
      role: "member",
      addedByUid: user.uid,
      addedAt: serverTimestamp(),
      pending: true,
    });
    setInviteEmail("");
    setMessage(`Invite recorded for ${inviteEmail}. They can sign in with Google.`);
  };

  const copyFamilyId = async () => {
    if (!familyId) return;
    await navigator.clipboard.writeText(familyId);
    setFamilyIdCopied(true);
    setTimeout(() => setFamilyIdCopied(false), 2000);
  };

  const downloadDiagnostics = async () => {
    if (!familyId) return;
    const db = getDb();
    const rulesSnaps = await getDocs(collection(db, "families", familyId, "children"));
    const rules: Record<string, unknown> = {};
    for (const child of rulesSnaps.docs) {
      const r = await getDoc(
        doc(db, "families", familyId, "children", child.id, "rules", "current"),
      );
      if (r.exists()) rules[child.id] = r.data();
    }
    const events: unknown[] = [];
    const devicesSnap = await getDocs(collection(db, "families", familyId, "devices"));
    for (const dev of devicesSnap.docs.slice(0, 5)) {
      const evSnap = await getDocs(
        collection(db, "families", familyId, "devices", dev.id, "events"),
      );
      evSnap.docs
        .slice(-50)
        .forEach((e) => events.push({ deviceId: dev.id, ...e.data() }));
    }
    const blob = new Blob(
      [JSON.stringify({ projectId: getProjectId(), familyId, rules, events }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screen-time-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">Settings</h1>
      {message && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <Card>
        <h2 className="font-medium mb-3">Family</h2>
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Button className="mt-3" onClick={saveFamilyName}>
          Save name
        </Button>
        {familyId && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <Input
              label="Family ID"
              value={familyId}
              readOnly
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <p className="text-xs text-slate-500 mt-1">
              Use with the Windows agent: <code className="text-xs">--family-id</code>{" "}
              or <code className="text-xs">SCREEN_TIME_FAMILY_ID</code>.
            </p>
            <Button className="mt-2" variant="secondary" onClick={copyFamilyId}>
              {familyIdCopied ? "Copied!" : "Copy family ID"}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Parent PIN</h2>
        <p className="text-xs text-slate-500 mb-2">
          Used on child devices to access tray settings (4–8 digits).
        </p>
        <Input
          label="New PIN"
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <Button className="mt-3" onClick={savePin} disabled={pin.length < 4}>
          Save PIN
        </Button>
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Invite parent</h2>
        <Input
          label="Google email"
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <Button className="mt-3" variant="secondary" onClick={inviteParent}>
          Send invite
        </Button>
        <ul className="mt-3 text-sm text-slate-600">
          {parents.map((p) => (
            <li key={p.id}>{p.email ?? p.id}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Diagnostics</h2>
        <p className="text-sm text-slate-600">
          Firebase project: <code className="text-xs">{getProjectId()}</code>
        </p>
        <Button className="mt-3" variant="secondary" onClick={downloadDiagnostics}>
          Download diagnostics
        </Button>
      </Card>
    </div>
  );
}
