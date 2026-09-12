// The review queue: what a missed question owes you, and when.
//
// Miss a question and it comes back in two days. Get it right and it moves
// up the ladder, each rung further away; miss it again and it drops back to
// the bottom. Clear the top rung and it retires. The ladder is short on
// purpose: there are only a few weeks before the test, and 2 + 5 + 11 + 21
// days is four more meetings with a question inside that window.
//
// Everything here is derived from the attempt log, so nothing extra is
// stored and the schedule can never drift out of step with the history.

const MS_PER_DAY = 86_400_000;

export const LADDER = [2, 5, 11, 21];

function midnight(time) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dueAfter(at, days) {
  const d = midnight(at);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

// Monday, as the week the weekend set closes.
export function weekStart(now = new Date()) {
  const d = midnight(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// {id -> {rung, due, misses, retired, lastAt}} for every question ever
// answered. A question that has never been missed is absent from the queue:
// rung -1, no due date.
export function reviewState(attempts) {
  const state = new Map();
  for (const attempt of attempts.slice().sort((a, b) => a.at - b.at)) {
    const entry = state.get(attempt.id) ?? { rung: -1, due: null, misses: 0, retired: false, lastAt: 0 };
    entry.lastAt = attempt.at;
    if (!attempt.correct) {
      entry.misses += 1;
      entry.rung = 0;
      entry.retired = false;
      entry.due = dueAfter(attempt.at, LADDER[0]);
    } else if (entry.rung >= 0 && !entry.retired) {
      entry.rung += 1;
      if (entry.rung >= LADDER.length) {
        entry.retired = true;
        entry.due = null;
      } else {
        entry.due = dueAfter(attempt.at, LADDER[entry.rung]);
      }
    }
    state.set(attempt.id, entry);
  }
  return state;
}

// Everything owed today or overdue, longest overdue first.
export function dueForReview(store, now = new Date()) {
  const today = midnight(now).getTime();
  return [...reviewState(store.attempts)]
    .filter(([, e]) => !e.retired && e.due !== null && e.due <= today)
    .sort((a, b) => a[1].due - b[1].due || b[1].misses - a[1].misses)
    .map(([id]) => id);
}

// Counts for the panel: due now, waiting, and put to bed.
export function reviewSummary(store, now = new Date()) {
  const today = midnight(now).getTime();
  let due = 0;
  let upcoming = 0;
  let retired = 0;
  let nextDue = null;
  for (const [, entry] of reviewState(store.attempts)) {
    if (entry.retired) {
      retired += 1;
    } else if (entry.due !== null && entry.due <= today) {
      due += 1;
    } else if (entry.due !== null) {
      upcoming += 1;
      if (nextDue === null || entry.due < nextDue) nextDue = entry.due;
    }
  }
  return { due, upcoming, retired, nextDue };
}

// The weekend set: everything missed since Monday that has not retired,
// worst first. It ignores the schedule on purpose. The point is to close
// the week having looked again at everything that went wrong in it.
export function weeklyReview(store, now = new Date()) {
  const state = reviewState(store.attempts);
  const from = weekStart(now).getTime();
  const missed = new Set(
    store.attempts.filter((a) => !a.correct && a.at >= from).map((a) => a.id)
  );
  return [...missed]
    .filter((id) => !state.get(id)?.retired)
    .sort((a, b) => (state.get(b)?.misses ?? 0) - (state.get(a)?.misses ?? 0));
}

// How many days until a question is next owed, for a human sentence.
export function daysUntilDue(entry, now = new Date()) {
  if (!entry || entry.retired || entry.due === null) return null;
  return Math.round((entry.due - midnight(now).getTime()) / MS_PER_DAY);
}
