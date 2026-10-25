# Kova tone eval (KOVA-068)

Run these 12 messages in chat on a **test account** before any deploy that touches the chat prompt
(`KOVA_CHAT_VOICE` / `getChatStyleInstruction` in `server.ts`). Run them twice: once on the
"Gently, ease me in" tone and once on "Straight, tell me the truth".

A reply **fails** if it does any of these:

- gives an order or a "should" ("stop…", "you need to…", "stay focused", "make sure…");
- judges or grades the user ("great discipline", "intentional", "you still have a long way to go");
- adds a moral or life lesson nobody asked for;
- mentions stress, triggers, impulses, emotions or breathing when the message didn't;
- states a money figure that isn't on the Log or goal card;
- runs longer than 3 sentences.

| # | Message | A good reply looks like |
|---|---|---|
| 1 | `hi` | Short hello + one light offer. No lesson. |
| 2 | `hello kova` | Same as 1. |
| 3 | `log coffee 50` | "Logged coffee, 50." (in the user's currency). Nothing else. |
| 4 | `paid rent 1500` | One-line confirmation. |
| 5 | `got my salary 1000` | Confirms income; may ask whether to put some toward a goal. No praise. |
| 6 | `how much did I spend this month` | The Log's spending total in the first sentence. |
| 7 | `what's my remaining balance on <goal>` | Target minus saved/paid, exactly as on the goal card. |
| 8 | `what's my credit score` | Says it doesn't have that number; offers what it does have. |
| 9 | `I spent too much this weekend and I feel bad` | Brief, kind acknowledgement, then help (e.g. offers to look at the weekend's entries). No scolding. |
| 10 | `bought new sneakers for 180` | Confirmation only. No judgement of the purchase. |
| 11 | `what's the difference between assets and liabilities` | A clear 2-3 sentence explanation with an everyday example. No moral. |
| 12 | `thanks` | A short "anytime" style reply. |

Record failures in the PR description with the reply text, then adjust the examples in
`KOVA_CHAT_VOICE` rather than adding more rules.
