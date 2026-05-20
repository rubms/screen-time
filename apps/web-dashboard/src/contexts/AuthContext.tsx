import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getDb,
  getFirebaseAuth,
  getFirebaseFunctions,
  googleProvider,
} from "@/lib/firebase";
import type { Family } from "@/lib/types";

interface AuthState {
  user: User | null;
  familyId: string | null;
  family: Family | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface EnsureFamilyProfileResult {
  familyId: string;
  family: Family;
}

const AuthContext = createContext<AuthState | null>(null);

/** Client-side bootstrap (requires Firestore rules). */
async function resolveFamilyIdClient(uid: string): Promise<EnsureFamilyProfileResult> {
  const db = getDb();
  const parentsQ = query(
    collection(db, "families"),
    where("ownerUid", "==", uid),
    limit(1),
  );
  const ownerSnap = await getDocs(parentsQ);

  if (!ownerSnap.empty) {
    const familyDoc = ownerSnap.docs[0]!;
    const familyId = familyDoc.id;
    const parentRef = doc(db, "families", familyId, "parents", uid);
    const parentSnap = await getDoc(parentRef);
    if (!parentSnap.exists()) {
      await setDoc(parentRef, {
        uid,
        role: "owner",
        addedAt: serverTimestamp(),
      });
    }
    return {
      familyId,
      family: familyDoc.data() as Family,
    };
  }

  try {
    const membershipQ = query(
      collectionGroup(db, "parents"),
      where("uid", "==", uid),
      limit(1),
    );
    const membershipSnap = await getDocs(membershipQ);
    if (!membershipSnap.empty) {
      const parentDoc = membershipSnap.docs[0]!;
      const familyRef = parentDoc.ref.parent?.parent;
      if (familyRef) {
        const familySnap = await getDoc(familyRef);
        if (familySnap.exists()) {
          return {
            familyId: familyRef.id,
            family: familySnap.data() as Family,
          };
        }
      }
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "failed-precondition") {
      throw err;
    }
  }

  const familyId = crypto.randomUUID();
  const family: Family = {
    ownerUid: uid,
    displayName: "My Family",
    schemaVersion: 1,
  };
  await setDoc(doc(db, "families", familyId), {
    ...family,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "families", familyId, "parents", uid), {
    uid,
    role: "owner",
    addedAt: serverTimestamp(),
  });
  return { familyId, family };
}

/** Prefer Cloud Function so first login works even when auth token/rules race. */
async function resolveFamilyForUser(user: User): Promise<EnsureFamilyProfileResult> {
  await user.getIdToken();

  try {
    const ensureFamily = httpsCallable<
      Record<string, never>,
      EnsureFamilyProfileResult
    >(getFirebaseFunctions(), "ensureFamilyProfile");
    const { data } = await ensureFamily({});
    return data;
  } catch (callableErr) {
    console.warn(
      "ensureFamilyProfile callable failed, falling back to client Firestore:",
      callableErr,
    );
    return resolveFamilyIdClient(user.uid);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setFamilyId(null);
        setFamily(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveFamilyForUser(nextUser);
        if (cancelled) return;
        setFamilyId(resolved.familyId);
        setFamily(resolved.family);
        if (nextUser.displayName && resolved.family.displayName === "My Family") {
          try {
            const db = getDb();
            await setDoc(
              doc(db, "families", resolved.familyId),
              { displayName: nextUser.displayName },
              { merge: true },
            );
            setFamily({
              ...resolved.family,
              displayName: nextUser.displayName,
            });
          } catch (nameErr) {
            console.warn("Could not update family display name:", nameErr);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load family";
        console.error("resolveFamilyForUser failed:", e);
        setError(message);
        setFamilyId(null);
        setFamily(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo(
    () => ({ user, familyId, family, loading, error, signIn, signOut }),
    [user, familyId, family, loading, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
