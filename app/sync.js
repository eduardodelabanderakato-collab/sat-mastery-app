// Writing progress out to a file, so it exists somewhere other than this
// browser's local storage and can be read and talked about later.
//
// The local server accepts a POST at /progress and writes data/progress.json.
// When the app is opened straight off the disk there is no server to talk to;
// the post fails, nothing breaks, and local storage is still the record.

import { skillKey } from "./bank.js?v=dcf29171";
import { reviewState, daysUntilDue, reviewSummary } from "./review.js?v=dcf29171";
import { coverage, dayNumber, daysUntil, masteryBySkill, TEST_DATE } from "./stats.js?v=dcf29171";

const ENDPOINT = "progress";
// Long enough that a run of quick answers is one write, short enough that
// closing the tab straight after a set still catches it.
const DEBOUNCE_MS = 1500;
// Everything worth knowing about where this person stands, in one object.
// The misses carry their id, skill, what was answered and what was right, but
// never the question's own words: this file is backed up to the repository,
// and the bank stays on this machine. Any id can be looked up locally.
export function progressPayload(store, bank, now = new Date()) {
  const attempts = store.attempts;
  const state = reviewState(attempts);
  const cov = coverage(store, bank);
  const correct = attempts.filter((a) => a.correct).length;
  const latest = new Map();
  for (const attempt of attempts) latest.set(attempt.id, attempt);

  const misses = [...state]
    .filter(([, entry]) => entry.misses > 0 && !entry.retired)
    .map(([id, entry]) => {
      const question = bank.byId.get(id);
      const last = latest.get(id);
      return {
        id,
        section: question?.section ?? null,
        skill: question?.skill ?? null,
        difficulty: question?.difficulty ?? null,
        youAnswered: last?.response ?? null,
        correctAnswer: question?.correct ?? null,
        lastWasCorrect: Boolean(last?.correct),
        timesMissed: entry.misses,
        dueInDays: daysUntilDue(entry, now),
        lastSeen: new Date(entry.lastAt).toISOString(),
      };
    })
    .sort((a, b) => b.timesMissed - a.timesMissed || String(a.skill).localeCompare(String(b.skill)));

  return {
    savedAt: new Date(now).toISOString(),
    day: dayNumber(store, now),
    daysToTest: daysUntil(TEST_DATE, now),
    totals: {
      questionsSeen: cov.seen,
      questionsTotal: cov.total,
      attempts: attempts.length,
      correct,
      accuracy: attempts.length ? Math.round((100 * correct) / attempts.length) : null,
    },
    review: reviewSummary(store, now),
    bluebookScores: (store.scores?.() ?? []).map((row) => ({
      test: row.test,
      date: new Date(row.at).toISOString().slice(0, 10),
      readingWriting: row.rw,
      math: row.math,
      total: row.total,
      note: row.note || undefined,
    })),
    weakestSkills: masteryBySkill(store, bank)
      .filter((s) => s.attempts >= 5)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8)
      .map((s) => ({ skill: s.skill, section: s.section, accuracy: s.accuracy, attempts: s.attempts, seen: s.seen, total: s.total })),
    openMisses: misses,
    // The browser's own store, verbatim. Everything above is derived from it
    // and is there to be read; this is what puts another device back exactly
    // where this one is.
    record: store.snapshot ? store.snapshot() : { attempts },
    attempts: attempts.map((a) => {
      const question = bank.byId.get(a.id);
      return {
        at: new Date(a.at).toISOString(),
        id: a.id,
        correct: a.correct,
        mode: a.mode,
        seconds: Math.round(a.ms / 1000),
        response: a.response,
        skill: question?.skill ?? null,
        difficulty: question?.difficulty ?? null,
      };
    }),
  };
}

// Which of two records is further along. More answers wins; a tie is broken by
// which was written last. Used when the repository and this browser disagree —
// on a second device, or after the same account has been open in two places.
export function rank(payload) {
  const attempts = payload?.record?.attempts?.length ?? payload?.attempts?.length ?? 0;
  const at = Date.parse(payload?.savedAt ?? "") || 0;
  return [attempts, at];
}

export function ahead(a, b) {
  const [ca, ta] = rank(a);
  const [cb, tb] = rank(b);
  return ca !== cb ? ca > cb : ta > tb;
}

// The repository is the record; a browser is a copy of it. When the copy is
// behind — a new device, a cleared browser, a set finished on the laptop — take
// the repository's version before anything is drawn. When it is not behind,
// change nothing: a reset must never be undone by the file it just replaced.
export async function adoptRemote(store, bank, read, now = new Date()) {
  const there = await read();
  if (!there?.record) return false;
  if (!ahead(there, progressPayload(store, bank, now))) return false;
  return store.restore(there.record);
}

export function commitMessage(payload) {
  const t = payload.totals;
  const parts = [`day ${payload.day}`];
  parts.push(t.attempts ? `${t.questionsSeen} of ${t.questionsTotal} seen, ${t.accuracy}% right` : "nothing done, starting from zero");
  if (payload.review?.due) parts.push(`${payload.review.due} due for review`);
  const best = payload.bluebookScores?.reduce((max, row) => Math.max(max, row.total), 0);
  if (best) parts.push(`best Bluebook ${best}`);
  return `progress: ${parts.join(", ")}`;
}

// The local server takes a POST and writes data/progress.json to the disk.
// Opened straight off the disk there is no server; the post fails, nothing
// breaks, and local storage is still the record.
export function postTransport(fetchImpl = globalThis.fetch) {
  return async function post(payload) {
    await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 1),
    });
  };
}

// Returns a function to call whenever something changed. Writes are
// debounced and never throw: a failed save must not interrupt practice.
export function createSync(store, bank, { fetchImpl = globalThis.fetch, now = () => new Date(), transport = null } = {}) {
  const send = transport ?? postTransport(fetchImpl);
  let timer = null;
  let inFlight = false;
  let again = false;

  async function write() {
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    try {
      await send(progressPayload(store, bank, now()));
    } catch {
      // The write did not land. Local storage is still the record, and the
      // next answer tries again.
    } finally {
      inFlight = false;
      if (again) {
        again = false;
        write();
      }
    }
  }

  return function sync({ immediate = false } = {}) {
    clearTimeout(timer);
    if (immediate) return write();
    timer = setTimeout(write, DEBOUNCE_MS);
  };
}
