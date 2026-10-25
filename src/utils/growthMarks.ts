import { GrowthMark, SavingsGoal } from '../types';
import { isDebtGoal } from './goalKind';

/**
 * Goal milestones on the Grow screen (KOVA-075).
 * One place creates them, so each goal gets at most one 50% and one 100% mark, in the right order,
 * with debt wording for debt goals. Pure functions: src/utils/growthMarks.test.ts.
 */

export type MilestoneStep = 50 | 100;

export function milestoneId(goalId: string, step: MilestoneStep): string {
  return `gm-goal-${goalId}-${step}`;
}

/** Which milestone a mark is, from its id or (for marks saved before KOVA-075) its title. */
export function milestoneKey(mark: Pick<GrowthMark, 'id' | 'title'>): string | null {
  const t = (mark.title || '').trim();
  const patterns: Array<[RegExp, MilestoneStep]> = [
    [/^Achieved your goal: (.+?)!?$/i, 100],
    [/^Reached your (.+) goal$/i, 100],
    [/^Paid off (.+)$/i, 100],
    [/^Reached 50% of your (.+) goal$/i, 50],
    [/^Halfway through paying off (.+)$/i, 50],
    [/^Halfway to (.+)$/i, 50],
  ];
  for (const [re, step] of patterns) {
    const m = t.match(re);
    if (m) return `${step}:${m[1].trim().toLowerCase()}`;
  }
  return null;
}

export function milestoneMark(
  goal: Pick<SavingsGoal, 'id' | 'title' | 'kind' | 'targetAmount'>,
  step: MilestoneStep,
  date: string,
  formatAmount: (n: number) => string
): GrowthMark {
  const debt = isDebtGoal(goal);
  const target = formatAmount(goal.targetAmount);
  const words =
    step === 50
      ? debt
        ? { title: `Halfway through paying off ${goal.title}`, description: 'Every payment moved it down.' }
        : { title: `Halfway to ${goal.title}`, description: 'Small, steady entries added up.' }
      : debt
      ? { title: `Paid off ${goal.title}`, description: `${target} cleared.` }
      : { title: `Reached your ${goal.title} goal`, description: `Saved ${target}, one entry at a time.` };
  return { id: milestoneId(goal.id, step), date, ...words };
}

/**
 * Adds the milestones this goal has reached and doesn't have yet.
 * Marks are newest first; when a goal jumps past both at once, 100% goes above 50%.
 */
export function addGoalMilestones(
  marks: GrowthMark[],
  goal: Pick<SavingsGoal, 'id' | 'title' | 'kind' | 'targetAmount' | 'currentAmount'>,
  date: string,
  formatAmount: (n: number) => string
): { marks: GrowthMark[]; added: MilestoneStep[] } {
  if (!goal || !(goal.targetAmount > 0)) return { marks, added: [] };
  const pct = (goal.currentAmount / goal.targetAmount) * 100;
  const haveIds = new Set(marks.map((m) => m.id));
  const haveKeys = new Set(marks.map(milestoneKey).filter(Boolean));
  const titleKey = (step: MilestoneStep) => `${step}:${goal.title.trim().toLowerCase()}`;

  let next = marks;
  const added: MilestoneStep[] = [];
  for (const step of [50, 100] as MilestoneStep[]) {
    if (pct < step) continue;
    if (haveIds.has(milestoneId(goal.id, step)) || haveKeys.has(titleKey(step))) continue;
    next = [milestoneMark(goal, step, date, formatAmount), ...next];
    added.push(step);
  }
  return { marks: next, added };
}

/**
 * Cleans marks saved before KOVA-075: removes duplicate milestones (keeps the oldest) and puts a
 * goal's 100% mark above its 50% mark. Returns the same array when nothing changed.
 */
export function cleanGrowthMarks(marks: GrowthMark[]): GrowthMark[] {
  if (!Array.isArray(marks) || marks.length === 0) return marks;
  // Newest first, so walk from the end to keep the oldest copy of each.
  const seen = new Set<string>();
  const keptReversed: GrowthMark[] = [];
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    const key = milestoneKey(m) || `id:${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    keptReversed.push(m);
  }
  const kept = keptReversed.reverse();

  // A goal's 50% mark must not sit above its 100% mark.
  for (let i = 0; i < kept.length; i++) {
    const key = milestoneKey(kept[i]);
    if (!key?.startsWith('50:')) continue;
    const j = kept.findIndex((m, idx) => idx > i && milestoneKey(m) === `100:${key.slice(3)}`);
    if (j > i) [kept[i], kept[j]] = [kept[j], kept[i]];
  }

  const unchanged = kept.length === marks.length && kept.every((m, i) => m === marks[i]);
  return unchanged ? marks : kept;
}
