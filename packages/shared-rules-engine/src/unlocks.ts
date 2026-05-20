import type { NowLocal, TempUnlock, TempUnlockScope } from "./types.js";

export interface UnlockEffects {
  bypassSchedule: boolean;
  bypassAllQuotas: boolean;
  extraTotalMinutes: number;
  extraPerTargetMinutes: Record<string, number>;
}

export function activeUnlocks(
  unlocks: TempUnlock[],
  now: NowLocal,
): TempUnlock[] {
  return unlocks.filter(
    (u) => !u.revoked && u.expiresAtMs > now.epochMs,
  );
}

export function computeUnlockEffects(
  unlocks: TempUnlock[],
  now: NowLocal,
): UnlockEffects {
  const active = activeUnlocks(unlocks, now);
  const effects: UnlockEffects = {
    bypassSchedule: false,
    bypassAllQuotas: false,
    extraTotalMinutes: 0,
    extraPerTargetMinutes: {},
  };

  for (const u of active) {
    if (u.scope === "schedule") {
      effects.bypassSchedule = true;
    }
    if (u.scope === "schedule+quotas") {
      effects.bypassSchedule = true;
      effects.bypassAllQuotas = true;
    }
    if (u.scope === "add-minutes" && u.additionalMinutes) {
      if (u.target === "total") {
        effects.extraTotalMinutes += u.additionalMinutes;
      } else if (u.target) {
        effects.extraPerTargetMinutes[u.target] =
          (effects.extraPerTargetMinutes[u.target] ?? 0) +
          u.additionalMinutes;
      }
    }
  }

  return effects;
}

export function mostPermissiveScope(
  scopes: TempUnlockScope[],
): TempUnlockScope | null {
  if (scopes.includes("schedule+quotas")) return "schedule+quotas";
  if (scopes.includes("schedule")) return "schedule";
  if (scopes.includes("add-minutes")) return "add-minutes";
  return null;
}
