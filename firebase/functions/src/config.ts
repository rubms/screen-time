import { setGlobalOptions } from "firebase-functions/v2/options";

/** Match Firestore location (see scripts/firebase-setup.sh FIRESTORE_LOCATION). */
export const FUNCTIONS_REGION = "europe-west1";

setGlobalOptions({ region: FUNCTIONS_REGION });
