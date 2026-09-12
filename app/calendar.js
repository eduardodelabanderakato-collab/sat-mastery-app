// The plan as a calendar: every day from the first to the test, what it asks
// of you, and what you actually did on it.
//
// Nothing here is stored. The rota, the targets and the practice test dates
// are all decided by the calendar, and what was done comes from the attempt
// log, so the plan can never drift out of step with either.

import { dayKey, daysBetween, TEST_DATE } from "./stats.js?v=dcf29171";
import {
  ROTA_EPOCH,
  TEST_QUESTIONS,
  planDate,
  practiceTestDates,
  projectedTarget,
  sectionForDay,
  sectionName,
} from "./plan.js?v=dcf29171";

const MS_PER_DAY = 86_400_000;

function midnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = midnight(date);
  d.setDate(d.getDate() + days);
  return d;
}

// The Monday on or before a date.
function monday(date) {
  const d = midnight(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// How many questions were answered on each day, and how many of those were
// first meetings rather than reviews.
function workByDay(store) {
  const counts = new Map();
  const firstAttempt = new Map();
  for (const attempt of store.attempts) {
    if (!firstAttempt.has(attempt.id)) firstAttempt.set(attempt.id, attempt.at);
  }
  for (const attempt of store.attempts) {
    const key = dayKey(attempt.at);
    const entry = counts.get(key) ?? { total: 0, fresh: 0, correct: 0, test: 0 };
    entry.total += 1;
    if (attempt.correct) entry.correct += 1;
    if (attempt.mode === "test") entry.test += 1;
    if (attempt.mode !== "review" && firstAttempt.get(attempt.id) === attempt.at) entry.fresh += 1;
    counts.set(key, entry);
  }
  return counts;
}

// Every day of the plan, grouped into weeks that run Monday to Sunday. Days
// before the start or after the test are present but marked outside, so the
// grid stays rectangular without pretending they are practice days.
export function planCalendar(store, bank, now = new Date()) {
  const today = midnight(now);
  const start = midnight(ROTA_EPOCH);
  const end = midnight(TEST_DATE);
  const tests = practiceTestDates().map((date) => date.getTime());
  const work = workByDay(store);
  const scores = new Map((store.scores?.() ?? []).map((row) => [row.test, row]));

  const weeks = [];
  for (let cursor = monday(start); cursor <= addDays(end, 6 - ((end.getDay() + 6) % 7)); cursor = addDays(cursor, 7)) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      const time = date.getTime();
      const outside = time < start.getTime() || time > end.getTime();
      const testIndex = tests.indexOf(time);
      const isTestDay = time === end.getTime();
      const done = work.get(dayKey(date)) ?? { total: 0, fresh: 0, correct: 0, test: 0 };
      const section = sectionForDay(date);
      // A day taken off deliberately. It is not a test day and not an empty
      // day: it asks for nothing, and the calendar should say which of those
      // it is rather than show a quota of zero.
      const rest = Boolean(store.isRestDay?.(date)) && !outside && !isTestDay && testIndex < 0;
      const target = outside || isTestDay ? 0 : testIndex >= 0 ? TEST_QUESTIONS : projectedTarget(store, bank, date, now);
      days.push({
        date,
        key: dayKey(date),
        outside,
        isToday: time === today.getTime(),
        isPast: time < today.getTime(),
        dayOfMonth: date.getDate(),
        firstOfMonth: date.getDate() === 1,
        month: date.toLocaleDateString("en-US", { month: "short" }),
        rest,
        // A practice test covers both sections, and a day off has none at all,
        // so the rota does not apply to either.
        section: outside || isTestDay || testIndex >= 0 || rest ? null : section,
        sectionLabel: outside || isTestDay || testIndex >= 0 || rest ? null : sectionName(section),
        practiceTest: testIndex >= 0 ? testIndex + 1 : null,
        score: testIndex >= 0 ? scores.get(testIndex + 1) ?? null : null,
        isTestDay,
        target,
        done: done.total,
        fresh: done.fresh,
        correct: done.correct,
        // Met means the day's own work was finished, so a review-only day
        // where the quota was untouched does not quietly count as done.
        // A test day is met when its Bluebook score is logged; any other day
        // when its own new questions are done, so a review-only day does not
        // quietly count.
        met: !outside && target > 0 && (testIndex >= 0 ? scores.has(testIndex + 1) : done.fresh >= target),
      });
    }
    weeks.push(days);
  }
  return weeks;
}

// The current week alone, Monday to Sunday, for the dashboard. Before the
// plan begins it is the plan's first week, so the eve of day one already shows
// the week ahead rather than a week of nothing.
export function weekPlan(store, bank, now = new Date()) {
  const anchor = planDate(now);
  const weeks = planCalendar(store, bank, now);
  const key = dayKey(anchor);
  // Before the plan the anchor is day one, so the first week; after the exam
  // nothing matches, and the last week is the honest thing to show.
  const week = weeks.find((days) => days.some((day) => day.key === key)) ?? weeks[weeks.length - 1];
  const planned = week.filter((day) => !day.outside);
  return {
    days: week,
    planned: planned.reduce((sum, day) => sum + day.target, 0),
    done: planned.reduce((sum, day) => sum + day.done, 0),
    met: planned.filter((day) => day.met).length,
  };
}

// The headline numbers under the calendar.
export function planTotals(weeks, now = new Date()) {
  const days = weeks.flat().filter((day) => !day.outside);
  const past = days.filter((day) => day.isPast);
  return {
    daysInPlan: days.length,
    daysLeft: days.filter((day) => !day.isPast).length,
    daysMet: past.filter((day) => day.met).length,
    daysMissed: past.filter((day) => !day.met && day.done === 0).length,
    questionsPlanned: days.reduce((sum, day) => sum + day.target, 0),
    questionsDone: days.reduce((sum, day) => sum + day.done, 0),
    mathDays: days.filter((day) => day.section === "math").length,
    readingDays: days.filter((day) => day.section === "rw").length,
    tests: days.filter((day) => day.practiceTest).length,
    daysToTest: Math.max(0, daysBetween(now, TEST_DATE)),
  };
}
