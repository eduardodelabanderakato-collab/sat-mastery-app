// Derived numbers for Mission Control. Pure: attempts in, figures out.

import { skillKey, skillSummary } from "./bank.js?v=dcf29171";

export const TEST_DATE = new Date(2026, 10, 7); // Saturday 7 November 2026
// Full coverage is planned across eight working weeks; week nine is review.
export const COVERAGE_WEEKS = 8;
const MS_PER_DAY = 86_400_000;

export function dayKey(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function midnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(from, to) {
  return Math.round((midnight(to) - midnight(from)) / MS_PER_DAY);
}

export function daysUntil(target, now = new Date()) {
  return Math.max(0, daysBetween(now, target));
}

// Day 1 is the day of the first recorded attempt. With no attempts yet, it
// is today, so a fresh install always reads "Day 1".
export function planStart(store, now = new Date()) {
  const first = store.attempts.length ? Math.min(...store.attempts.map((a) => a.at)) : now.getTime();
  return midnight(first);
}

export function dayNumber(store, now = new Date()) {
  return Math.max(1, daysBetween(planStart(store, now), now) + 1);
}

// Full coverage is due COVERAGE_WEEKS after day 1.
export function coverageDeadline(store, now = new Date()) {
  const d = planStart(store, now);
  d.setDate(d.getDate() + COVERAGE_WEEKS * 7);
  return d;
}

// The consistency grid's first column is the Monday on or before day 1.
export function gridOrigin(store, now = new Date()) {
  const d = planStart(store, now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function coverage(store, bank) {
  const seen = store.seen();
  const bySection = { rw: { seen: 0, total: 0 }, math: { seen: 0, total: 0 } };
  for (const question of bank.all) {
    bySection[question.section].total += 1;
    if (seen.has(question.id)) bySection[question.section].seen += 1;
  }
  const total = bank.all.length;
  const seenCount = bySection.rw.seen + bySection.math.seen;
  return { seen: seenCount, total, percent: total ? Math.round((100 * seenCount) / total) : 0, bySection };
}

export function masteryBySkill(store, bank) {
  const seen = store.seen();
  const stats = new Map();
  for (const attempt of store.attempts) {
    const question = bank.byId.get(attempt.id);
    if (!question) continue;
    const key = skillKey(question);
    const entry = stats.get(key) ?? { attempts: 0, correct: 0 };
    entry.attempts += 1;
    if (attempt.correct) entry.correct += 1;
    stats.set(key, entry);
  }
  return skillSummary(bank).map((summary) => {
    const entry = stats.get(summary.key) ?? { attempts: 0, correct: 0 };
    const seenCount = bank.bySkill.get(summary.key).filter((q) => seen.has(q.id)).length;
    return {
      ...summary,
      seen: seenCount,
      attempts: entry.attempts,
      correct: entry.correct,
      accuracy: entry.attempts ? Math.round((100 * entry.correct) / entry.attempts) : null,
    };
  });
}

export function accuracyByDifficulty(store, bank) {
  const out = {
    Easy: { attempts: 0, correct: 0 },
    Medium: { attempts: 0, correct: 0 },
    Hard: { attempts: 0, correct: 0 },
  };
  for (const attempt of store.attempts) {
    const question = bank.byId.get(attempt.id);
    if (!question) continue;
    out[question.difficulty].attempts += 1;
    if (attempt.correct) out[question.difficulty].correct += 1;
  }
  return out;
}

export function dailyCounts(store) {
  const counts = new Map();
  for (const attempt of store.attempts) {
    const key = dayKey(attempt.at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function streak(store, now = new Date()) {
  const days = new Set(store.attempts.map((a) => dayKey(a.at)));
  const cursor = midnight(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let run = 0;
  while (days.has(dayKey(cursor))) {
    run += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return run;
}

// Questions whose most recent attempt was wrong. Until the Leitner queue
// exists this is the review pile: what is owed.
export function missedOpen(store) {
  const latest = new Map();
  for (const attempt of store.attempts) latest.set(attempt.id, attempt.correct);
  return [...latest].filter(([, correct]) => !correct).map(([id]) => id);
}

export function paceSeries(store, bank, now = new Date()) {
  const total = bank.all.length;
  const planned = Array.from({ length: COVERAGE_WEEKS + 1 }, (_, w) =>
    Math.round((total * w) / COVERAGE_WEEKS)
  );
  const firstSeen = new Map();
  for (const attempt of store.attempts) {
    if (!firstSeen.has(attempt.id)) firstSeen.set(attempt.id, attempt.at);
  }
  const start = planStart(store, now);
  const elapsedDays = Math.max(0, daysBetween(start, now));
  const currentWeek = Math.min(COVERAGE_WEEKS, Math.floor(elapsedDays / 7));
  const seenBefore = (time) => [...firstSeen.values()].filter((t) => t < time).length;
  const actual = planned.map((_, w) => {
    if (w === 0) return 0;
    if (w <= currentWeek) {
      const cutoff = new Date(start);
      cutoff.setDate(cutoff.getDate() + w * 7);
      return seenBefore(cutoff.getTime());
    }
    if (w === currentWeek + 1) return seenBefore(now.getTime() + 1);
    return null;
  });
  return { planned, actual, currentWeek };
}

// Heaviest unseen skill first: the spec schedules the largest skills
// earliest so they get the most repeated exposure.
export function recommendSkill(store, bank) {
  const rows = masteryBySkill(store, bank);
  return rows
    .slice()
    .sort((a, b) => (b.total - b.seen) - (a.total - a.seen) || (a.accuracy ?? 101) - (b.accuracy ?? 101))[0];
}
