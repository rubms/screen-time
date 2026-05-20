import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import { PAIRING_DURATION_MS } from "@/lib/constants";
import { formatCountdown, generatePairingCode } from "@/lib/pairing";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface PairingModalProps {
  open: boolean;
  childId: string;
  childName: string;
  onClose: () => void;
  onPaired?: () => void;
}

export function PairingModal({
  open,
  childId,
  childName,
  onClose,
  onPaired,
}: PairingModalProps) {
  const { familyId, user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(PAIRING_DURATION_MS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !familyId) return;
    const newCode = generatePairingCode();
    const expires = Date.now() + PAIRING_DURATION_MS;
    setCode(newCode);
    setExpiresAt(expires);
    setRemaining(PAIRING_DURATION_MS);

    const db = getDb();
    void setDoc(doc(db, "families", familyId, "pairingCodes", newCode), {
      childId,
      expiresAt: Timestamp.fromMillis(expires),
      redeemed: false,
      createdByUid: user?.uid,
    });
  }, [open, familyId, childId, user?.uid]);

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      setRemaining(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (!open || !familyId || !code) return;
    const db = getDb();
    return onSnapshot(doc(db, "families", familyId, "pairingCodes", code), (snap) => {
      if (snap.exists() && snap.data().redeemed === true) {
        onPaired?.();
        onClose();
      }
    });
  }, [open, familyId, code, onClose, onPaired]);

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} title={`Pair device for ${childName}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Enter this code on the child device within 10 minutes.
      </p>
      {code && (
        <div className="text-center">
          <p className="text-4xl font-mono font-bold tracking-widest text-brand-700">
            {code}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Expires in {formatCountdown(remaining)}
          </p>
          <Button className="mt-4" variant="secondary" onClick={copyCode}>
            {copied ? "Copied!" : "Copy code"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
