import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./lib/admin";

const RETENTION_DAYS = 90;
const BATCH_SIZE = 500;

export const cleanupOldEvents = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "UTC",
  },
  async () => {
    const firestore = db();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const familiesSnap = await firestore.collection("families").get();

    for (const familyDoc of familiesSnap.docs) {
      const familyId = familyDoc.id;
      const devicesSnap = await firestore
        .collection(`families/${familyId}/devices`)
        .get();

      for (const deviceDoc of devicesSnap.docs) {
        const eventsRef = firestore.collection(
          `families/${familyId}/devices/${deviceDoc.id}/events`,
        );

        let deleted = 0;
        do {
          const oldEvents = await eventsRef
            .where("serverAt", "<", cutoff)
            .limit(BATCH_SIZE)
            .get();

          if (oldEvents.empty) {
            break;
          }

          const batch = firestore.batch();
          for (const doc of oldEvents.docs) {
            batch.delete(doc.ref);
          }
          await batch.commit();
          deleted = oldEvents.size;
        } while (deleted === BATCH_SIZE);
      }
    }
  },
);
