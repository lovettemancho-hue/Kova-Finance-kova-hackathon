import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  User, 
  onAuthStateChanged, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  updateProfile as firebaseUpdateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { 
  getUserDoc, 
  createUserDoc, 
  getLocalCache,
  updateUserProfile as persistUserProfile, 
  updateUserTone as persistUserTone, 
  updateUserCountryAndCurrency as persistUserCountryAndCurrency,
  clearLocalUserCache,
  flushPendingWrites,
  UserDocument
} from '../lib/userService';
import { UserProfile } from '../types';
import { fetchWithAuth } from '../utils/apiClient';
import { purchasePremiumSubscription } from '../lib/billingService';
import { useToast } from './ToastContext';
import { PLAN_LIMITS, PlanLimits, QuotaKey } from '../../server/plans';

/** What the server reports for one counted feature (GET /api/me/entitlement, chat replies). */
export interface QuotaUsage {
  used: number;
  limit: number;
  resetsAt: string;
}

type Plan = 'free' | 'premium';

export interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  tempAuthUser: { email: string; firstName: string } | null;
  setTempAuthUser: React.Dispatch<React.SetStateAction<{ email: string; firstName: string } | null>>;
  isAuthInitializing: boolean;
  plan: 'free' | 'premium';
  isPremium: boolean;
  currency: string;
  country: string;
  authProvider: string | null;
  /** Upgrade/downgrade request from the UI. Resolves true when the user is premium afterwards. */
  updatePlan: (newPlan: Plan) => Promise<boolean>;
  /** True for PLAN_ADMIN_UIDS: may use the test toggle and grant demo premium. */
  canManagePlans: boolean;
  /** Free and Premium limits as the server enforces them (server/plans.ts). Used by the paywall. */
  planLimits: Record<Plan, PlanLimits>;
  /** Today's / this month's usage per feature, as last reported by the server (KOVA-076). */
  usage: Partial<Record<QuotaKey, QuotaUsage>>;
  /** Updates one feature's usage from a server reply, without another request. */
  noteUsage: (key: QuotaKey, usage: QuotaUsage) => void;
  /** Admin only: sets the plan for the given email, or for the caller when email is omitted. */
  setPlanAsAdmin: (plan: Plan, email?: string) => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  updateTone: (newTone: string) => Promise<void>;
  updateCountryAndCurrency: (country: string, currency: string) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string, firstName: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  sendPasswordReset: (email?: string) => Promise<void>;
  processUserAuth: (
    user: { uid: string; email?: string | null; displayName?: string | null },
    fallbackEmail?: string,
    fallbackFirstName?: string
  ) => Promise<{ isReturning: boolean; userDoc: UserDocument | null; profile: UserProfile | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  onUserDataLoaded?: (userDoc: UserDocument, isReturning: boolean) => Promise<void> | void;
  onUserLoggedOut?: () => void;
  onNavigate?: (view: 'landing' | 'auth' | 'quiz' | 'chat') => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  onUserDataLoaded,
  onUserLoggedOut,
  onNavigate,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tempAuthUser, setTempAuthUser] = useState<{ email: string; firstName: string } | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  // Server-owned entitlement: the only source of the plan. `profile.plan` is ignored.
  const [entitlementPlan, setEntitlementPlan] = useState<Plan>('free');
  const [canManagePlans, setCanManagePlans] = useState(false);
  // Bundled copy of server/plans.ts until the server's answer arrives (covers older app builds too).
  const [planLimits, setPlanLimits] = useState<Record<Plan, PlanLimits>>(PLAN_LIMITS);
  const [usage, setUsage] = useState<Partial<Record<QuotaKey, QuotaUsage>>>({});
  const noteUsage = useCallback((key: QuotaKey, u: QuotaUsage) => {
    if (!u || !Number.isFinite(Number(u.used)) || !Number.isFinite(Number(u.limit))) return;
    setUsage((prev) => ({ ...prev, [key]: { used: Number(u.used), limit: Number(u.limit), resetsAt: String(u.resetsAt || '') } }));
  }, []);
  const toast = useToast();

  // Preserve user-entered signup details across Firebase Auth onAuthStateChanged race condition
  const pendingSignupNameRef = useRef<string | null>(null);
  const pendingSignupEmailRef = useRef<string | null>(null);

  const onUserDataLoadedRef = useRef(onUserDataLoaded);
  onUserDataLoadedRef.current = onUserDataLoaded;

  const onUserLoggedOutRef = useRef(onUserLoggedOut);
  onUserLoggedOutRef.current = onUserLoggedOut;

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const plan: Plan = entitlementPlan;
  const isPremium = plan === 'premium';

  const refreshEntitlement = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/me/entitlement');
      if (!res.ok) return;
      const data = await res.json();
      setEntitlementPlan(data.plan === 'premium' ? 'premium' : 'free');
      setCanManagePlans(data.canManagePlans === true);
      if (data.plans?.free?.quotas && data.plans?.premium?.quotas) setPlanLimits(data.plans);
      if (data.usage && typeof data.usage === 'object') setUsage(data.usage);
    } catch (err) {
      console.warn('[AuthContext] Entitlement refresh failed; keeping current plan.');
    }
  }, []);
  const currency = userProfile?.currency || 'USD';
  const country = userProfile?.country || 'United States';
  const authProvider = currentUser?.providerData?.[0]?.providerId || null;

  // Unified handler for routing new vs returning users based on Firestore document state & history
  const processUserAuth = useCallback(async (
    user: { uid: string; email?: string | null; displayName?: string | null; metadata?: { creationTime?: string; lastSignInTime?: string } },
    fallbackEmail?: string,
    fallbackFirstName?: string
  ) => {
    let userDoc: UserDocument | null = null;
    try {
      userDoc = await getUserDoc(user.uid);
    } catch (err: any) {
      console.warn('[AuthContext] getUserDoc network fetch warning:', err);
    }

    // Check offline local cache if network returned null or timed out
    if (!userDoc) {
      userDoc = getLocalCache(user.uid);
    }

    // Determine resolved name & email (safeguarding against 'Friend' fallback when user explicitly provided a name)
    const name =
      fallbackFirstName ||
      pendingSignupNameRef.current ||
      user.displayName?.split(' ')[0] ||
      userDoc?.firstName ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Friend';
    const email = fallbackEmail || pendingSignupEmailRef.current || user.email || userDoc?.email || '';

    // Robust returning-user detection:
    // A user is returning if:
    // 1) Their profile exists and either has completed onboarding or a working goal
    // 2) OR they have existing messages, expenses, or savings goals
    // 3) OR their account was created earlier than the current session (account age > 60s)
    const creationTime = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
    const lastSignInTime = user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
    const isPreExistingAccount = creationTime > 0 && lastSignInTime > 0 && Math.abs(lastSignInTime - creationTime) > 60000;

    const hasStoredActivity = Boolean(
      (userDoc?.profile && (userDoc.profile.isCompletedOnboarding !== false || Boolean(userDoc.profile.workingGoal))) ||
      (userDoc?.messages && userDoc.messages.length > 1) ||
      (userDoc?.expenses && userDoc.expenses.length > 0) ||
      (userDoc?.savingsGoal && userDoc.savingsGoal.id) ||
      (userDoc?.savingsGoals && userDoc.savingsGoals.length > 0)
    );

    const isReturning = hasStoredActivity || isPreExistingAccount;

    // Plan from the stored entitlement right away, then confirm with the server.
    const storedPlan: Plan = userDoc?.entitlement?.plan === 'premium' ? 'premium' : 'free';
    setEntitlementPlan(storedPlan);
    void refreshEntitlement();

    if (isReturning) {
      let loadedProfile = userDoc?.profile || {
        firstName: name,
        email,
        country: 'United States',
        currency: 'USD',
        financialFeeling: 'Looking for balance',
        primaryMotivation: 'Understanding my money',
        overspendTrigger: 'Impulse',
        preferredTone: 'Warm, like a wise mentor',
        workingGoal: userDoc?.savingsGoal?.title || 'Financial clarity',
        isCompletedOnboarding: true,
      };

      // Fallback tone if user is free and has Analytic tone selected
      if (
        storedPlan !== 'premium' &&
        (loadedProfile.preferredTone?.toLowerCase().includes('analytic') ||
          loadedProfile.preferredTone?.toLowerCase().includes('numbers'))
      ) {
        loadedProfile = {
          ...loadedProfile,
          preferredTone: 'Warm, like a wise mentor',
        };
        await persistUserTone(user.uid, 'Warm, like a wise mentor').catch(() => {});
      }

      setUserProfile(loadedProfile);

      if (userDoc && onUserDataLoadedRef.current) {
        try {
          await onUserDataLoadedRef.current(userDoc, true);
        } catch (e) {
          console.warn('[AuthContext] onUserDataLoaded error:', e);
        }
      }
      if (onNavigateRef.current) {
        onNavigateRef.current('chat');
      }

      return { isReturning: true, userDoc, profile: loadedProfile };
    } else {
      setTempAuthUser({ email, firstName: name });

      let createdOrExistingDoc = userDoc;
      if (!userDoc) {
        try {
          // Pass the user's real trimmed first name directly to prevent initial 'Friend' placeholder
          createdOrExistingDoc = await createUserDoc(user.uid, email, name);
        } catch (createErr: any) {
          console.warn('[AuthContext] createUserDoc error:', createErr);
        }
      }

      if (createdOrExistingDoc && onUserDataLoadedRef.current) {
        try {
          await onUserDataLoadedRef.current(createdOrExistingDoc, false);
        } catch (e) {
          console.warn('[AuthContext] onUserDataLoaded error:', e);
        }
      }
      if (onNavigateRef.current) {
        onNavigateRef.current('quiz');
      }

      return { isReturning: false, userDoc: createdOrExistingDoc, profile: null };
    }
  }, [refreshEntitlement]);

  // Synchronized Auth Lifecycle
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Ensure isAuthInitializing never hangs indefinitely
    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setIsAuthInitializing(false);
      }
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setCurrentUser(user);

      if (user) {
        try {
          const pendingName = pendingSignupNameRef.current || undefined;
          const pendingEmail = pendingSignupEmailRef.current || undefined;
          await processUserAuth(user, pendingEmail, pendingName);
        } catch (err) {
          console.error('[AuthContext] processUserAuth error:', err);
          if (onNavigateRef.current) {
            onNavigateRef.current('landing');
          }
        }
      } else {
        setUserProfile(null);
        setTempAuthUser(null);
        setEntitlementPlan('free');
        setCanManagePlans(false);
        if (onUserLoggedOutRef.current) {
          onUserLoggedOutRef.current();
        }
        if (onNavigateRef.current) {
          onNavigateRef.current('landing');
        }
      }

      clearTimeout(fallbackTimer);
      if (isMounted) {
        setIsAuthInitializing(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [processUserAuth]);

  // Analytic tone is premium-only: fall back to Warm when the plan drops to free.
  const applyPlanLocally = useCallback((newPlan: Plan) => {
    setEntitlementPlan(newPlan);
    if (newPlan === 'premium') return;
    setUserProfile((prev) => {
      const tone = prev?.preferredTone?.toLowerCase() || '';
      if (!prev || !(tone.includes('analytic') || tone.includes('numbers'))) return prev;
      const user = auth.currentUser;
      if (user) persistUserTone(user.uid, 'Warm, like a wise mentor').catch(() => {});
      return { ...prev, preferredTone: 'Warm, like a wise mentor' };
    });
  }, []);

  const updatePlan = useCallback(async (newPlan: Plan): Promise<boolean> => {
    if (newPlan === 'free') {
      toast.info('To change your plan, manage your subscription in Google Play.');
      return entitlementPlan === 'premium';
    }
    if (entitlementPlan === 'premium') return true;

    const result = await purchasePremiumSubscription();
    if (!result.ok) {
      if (result.message) toast.info(result.message);
      return false;
    }

    // The store purchase went through; the server checked it with RevenueCat (KOVA-026).
    await refreshEntitlement();
    if (result.plan === 'premium') {
      toast.success('Welcome to Kova Premium.');
      return true;
    }
    toast.info("Thank you. We're confirming your purchase with Google Play, and Premium unlocks as soon as it's verified.");
    return false;
  }, [entitlementPlan, refreshEntitlement, toast]);

  const setPlanAsAdmin = useCallback(async (newPlan: Plan, email?: string) => {
    const res = await fetchWithAuth('/api/admin/entitlement', {
      method: 'POST',
      body: JSON.stringify({ plan: newPlan, ...(email ? { email } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Could not update the plan.');
    }
    if (!email || data?.uid === auth.currentUser?.uid) {
      applyPlanLocally(newPlan);
    }
  }, [applyPlanLocally]);

  const updateTone = useCallback(async (newTone: string) => {
    setUserProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        preferredTone: newTone,
      };
    });

    const user = auth.currentUser;
    if (user) {
      await persistUserTone(user.uid, newTone);
    }
  }, []);

  const updateCountryAndCurrency = useCallback(async (newCountry: string, newCurrency: string) => {
    setUserProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        country: newCountry,
        currency: newCurrency,
      };
    });

    const user = auth.currentUser;
    if (user) {
      await persistUserCountryAndCurrency(user.uid, newCountry, newCurrency);
    }
  }, []);

  const updateProfile = useCallback(async (profile: UserProfile) => {
    setUserProfile(profile);
    const user = auth.currentUser;
    if (user) {
      await persistUserProfile(user.uid, profile);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const userCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    setCurrentUser(userCred.user);
    return userCred.user;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string, firstName: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = firstName.trim();
    // Cache in refs immediately to win the race against onAuthStateChanged
    pendingSignupNameRef.current = cleanName;
    pendingSignupEmailRef.current = cleanEmail;

    try {
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      await firebaseUpdateProfile(userCred.user, { displayName: cleanName });
      await processUserAuth(userCred.user, cleanEmail, cleanName);
      setCurrentUser(userCred.user);
      return userCred.user;
    } finally {
      // Clear after brief delay so any concurrent listener passes
      setTimeout(() => {
        pendingSignupNameRef.current = null;
        pendingSignupEmailRef.current = null;
      }, 3000);
    }
  }, [processUserAuth]);

  const loginWithGoogle = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      // 1. Native Android Google Sign-In flow. Credential Manager first; some phones (older Google Play
      // services, credential provider turned off, no Google account yet) reject it with "Your device
      // doesn't support credential manager", so fall back to the classic Google account picker (KOVA-094).
      let result;
      try {
        result = await FirebaseAuthentication.signInWithGoogle();
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('cancel')) throw err; // the user closed the sheet: don't open a second picker
        console.warn('[AuthContext] Credential Manager sign-in failed, using the account picker:', err?.code || err?.message);
        result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
      }
      if (!result.credential?.idToken) {
        throw new Error('No ID token returned from native Google Sign-In');
      }
      const credential = GoogleAuthProvider.credential(result.credential.idToken);
      const userCred = await signInWithCredential(auth, credential);
      setCurrentUser(userCred.user);
      return userCred.user;
    } else {
      // 2. Web/browser fallback
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      setCurrentUser(userCred.user);
      return userCred.user;
    }
  }, []);

  const logout = useCallback(async () => {
    // 1. Ensure all in-flight Firestore save operations have completely resolved before logging out
    try {
      await flushPendingWrites();
    } catch (flushErr) {
      console.warn('[AuthContext] flushPendingWrites notice on logout:', flushErr);
    }

    // 2. Sign out of Native Capacitor Firebase Authentication if running on mobile
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      }
    } catch (nativeErr) {
      console.warn('[AuthContext] Native Firebase signOut warning:', nativeErr);
    }

    // 3. Sign out of Web Firebase Auth
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }

    setCurrentUser(null);
    setUserProfile(null);
    setTempAuthUser(null);
    setEntitlementPlan('free');
    setCanManagePlans(false);
    if (onUserLoggedOutRef.current) {
      onUserLoggedOutRef.current();
    }
    if (onNavigateRef.current) {
      onNavigateRef.current('landing');
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        await flushPendingWrites();
      } catch (e) {}

      // The server deletes the data (every subcollection, quota, purchase record) and the sign-in
      // (KOVA-092). A Firestore delete from the phone would leave the subcollections behind.
      const res = await fetchWithAuth('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err: any = new Error(data?.error || "We couldn't finish deleting your account. Please try again.");
        err.code = data?.code;
        throw err;
      }

      // Sign out native credentials if applicable
      try {
        if (Capacitor.isNativePlatform()) {
          await FirebaseAuthentication.signOut();
        }
      } catch (nativeErr) {
        console.warn('[AuthContext] Native Firebase signOut warning on delete:', nativeErr);
      }

      clearLocalUserCache(user.uid);
      try {
        await signOut(auth); // the user no longer exists; this just clears the local session
      } catch (e) {}
      setCurrentUser(null);
      setUserProfile(null);
      setTempAuthUser(null);
      setEntitlementPlan('free');
      setCanManagePlans(false);
      if (onUserLoggedOutRef.current) {
        onUserLoggedOutRef.current();
      }
      if (onNavigateRef.current) {
        onNavigateRef.current('landing');
      }
    }
  }, []);

  const sendPasswordReset = useCallback(async (email?: string) => {
    const targetEmail = email || currentUser?.email || userProfile?.email;
    if (!targetEmail || !targetEmail.trim()) {
      throw new Error('No email address available for password reset.');
    }
    const cleanEmail = targetEmail.trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
  }, [currentUser?.email, userProfile?.email]);

  // Every consumer sees the entitlement plan in `userProfile.plan`, whatever the stored profile says.
  const exposedProfile = useMemo<UserProfile | null>(
    () => (userProfile && userProfile.plan !== plan ? { ...userProfile, plan } : userProfile),
    [userProfile, plan]
  );

  const contextValue = useMemo<AuthContextType>(() => ({
    currentUser,
    userProfile: exposedProfile,
    setUserProfile,
    tempAuthUser,
    setTempAuthUser,
    isAuthInitializing,
    plan,
    isPremium,
    currency,
    country,
    authProvider,
    updatePlan,
    canManagePlans,
    planLimits,
    usage,
    noteUsage,
    setPlanAsAdmin,
    refreshEntitlement,
    updateTone,
    updateCountryAndCurrency,
    updateProfile,
    loginWithEmail,
    signUpWithEmail,
    loginWithGoogle,
    logout,
    deleteAccount,
    sendPasswordReset,
    processUserAuth,
  }), [
    currentUser,
    exposedProfile,
    tempAuthUser,
    isAuthInitializing,
    plan,
    isPremium,
    currency,
    country,
    authProvider,
    updatePlan,
    canManagePlans,
    planLimits,
    usage,
    noteUsage,
    setPlanAsAdmin,
    refreshEntitlement,
    updateTone,
    updateCountryAndCurrency,
    updateProfile,
    loginWithEmail,
    signUpWithEmail,
    loginWithGoogle,
    logout,
    deleteAccount,
    sendPasswordReset,
    processUserAuth,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
