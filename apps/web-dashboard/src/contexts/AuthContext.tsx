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
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDb, getFirebaseAuth, googleProvider } from "@/lib/firebase";
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

const AuthContext = createContext<AuthState | null>(null);

async function resolveFamilyId(uid: string): Promise<{ familyId: string; family: Family }> {
  const db = getDb();
  const parentsQ = query(
    collection(db, "families"),
    where("ownerUid", "==", uid),
    limit(1),
  );
  const ownerSnap = await getDocs(parentsQ);

  if (!ownerSnap.empty) {
    const familyDoc = ownerSnap.docs[0]!;
    return {
      familyId: familyDoc.id,
      family: familyDoc.data() as Family,
    };
  }

  const membershipQ = query(
    collection(db, "families"),
    limit(50),
  );
  const allFamilies = await getDocs(membershipQ);
  for (const fam of allFamilies.docs) {
    const parentRef = doc(db, "families", fam.id, "parents", uid);
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
      return { familyId: fam.id, family: fam.data() as Family };
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (nextUser) => {
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
        const resolved = await resolveFamilyId(nextUser.uid);
        setFamilyId(resolved.familyId);
        setFamily(resolved.family);
        if (nextUser.displayName && resolved.family.displayName === "My Family") {
          const db = getDb();
          await setDoc(
            doc(db, "families", resolved.familyId),
            { displayName: nextUser.displayName },
            { merge: true },
          );
          setFamily({ ...resolved.family, displayName: nextUser.displayName });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load family");
        setFamilyId(null);
        setFamily(null);
      } finally {
        setLoading(false);
      }
    });
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
