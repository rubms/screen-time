import { useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import type { Device, RuleTarget, TempUnlockScope } from "@/lib/types";
import { TEMP_UNLOCK_PRESETS } from "@/lib/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface TempUnlockModalProps {
  open: boolean;
  device: Device;
  childId: string;
  targets: RuleTarget[];
  onClose: () => void;
}

export function TempUnlockModal({
  open,
  device,
  childId,
  targets,
  onClose,
}: TempUnlockModalProps) {
  const { familyId, user } = useAuth();
  const [duration, setDuration] = useState<number>(15);
  const [customMinutes, setCustomMinutes] = useState("");
  const [scope, setScope] = useState<TempUnlockScope>("schedule");
  const [targetId, setTargetId] = useState<string>("total");
  const [addMinutes, setAddMinutes] = useState(20);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveMinutes =
    customMinutes.trim() !== ""
      ? Math.min(240, Math.max(1, Number(customMinutes) || 15))
      : duration;

  const submit = async () => {
    if (!familyId || !user) return;
    setSaving(true);
    try {
      const db = getDb();
      const expiresAt = Timestamp.fromMillis(
        Date.now() + effectiveMinutes * 60 * 1000,
      );
      await addDoc(collection(db, "families", familyId, "temp-unlocks"), {
        deviceId: device.id,
        childId,
        scope,
        durationMinutes: scope === "add-minutes" ? undefined : effectiveMinutes,
        additionalMinutes: scope === "add-minutes" ? addMinutes : undefined,
        target: scope === "add-minutes" ? targetId : undefined,
        issuedAt: serverTimestamp(),
        expiresAt,
        issuedByUid: user.uid,
        reason: reason.trim() || null,
        revoked: false,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Temp unlock: ${device.displayName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            Grant unlock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Duration</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TEMP_UNLOCK_PRESETS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={duration === m && !customMinutes ? "primary" : "secondary"}
                onClick={() => {
                  setDuration(m);
                  setCustomMinutes("");
                }}
              >
                {m} min
              </Button>
            ))}
          </div>
          <Input
            className="mt-2"
            label="Custom (1–240 min)"
            type="number"
            min={1}
            max={240}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
          />
        </fieldset>

        <label className="block text-sm font-medium text-slate-700">
          Scope
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as TempUnlockScope)}
          >
            <option value="schedule">Schedule only</option>
            <option value="schedule+quotas">Schedule + quotas</option>
            <option value="add-minutes">Add minutes</option>
          </select>
        </label>

        {scope === "add-minutes" && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Target
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="total">Total daily budget</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Additional minutes"
              type="number"
              min={1}
              max={240}
              value={addMinutes}
              onChange={(e) => setAddMinutes(Number(e.target.value))}
            />
          </>
        )}

        <Input
          label="Reason (optional, audited)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}
