// Chat messages Kova answers on the phone without an AI call (KOVA-080). Tested in chatIntents.test.ts.
/** "Show all categories", "where did my money go", "spending by category"... (KOVA-080). Questions about one category stay with the AI. */
export function isCategoryBreakdownRequest(lower: string): boolean {
  const t = lower.replace(/[?.!]+$/g, '').trim();
  if (t.length > 80) return false;
  return (
    /\b(show|see|list|view|break ?down|what are)\b.*\b(all )?(my )?(spending )?categor(y|ies)\b/.test(t) ||
    /^(all |my )?(spending )?categor(y|ies)( breakdown)?$/.test(t) ||
    /\bspending (by|per) categor(y|ies)\b/.test(t) ||
    /\b(category|spending) breakdown\b/.test(t) ||
    /\bwhere (did|does|has) (all )?my money (go|gone)\b/.test(t) ||
    /\bwhere .*money went\b/.test(t)
  );
}
