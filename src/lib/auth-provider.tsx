import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "@/lib/db/client";
import {
  fetchProfile,
  markOnboarded,
  onAuthStateChange,
  signInWithEmail,
  signInWithGoogle,
  signOut as authSignOut,
  signUpWithEmail,
  updateProfile as updateProfileRecord,
  type AppUser,
} from "@/lib/auth";
import { db } from "@/lib/db/client";

type AuthStatus = "loading" | "signed-out" | "signed-in";

interface AuthContextValue {
  status: AuthStatus;
  /** The authenticated user's profile (users row). */
  user: AppUser | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "signed-out"
  );
  const [user, setUser] = useState<AppUser | null>(null);

  const refreshProfile = useCallback(async () => {
    const session = await db().auth.getSession();
    const authUser = session.data.session?.user;
    if (!authUser) {
      setUser(null);
      setStatus("signed-out");
      return;
    }

    let profile: AppUser | null = null;
    try {
      profile = await fetchProfile(authUser.id);
    } catch {
      profile = null; // Don't block the app on a profile fetch failure.
    }

    if (profile) {
      setUser(profile);
    } else {
      // Profile row not created yet (edge case): fall back to auth metadata.
      const meta = authUser.user_metadata ?? {};
      setUser({
        id: authUser.id,
        email: authUser.email ?? "",
        displayName:
          String(meta.display_name ?? meta.full_name ?? meta.name ?? "") || "Threadly user",
        avatarUrl: String(meta.avatar_url ?? meta.picture ?? "") || undefined,
        onboarded: false,
      });
    }
    setStatus("signed-in");
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void refreshProfile();

    const { data: subscription } = onAuthStateChange((session) => {
      if (session?.user) {
        void refreshProfile();
      } else {
        setUser(null);
        setStatus("signed-out");
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
    // The onAuthStateChange listener flips status + loads the profile.
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const result = await signUpWithEmail(email, password, displayName);
      // If a session is returned (auto-confirm), the listener loads the profile.
      return result;
    },
    []
  );

  const signInGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    // Listener clears state; the router redirects to /login.
  }, []);

  const updateProfile = useCallback(
    async (patch: { displayName?: string; avatarUrl?: string }) => {
      const uid = user?.id;
      if (!uid) return;
      await updateProfileRecord(uid, patch);
      await refreshProfile();
    },
    [user?.id, refreshProfile]
  );

  const completeOnboarding = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;
    await markOnboarded(uid);
    await refreshProfile();
  }, [user?.id, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      refreshProfile,
      signIn,
      signUp,
      signInWithGoogle: signInGoogle,
      signOut,
      updateProfile,
      completeOnboarding,
    }),
    [status, user, refreshProfile, signIn, signUp, signInGoogle, signOut, updateProfile, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
