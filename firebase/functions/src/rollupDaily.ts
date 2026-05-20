import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import {
  aggregateEvents,
  isRollupWindow,
  yesterdayLocalDate,
  type SessionEvent,
} from "./lib/rollup";

async function fetchChildEventsForDate(
  familyId: string,
  childId: string,
  localDate: string,
): Promise<SessionEvent[]> {
  const firestore = db();
  const devicesSnap = await firestore
    .collection(`families/${familyId}/devices`)
    .where("childId", "==", childId)
    .get();

  const events: SessionEvent[] = [];

  for (const deviceDoc of devicesSnap.docs) {
    const eventsSnap = await firestore
      .collection(`families/${familyId}/devices/${deviceDoc.id}/events`)
      .where("localDate", "==", localDate)
      .get();

    for (const ev of eventsSnap.docs) {
      events.push(ev.data() as SessionEvent);
    }
  }

  return events;
}

async function rollupChild(
  familyId: string,
  childId: string,
  timezone: string,
  nowUtc: Date,
): Promise<boolean> {
  if (!isRollupWindow(nowUtc, timezone)) {
    return false;
  }

  const localDate = yesterdayLocalDate(nowUtc, timezone);
  const rollupRef = db().doc(
    `families/${familyId}/children/${childId}/dailyRollups/${localDate}`,
  );

  const events = await fetchChildEventsForDate(familyId, childId, localDate);
  const aggregated = aggregateEvents(events, localDate, childId);

  await rollupRef.set({
    ...aggregated,
    rolledUpAt: FieldValue.serverTimestamp(),
  });

  return true;
}

export const rollupDaily = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "UTC",
  },
  async () => {
    const firestore = db();
    const nowUtc = new Date();
    const familiesSnap = await firestore.collection("families").get();

    for (const familyDoc of familiesSnap.docs) {
      const familyId = familyDoc.id;
      const childrenSnap = await firestore
        .collection(`families/${familyId}/children`)
        .where("archived", "==", false)
        .get();

      for (const childDoc of childrenSnap.docs) {
        const child = childDoc.data();
        const timezone = (child.timezone as string) || "UTC";
        try {
          await rollupChild(familyId, childDoc.id, timezone, nowUtc);
        } catch (err) {
          console.error(
            `rollupDaily failed family=${familyId} child=${childDoc.id}:`,
            err,
          );
        }
      }
    }
  },
);
