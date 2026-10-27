import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, Expense, ChatMessage, SavingsGoal, GrowthMark, MonthlyLetter, SubscriptionNote } from '../types';

/**
 * Storage layout (fix list item 2):
 *   v1 (legacy): `messages` and `expenses` were arrays inside users/{uid}, rewritten whole on
 *       every save. One bad item failed every later save, and the doc grows toward the 1 MiB limit.
 *   v2: one document per item at users/{uid}/messages/{id} and users/{uid}/expenses/{id}.
 *       Saves write only new or changed items; deleting an expense deletes only that doc.
 *       The user doc carries `storageVersion: 2`.
 * Existing users are migrated on their next load (getUserDoc). The v1 arrays are left in place as
 * a backup and are never read again once storageVersion is 2.
 */
export const STORAGE_VERSION = 2;
const BATCH_LIMIT = 400; // Firestore allows 500 writes per batch
const SUBCOLLECTION_TIMEOUT_MS = 4000;

export interface UserDocument {
  uid: string;
  email: string;
  firstName: string;
  profile: UserProfile | null;
  // v2: loaded from the users/{uid}/expenses and users/{uid}/messages subcollections.
  expenses: Expense[];
  messages: ChatMessage[];
  storageVersion?: number;
  savingsGoal?: SavingsGoal | null;
  savingsGoals?: SavingsGoal[];
  growthMarks?: GrowthMark[];
  exploredTopics?: string[];
  // Subscription radar choices (KOVA-086), keyed by merchant key: kept, cancelling, not a subscription…
  subscriptionNotes?: Record<string, SubscriptionNote>;
  notifications: {
    monthlyLetter: boolean;
    dailyGrow: boolean;
  };
  // Settings → Appearance (src/lib/theme.ts). Owner-writable; Premium themes are gated in the app.
  appearance?: {
    theme?: string;
  };
  createdAt: string;
  updatedAt: string;
  // Written only by the server (Admin SDK); Firestore rules block client writes.
  entitlement?: {
    plan: 'free' | 'premium';
    source?: string;
    updatedAt?: string;
  };
}

// ---- Save-failure reporting (fix list item 3) ----------------------------------------------
// Saves used to swallow errors as console "notices", so the UI looked saved when it wasn't.
// Every failed write now goes through reportSaveError: a real console error plus a callback the
// ToastProvider subscribes to, so the user sees "couldn't save". Control flow is unchanged.
type SaveErrorListener = (what: string, error: unknown) => void;
const saveErrorListeners = new Set<SaveErrorListener>();

export function onSaveError(listener: SaveErrorListener): () => void {
  saveErrorListeners.add(listener);
  return () => {
    saveErrorListeners.delete(listener);
  };
}

function reportSaveError(what: string, err: any): void {
  console.error(`[userService] Couldn't save ${what}:`, err?.code || err?.message || err);
  saveErrorListeners.forEach((listener) => {
    try {
      listener(what, err);
    } catch {
      // a broken listener must not break saving
    }
  });
}

// In-flight write promise tracker to guarantee all pending Firestore mutations complete before logout
const pendingWrites = new Set<Promise<any>>();

function trackPendingWrite<T>(promise: Promise<T>): Promise<T> {
  pendingWrites.add(promise);
  promise
    .finally(() => {
      pendingWrites.delete(promise);
    })
    // The caller handles (or reports) the error; this derived promise must not become an
    // unhandled rejection of its own.
    .catch(() => {});
  return promise;
}

/**
 * Await all pending/in-flight Firestore save operations.
 * Use this during logout or navigation transitions to ensure data integrity.
 */
export async function flushPendingWrites(): Promise<void> {
  if (pendingWrites.size === 0) return;
  const currentPromises = Array.from(pendingWrites);
  await Promise.allSettled(currentPromises);
}

/**
 * Robust message comparator to guarantee deterministic chronological ordering.
 * Compares ISO timestamps, formatted strings, or falls back to message IDs.
 */
export function sortMessagesChronologically(messages: ChatMessage[]): ChatMessage[] {
  // `timestamp` is only a time of day ("11:08 AM"), so it can't be used to order messages
  // across days. Order by `createdAt` instead. Messages saved before `createdAt` existed keep
  // the order they are stored in (their position becomes their createdAt) and come before
  // any message that has a real createdAt.
  return messages
    .map((m, i) => (typeof m.createdAt === 'number' ? m : { ...m, createdAt: i }))
    .sort((a, b) => (a.createdAt as number) - (b.createdAt as number));
}

/**
 * Merges stored and incoming messages by id without dropping any, gives every brand-new
 * message a createdAt (in the order it arrived), and returns them in chronological order.
 */
export function mergeChatMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
  now: number = Date.now()
): ChatMessage[] {
  const known = new Map<string, ChatMessage>();
  const out = new Map<string, ChatMessage>();
  (existing || []).forEach((m) => {
    if (m && m.id) {
      known.set(m.id, m);
      out.set(m.id, m);
    }
  });

  let offset = 0;
  (incoming || []).forEach((m) => {
    if (!m || !m.id) return;
    const prev = known.get(m.id);
    let createdAt: number | undefined =
      typeof m.createdAt === 'number' ? m.createdAt : prev?.createdAt;
    if (createdAt === undefined && !prev) createdAt = now + offset++;
    out.set(m.id, createdAt === undefined ? m : { ...m, createdAt });
  });

  return sortMessagesChronologically(Array.from(out.values()));
}

// ---- v2 subcollection helpers -------------------------------------------------------------

type ItemCollection = 'messages' | 'expenses';

function hasId<T extends { id?: string }>(item: T | null | undefined): item is T & { id: string } {
  return Boolean(item && typeof item.id === 'string' && item.id.length > 0 && !item.id.includes('/'));
}

function isPersistableMessage(m: ChatMessage | null | undefined): m is ChatMessage {
  // "Thinking" placeholders are UI-only; the real reply replaces them.
  return hasId(m) && !m.isThinking;
}

/** Newest first, matching how the app and the AI routes read the list (`expenses.slice(0, 5)`). */
export function sortExpensesNewestFirst(expenses: Expense[]): Expense[] {
  const time = (e: Expense) => {
    const t = new Date(e.timestamp).getTime();
    return isNaN(t) ? -Infinity : t;
  };
  return [...expenses].sort((a, b) => time(b) - time(a));
}

function mergeById<T extends { id: string }>(base: T[], override: T[]): T[] {
  const map = new Map<string, T>();
  base.forEach((item) => hasId(item) && map.set(item.id, item));
  override.forEach((item) => hasId(item) && map.set(item.id, item));
  return Array.from(map.values());
}

/** Items in `next` that are new or differ from `prev` (compared by id + content). */
function changedItems<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const before = new Map<string, string>();
  prev.forEach((item) => hasId(item) && before.set(item.id, JSON.stringify(item)));
  return next.filter((item) => hasId(item) && before.get(item.id) !== JSON.stringify(item));
}

/** Writes each item to users/{uid}/{col}/{item.id} (full replace), in batches. Throws on failure. */
async function writeItems<T extends { id: string }>(uid: string, col: ItemCollection, items: T[]): Promise<void> {
  const valid = items.filter(hasId);
  for (let i = 0; i < valid.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const item of valid.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, 'users', uid, col, item.id), item);
    }
    await batch.commit();
  }
}

/** Reads both v2 subcollections, or returns null if either read fails or times out. */
async function readItemSubcollections(
  uid: string
): Promise<{ messages: ChatMessage[]; expenses: Expense[] } | null> {
  try {
    const result = await Promise.race([
      Promise.all([
        getDocs(collection(db, 'users', uid, 'messages')),
        getDocs(collection(db, 'users', uid, 'expenses')),
      ]),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SUBCOLLECTION_TIMEOUT_MS)),
    ]);
    if (!result) {
      console.warn('[getUserDoc] Subcollection read timed out');
      return null;
    }
    return {
      messages: result[0].docs.map((d) => d.data() as ChatMessage),
      expenses: result[1].docs.map((d) => d.data() as Expense),
    };
  } catch (err: any) {
    console.error('[getUserDoc] Subcollection read failed:', err?.message || err);
    return null;
  }
}

/** One-time copy of the v1 arrays into the v2 subcollections, then marks the user doc as v2. */
async function migrateToSubcollections(
  uid: string,
  messages: ChatMessage[],
  expenses: Expense[]
): Promise<boolean> {
  try {
    await writeItems(uid, 'messages', messages.filter(isPersistableMessage));
    await writeItems(uid, 'expenses', expenses);
    await setDoc(
      doc(db, 'users', uid),
      { storageVersion: STORAGE_VERSION, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (err: any) {
    // Not marked as migrated, so the next load retries. Re-copying items is idempotent.
    console.error('[migrateToSubcollections] Migration failed, will retry next load:', err?.message || err);
    return false;
  }
}

export function getLocalCache(uid: string): UserDocument | null {
  try {
    const raw = localStorage.getItem(`kova_user_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Ignore storage parse errors
  }
  return null;
}

function setLocalCache(uid: string, docData: Partial<UserDocument>): UserDocument {
  const existing: UserDocument = getLocalCache(uid) || {
    uid,
    email: '',
    firstName: '',
    profile: null,
    expenses: [],
    messages: [],
    notifications: { monthlyLetter: true, dailyGrow: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = { ...existing, ...docData, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(`kova_user_${uid}`, JSON.stringify(updated));
  } catch (e) {
    // Ignore quota errors
  }
  return updated;
}

export async function getUserDoc(uid: string): Promise<UserDocument | null> {
  const cached = getLocalCache(uid);

  try {
    const ref = doc(db, 'users', uid);

    // Race getDoc against a 2500ms timeout so the UI is never stalled
    const snap = await Promise.race([
      getDoc(ref),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    if (!snap) {
      console.warn('[getUserDoc] Network fetch timed out, falling back to local cache');
      return cached;
    }

    if (snap.exists()) {
      const data = snap.data() as UserDocument;

      // Messages and expenses live in subcollections (v2). Legacy users are migrated here.
      const legacyMessages = Array.isArray(data.messages) ? data.messages : [];
      const legacyExpenses = Array.isArray(data.expenses) ? data.expenses : [];
      const isMigrated = data.storageVersion === STORAGE_VERSION;
      const items = await readItemSubcollections(uid);

      if (items) {
        if (isMigrated) {
          data.messages = items.messages;
          data.expenses = items.expenses;
        } else {
          // Subcollection copies win over legacy array copies with the same id.
          data.messages = mergeById(legacyMessages, items.messages);
          data.expenses = mergeById(legacyExpenses, items.expenses);
          if (await migrateToSubcollections(uid, data.messages, data.expenses)) {
            data.storageVersion = STORAGE_VERSION;
          }
        }
      } else {
        // Couldn't read the subcollections: use this device's cached copy (never an empty or stale
        // list), so the UI state and the cache that saves are diffed against stay identical.
        data.messages = cached?.messages ?? (isMigrated ? [] : legacyMessages);
        data.expenses = cached?.expenses ?? (isMigrated ? [] : legacyExpenses);
      }

      data.messages = sortMessagesChronologically(data.messages.filter(isPersistableMessage));
      data.expenses = sortExpensesNewestFirst(data.expenses.filter(hasId));

      // Fetch goals subcollection with a quick 1500ms timeout
      try {
        const goalsSubRef = collection(db, 'users', uid, 'goals');
        const goalsSnap = await Promise.race([
          getDocs(goalsSubRef),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);

        if (goalsSnap && !goalsSnap.empty) {
          const subGoals = goalsSnap.docs.map((d) => d.data() as SavingsGoal);
          // Merge subcollection goals with array goals if necessary
          const existingMap = new Map<string, SavingsGoal>();
          (data.savingsGoals || []).forEach((g) => {
            if (g.id) existingMap.set(g.id, g);
          });
          subGoals.forEach((g) => {
            if (g.id) existingMap.set(g.id, g);
          });
          if (data.savingsGoal && data.savingsGoal.id) {
            existingMap.set(data.savingsGoal.id, data.savingsGoal);
          }
          data.savingsGoals = Array.from(existingMap.values());
        }
      } catch (e) {
        // Ignore subcollection read errors
      }

      setLocalCache(uid, data);
      return data;
    }
  } catch (err: any) {
    console.warn('Firestore fetch notice (using offline cache if available):', err?.message || err);
  }
  
  if (cached && cached.messages && Array.isArray(cached.messages)) {
    cached.messages = sortMessagesChronologically(cached.messages);
  }
  return cached;
}

export async function createUserDoc(
  uid: string,
  email: string,
  firstName: string,
  profile: UserProfile | null = null
): Promise<UserDocument> {
  const ref = doc(db, 'users', uid);

  // Check if doc already exists before overwriting
  let knownNew = false;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      // Never "create" over an existing user. Load through getUserDoc so messages/expenses
      // come from the subcollections (and legacy users get migrated).
      const existing = (await getUserDoc(uid)) || getLocalCache(uid);
      if (existing) return existing;
      const data = snap.data() as UserDocument;
      return { ...data, messages: [], expenses: [] };
    }
    knownNew = true;
  } catch (e) {
    // Ignore read error, proceed to create
  }

  const newDoc: UserDocument = {
    uid,
    email,
    firstName,
    profile,
    expenses: [],
    messages: [],
    // Only mark v2 when we know the doc didn't exist, so a legacy user is never marked migrated
    // before their arrays are copied.
    ...(knownNew ? { storageVersion: STORAGE_VERSION } : {}),
    notifications: {
      monthlyLetter: true,
      dailyGrow: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  setLocalCache(uid, newDoc);

  // messages/expenses are never written as arrays: a merge write of `[]` would wipe a legacy
  // user's arrays if the existence check above failed.
  const { messages: _messages, expenses: _expenses, ...docFields } = newDoc;

  const writePromise = (async () => {
    try {
      await setDoc(ref, docFields, { merge: true });
    } catch (err: any) {
      reportSaveError('your account', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;

  return newDoc;
}

export async function updateUserProfile(uid: string, profile: UserProfile): Promise<void> {
  setLocalCache(uid, { profile, firstName: profile.firstName });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          profile,
          firstName: profile.firstName,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      reportSaveError('your profile', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserTone(uid: string, newTone: string): Promise<void> {
  const local = getLocalCache(uid);
  if (local && local.profile) {
    local.profile.preferredTone = newTone;
    setLocalCache(uid, { profile: local.profile });
  }
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as UserDocument;
        if (data.profile) {
          data.profile.preferredTone = newTone;
          await setDoc(
            ref,
            { profile: data.profile, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        }
      }
    } catch (err: any) {
      reportSaveError('your tone setting', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserCountryAndCurrency(
  uid: string,
  country: string,
  currency: string
): Promise<void> {
  const local = getLocalCache(uid);
  if (local && local.profile) {
    local.profile.country = country;
    local.profile.currency = currency;
    setLocalCache(uid, { profile: local.profile });
  }
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as UserDocument;
        if (data.profile) {
          data.profile.country = country;
          data.profile.currency = currency;
          await setDoc(
            ref,
            { profile: data.profile, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        }
      }
    } catch (err: any) {
      reportSaveError('your country and currency', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

/**
 * Saves the new and changed expenses in `expenses` to users/{uid}/expenses/{id}.
 * Upsert only: an expense missing from the list is NOT deleted (a stale list must never wipe
 * entries). Use deleteUserExpense to remove one. Throws on failure so callers can roll back.
 */
export async function updateUserExpenses(uid: string, expenses: Expense[]): Promise<void> {
  const previous = getLocalCache(uid)?.expenses || [];
  const toWrite = changedItems(previous, expenses.filter(hasId));
  setLocalCache(uid, { expenses });
  if (toWrite.length === 0) return;

  const writePromise = writeItems(uid, 'expenses', toWrite).catch((err: any) => {
    console.error('[updateUserExpenses] Save failed:', err?.message || err);
    throw err;
  });
  trackPendingWrite(writePromise);
  await writePromise;
}

/** Deletes one expense doc. Throws on failure so callers can roll back. */
export async function deleteUserExpense(uid: string, expenseId: string): Promise<void> {
  const local = getLocalCache(uid);
  if (local) setLocalCache(uid, { expenses: (local.expenses || []).filter((e) => e.id !== expenseId) });
  if (!hasId({ id: expenseId })) return;

  const writePromise = deleteDoc(doc(db, 'users', uid, 'expenses', expenseId)).catch((err: any) => {
    console.error('[deleteUserExpense] Delete failed:', err?.message || err);
    throw err;
  });
  trackPendingWrite(writePromise);
  await writePromise;
}

/**
 * Saves new and changed chat messages to users/{uid}/messages/{id}. Messages are never deleted.
 * Errors are logged, not thrown: callers fire this without awaiting.
 */
export async function updateUserMessages(uid: string, messages: ChatMessage[]): Promise<void> {
  const existingMsgs = getLocalCache(uid)?.messages || [];

  // Merge existing local messages and incoming messages by ID (nothing is dropped),
  // stamp new ones with createdAt, and keep them in chronological order
  const merged = mergeChatMessages(existingMsgs, messages.filter(isPersistableMessage));
  const toWrite = changedItems(existingMsgs, merged);
  setLocalCache(uid, { messages: merged });
  if (toWrite.length === 0) return;

  const writePromise = writeItems(uid, 'messages', toWrite).catch((err: any) => {
    reportSaveError('your chat', err);
  });
  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserNotifications(
  uid: string,
  notifications: { monthlyLetter: boolean; dailyGrow: boolean }
): Promise<void> {
  setLocalCache(uid, { notifications });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          notifications,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      reportSaveError('your notification settings', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

/** Saves the chosen app theme to the account so it follows the user to other devices. */
export async function updateUserAppearance(uid: string, theme: string): Promise<void> {
  setLocalCache(uid, { appearance: { theme } });
  const writePromise = (async () => {
    try {
      await setDoc(
        doc(db, 'users', uid),
        { appearance: { theme }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (err: any) {
      reportSaveError('your theme', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

/**
 * @param options.throwOnError for callers that roll back their optimistic update on failure
 *   (GoalContext): the error is thrown to them instead of the generic "couldn't save" toast.
 */
export async function updateUserSavingsGoals(
  uid: string,
  savingsGoals: SavingsGoal[],
  options: { throwOnError?: boolean } = {}
): Promise<void> {
  const primaryGoal = savingsGoals.find((g) => !g.isArchived) || null;
  setLocalCache(uid, { savingsGoals, savingsGoal: primaryGoal });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          savingsGoals,
          savingsGoal: primaryGoal,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Save each goal into the subcollection users/{uid}/goals/{goalId}
      for (const goal of savingsGoals) {
        if (goal.id) {
          const goalRef = doc(db, 'users', uid, 'goals', goal.id);
          await setDoc(goalRef, goal, { merge: true });
        }
      }
    } catch (err: any) {
      if (options.throwOnError) {
        console.error('[userService] Couldn\'t save your goals:', err?.code || err?.message || err);
        throw err;
      }
      reportSaveError('your goals', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserSavingsGoal(
  uid: string,
  savingsGoal: SavingsGoal | null
): Promise<void> {
  setLocalCache(uid, { savingsGoal: savingsGoal || null });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          savingsGoal: savingsGoal || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (savingsGoal && savingsGoal.id) {
        const goalRef = doc(db, 'users', uid, 'goals', savingsGoal.id);
        await setDoc(goalRef, savingsGoal, { merge: true });
      }
    } catch (err: any) {
      reportSaveError('your goal', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserGrowthMarks(
  uid: string,
  growthMarks: GrowthMark[]
): Promise<void> {
  setLocalCache(uid, { growthMarks });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          growthMarks,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      reportSaveError('your milestones', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserSubscriptionNotes(
  uid: string,
  subscriptionNotes: Record<string, SubscriptionNote>
): Promise<void> {
  setLocalCache(uid, { subscriptionNotes });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(ref, { subscriptionNotes, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err: any) {
      reportSaveError('your subscription choices', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function updateUserExploredTopics(
  uid: string,
  exploredTopics: string[]
): Promise<void> {
  setLocalCache(uid, { exploredTopics });
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          exploredTopics,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      reportSaveError('your Grow progress', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function getMonthlyLetter(
  uid: string,
  yearMonth: string
): Promise<MonthlyLetter | null> {
  try {
    const ref = doc(db, 'users', uid, 'letters', yearMonth);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const letter = snap.data() as MonthlyLetter;
      try {
        localStorage.setItem(`kova_letter_${uid}_${yearMonth}`, JSON.stringify(letter));
      } catch (e) {}
      return letter;
    }
  } catch (err: any) {
    console.warn(`Firestore letter fetch notice for ${yearMonth}:`, err?.message || err);
  }
  try {
    const local = localStorage.getItem(`kova_letter_${uid}_${yearMonth}`);
    if (local) return JSON.parse(local);
  } catch (e) {}
  return null;
}

export async function saveMonthlyLetter(
  uid: string,
  yearMonth: string,
  letter: MonthlyLetter
): Promise<void> {
  try {
    localStorage.setItem(`kova_letter_${uid}_${yearMonth}`, JSON.stringify(letter));
    localStorage.setItem(`kova_latest_letter_${uid}`, JSON.stringify(letter));
  } catch (e) {}
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid, 'letters', yearMonth);
      await setDoc(ref, letter, { merge: true });
    } catch (err: any) {
      reportSaveError('your monthly letter', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function getLatestMonthlyLetter(
  uid: string
): Promise<MonthlyLetter | null> {
  try {
    const lettersRef = collection(db, 'users', uid, 'letters');
    const snap = await getDocs(lettersRef);
    if (!snap.empty) {
      const docs = snap.docs.map((d) => d.data() as MonthlyLetter);
      docs.sort((a, b) => {
        const timeA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
        const timeB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
        return timeB - timeA;
      });
      if (docs[0]) {
        try {
          localStorage.setItem(`kova_latest_letter_${uid}`, JSON.stringify(docs[0]));
        } catch (e) {}
        return docs[0];
      }
    }
  } catch (err: any) {
    console.warn(`Firestore latest letter fetch notice:`, err?.message || err);
  }
  try {
    const local = localStorage.getItem(`kova_latest_letter_${uid}`);
    if (local) return JSON.parse(local);
  } catch (e) {}
  return null;
}

export async function getAllMonthlyLetters(
  uid: string
): Promise<MonthlyLetter[]> {
  const lettersMap = new Map<string, MonthlyLetter>();

  try {
    const lettersRef = collection(db, 'users', uid, 'letters');
    const snap = await getDocs(lettersRef);
    if (!snap.empty) {
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as MonthlyLetter;
        if (data && data.month) {
          const key = `${data.year || 2026}-${data.month}`;
          lettersMap.set(key, data);
        }
      });
    }
  } catch (err: any) {
    console.warn('Firestore get all letters notice:', err?.message || err);
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`kova_letter_${uid}_`)) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item) as MonthlyLetter;
          if (parsed && parsed.month) {
            const letterKey = `${parsed.year || 2026}-${parsed.month}`;
            if (!lettersMap.has(letterKey)) {
              lettersMap.set(letterKey, parsed);
            }
          }
        }
      }
    }
  } catch (e) {}

  const letters = Array.from(lettersMap.values());

  letters.sort((a, b) => {
    const timeA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
    const timeB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
    if (timeA && timeB) return timeB - timeA;
    if (a.year !== b.year) return (b.year || 2026) - (a.year || 2026);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months.indexOf(b.month) - months.indexOf(a.month);
  });

  return letters;
}

/** Removes everything this phone cached for the user (profile, letters, coaching threads). */
export function clearLocalUserCache(uid: string): void {
  if (!uid) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kova_') && key.includes(uid)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {}
}

/**
 * Old phone-side delete: removes only the users/{uid} document, so subcollections stay behind.
 * Account deletion goes through POST /api/account/delete instead (KOVA-092).
 */
export async function deleteUserData(uid: string): Promise<void> {
  try {
    localStorage.removeItem(`kova_user_${uid}`);
    localStorage.removeItem(`kova_latest_letter_${uid}`);
  } catch (e) {}
  const writePromise = (async () => {
    try {
      const ref = doc(db, 'users', uid);
      await deleteDoc(ref);
    } catch (err: any) {
      reportSaveError('the account deletion', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}

export async function getGoalCoachingThread(
  uid: string,
  goalId: string
): Promise<ChatMessage[]> {
  try {
    const colRef = collection(db, 'users', uid, 'goals', goalId, 'coachingThread');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const messages = snap.docs.map((d) => d.data() as ChatMessage);
      const sorted = sortMessagesChronologically(messages);
      try {
        localStorage.setItem(`kova_coaching_${uid}_${goalId}`, JSON.stringify(sorted));
      } catch (e) {}
      return sorted;
    }
  } catch (err: any) {
    console.warn(`Firestore coaching thread fetch notice for goal ${goalId}:`, err?.message || err);
  }
  try {
    const local = localStorage.getItem(`kova_coaching_${uid}_${goalId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return sortMessagesChronologically(parsed);
      }
    }
  } catch (e) {}
  return [];
}

export async function saveGoalCoachingThread(
  uid: string,
  goalId: string,
  messages: ChatMessage[]
): Promise<void> {
  const sorted = sortMessagesChronologically(messages);
  try {
    localStorage.setItem(`kova_coaching_${uid}_${goalId}`, JSON.stringify(sorted));
  } catch (e) {}
  const writePromise = (async () => {
    try {
      for (const msg of sorted) {
        const msgRef = doc(db, 'users', uid, 'goals', goalId, 'coachingThread', msg.id);
        await setDoc(msgRef, msg, { merge: true });
      }
    } catch (err: any) {
      reportSaveError('your coaching chat', err);
    }
  })();

  trackPendingWrite(writePromise);
  await writePromise;
}
