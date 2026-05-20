import { PAIRING_CODE_CHARS } from "./constants";

export function generatePairingCode(length = 6): string {
  const chars = PAIRING_CODE_CHARS;
  let code = "";
  const random = crypto.getRandomValues(new Uint32Array(length));
  for (let i = 0; i < length; i++) {
    code += chars[random[i]! % chars.length];
  }
  return code;
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
