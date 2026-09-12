// What to do today, and when the practice tests fall.
//
// The plan has three moving parts: the review queue, a daily quota of new
// questions, and a full practice test every second Saturday. Everything is
// derived from the attempt log and the calendar, so the box on the dashboard
// is never out of step with what has actually been done.

import { mulberry32, shuffle, skillSummary } from "./bank.js?v=dcf29171";
import { missedSkills } from "./bluebook.js?v=dcf29171";
import { dueForReview, weeklyReview } from "./review.js?v=dcf29171";
import { COVERAGE_WEEKS, dayKey, daysBetween, TEST_DATE } from "./stats.js?v=dcf29171";

// An hour on a school day, three at the weekend, at roughly 1.4 minutes a
// question. These are the numbers the whole plan was built around.
export const WEEKDAY_TARGET = 43;
export const WEEKEND_TARGET = 130;
const MINUTES_NEW = 1.4;
const MINUTES_REVIEW = 1.0;

// The four official Bluebook practice tests, on named Saturdays rather than
// computed backwards from test day. They were every second Saturday counting
// back from 7 November — 12 and 26 September, 10 and 24 October — until the
// first one could not be sat, and a date that has to move is a date that has
// to be written down. The rhythm is still a fortnight; the whole ladder simply
// shifted a week, which puts the last rehearsal seven days out instead of
// fourteen. Moving one again is one line.
export const PRACTICE_TEST_DATES = [
  new Date(2026, 8, 19),  // Saturday 19 September
  new Date(2026, 9, 3),   // Saturday 3 October
  new Date(2026, 9, 17),  // Saturday 17 October
  new Date(2026, 9, 31),  // Saturday 31 October
];
export const PRACTICE_TESTS = PRACTICE_TEST_DATES.length;
// Bluebook's own scale: each section 200 to 800 in steps of ten.
export const SECTION_MIN = 200;
export const SECTION_MAX = 800;

// One full test: two modules a section, the second harder, as on the day.
export const MODULES = [
  { section: "rw", label: "Reading and Writing · Module 1", count: 27, minutes: 32, mix: { Easy: 0.3, Medium: 0.4, Hard: 0.3 } },
  { section: "rw", label: "Reading and Writing · Module 2", count: 27, minutes: 32, mix: { Easy: 0.1, Medium: 0.35, Hard: 0.55 } },
  { section: "math", label: "Math · Module 1", count: 22, minutes: 35, mix: { Easy: 0.3, Medium: 0.4, Hard: 0.3 } },
  { section: "math", label: "Math · Module 2", count: 22, minutes: 35, mix: { Easy: 0.1, Medium: 0.35, Hard: 0.55 } },
];

export const TEST_QUESTIONS = MODULES.reduce((sum, m) => sum + m.count, 0);
export const TEST_MINUTES = MODULES.reduce((sum, m) => sum + m.minutes, 0);

function midnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// The practice test dates, earliest first. Copies, so nothing downstream can
// nudge the schedule by mutating a Date it was handed.
export function practiceTestDates() {
  return PRACTICE_TEST_DATES.map(midnight);
}

// {date, number} of the next practice test on or after today, or null once
// they are all behind you.
export function nextPracticeTest(now = new Date()) {
  const today = midnight(now).getTime();
  const dates = practiceTestDates();
  const index = dates.findIndex((d) => d.getTime() >= today);
  return index === -1 ? null : { date: dates[index], number: index + 1, isToday: dates[index].getTime() === today };
}

export function isPracticeTestDay(now = new Date()) {
  return Boolean(nextPracticeTest(now)?.isToday);
}

const isWeekend = (now) => [0, 6].includes(new Date(now).getDay());

export function dailyTarget(now = new Date()) {
  return isWeekend(planDate(now)) ? WEEKEND_TARGET : WEEKDAY_TARGET;
}

// Rounded to five minutes, because nobody plans an afternoon in ones, and
// never zero: a two-question review is still worth sitting down for.
// A weekend day is worth three weekdays: one hour on a school day, three at
// the weekend. Every pacing number below is shared out by this weight.
export const WEEKEND_WEIGHT = 3;
// Guard rails, so a run of missed days cannot produce a day nobody could sit.
const MOST_IN_A_DAY = { weekday: WEEKDAY_TARGET * 2, weekend: WEEKEND_TARGET * 2 };
const LEAST_IN_A_DAY = 10;

function addDays(date, days) {
  const d = midnight(date);
  d.setDate(d.getDate() + days);
  return d;
}

// The whole bank is meant to be seen by this date, leaving the last days for
// review alone. Counted from the plan's first day, not from your first attempt,
// so the deadline does not move when you start.
export function coverageEnd() {
  return addDays(ROTA_EPOCH, COVERAGE_WEEKS * 7);
}

// The days still available for new ground between now and that deadline,
// weighted. Practice test days are left out: a test is not new ground.
// A day taken off carries no weight, exactly as a test day does not — so the
// questions it would have asked for are shared out over the days that remain
// rather than silently dropped.
const restOf = (store) => (date) => Boolean(store?.isRestDay?.(date));

export function weightedDaysLeft(now = new Date(), isRest = () => false) {
  let weight = 0;
  for (let day = midnight(planDate(now)); day < coverageEnd(); day = addDays(day, 1)) {
    if (isPracticeTestDay(day)) continue;
    if (isRest(day)) continue;
    weight += isWeekend(day) ? WEEKEND_WEIGHT : 1;
  }
  return weight;
}

// The rate: how many questions each unit of weight has to carry to see the
// rest of the bank by the deadline. Practice test days carry none of it: the
// tests are the official ones in the Bluebook app, a different set of
// questions altogether, and a day that holds one has no room left for the
// bank. Do more one day and every later day gets lighter; miss a day and the
// rest pick it up.
export function pace(store, bank, now = new Date()) {
  const unseen = bank.all.length - store.seen().size;
  if (unseen <= 0) return 0;
  const weight = weightedDaysLeft(now, restOf(store));
  if (weight <= 0) return 0;
  return Math.max(1, Math.ceil(unseen / weight));
}

// The target on a given day at a given rate, kept inside the guard rails.
export function targetOn(date, perWeight) {
  if (perWeight <= 0) return 0;
  const weekend = isWeekend(date);
  const most = weekend ? MOST_IN_A_DAY.weekend : MOST_IN_A_DAY.weekday;
  return Math.max(LEAST_IN_A_DAY, Math.min(perWeight * (weekend ? WEEKEND_WEIGHT : 1), most));
}

// What today asks for.
export function adaptiveTarget(store, bank, now = new Date()) {
  return targetOn(planDate(now), pace(store, bank, now));
}

// What a day on the calendar asks for. A past day shows the plan as it stood,
// since what it asked then is what it should be judged by; today and every
// day after show today's rate carried forward, which is what will happen if
// the plan is followed from here.
export function projectedTarget(store, bank, date, now = new Date()) {
  if (store?.isRestDay?.(date)) return 0;
  if (midnight(date) < midnight(planDate(now))) return dailyTarget(date);
  return targetOn(date, pace(store, bank, now));
}

function minutes(count, each) {
  return Math.max(5, Math.round((count * each) / 5) * 5);
}

// The skill the official test showed weakest in this section, if any, so the
// day's note can say what it is starting with and why.
function steer(section) {
  return missedSkills().map((m) => m.skill).find((skill) => sectionOfSkill(skill) === section) ?? null;
}

// Today's list, in the order it should be done: what is owed first, then new
// ground, then the weekend's own work.
export function dailyPlan(store, bank, now = new Date()) {
  const today = dayKey(now);
  const todays = store.attempts.filter((a) => dayKey(a.at) === today);
  const firstAttempt = new Map();
  for (const attempt of store.attempts) {
    if (!firstAttempt.has(attempt.id)) firstAttempt.set(attempt.id, attempt.at);
  }
  const newDone = todays.filter((a) => a.mode !== "review" && firstAttempt.get(a.id) === a.at).length;
  const reviewsDone = todays.filter((a) => a.mode === "review").length;

  const due = dueForReview(store, now);
  const weekly = weeklyReview(store, now);
  const testDay = isPracticeTestDay(now);
  const restDay = Boolean(store.isRestDay?.(now)) && !testDay;
  const early = notStartedYet(now);
  const next = nextPracticeTest(now);
  const items = [];

  if (due.length || reviewsDone) {
    items.push({
      key: "review",
      label: due.length ? `Review ${due.length} due` : `Reviewed ${reviewsDone}`,
      note: due.length ? "questions you got wrong, come back around" : "review queue clear",
      count: due.length,
      // What the day asked for and what has gone in, so a dial can show the
      // day filling up rather than only whether it is finished.
      target: due.length + reviewsDone,
      finished: reviewsDone,
      minutes: due.length ? minutes(due.length, MINUTES_REVIEW) : 0,
      done: due.length === 0,
    });
  }

  if (restDay) {
    // A day off still owes its reviews — the schedule is the whole point of
    // them — but asks for nothing new, and says so rather than showing a
    // quota of zero, which reads like a bug.
    items.push({
      key: "rest",
      label: "Day off",
      note: "no new questions today · the rest of the plan has taken them on",
      count: 0,
      target: 1,
      finished: 1,
      minutes: 0,
      done: true,
    });
  } else if (testDay) {
    const logged = (store.scores?.() ?? []).find((row) => row.test === next.number);
    items.push({
      key: "test",
      label: `Bluebook Practice Test ${next.number}`,
      note: logged
        ? `scored ${logged.total} · Reading and Writing ${logged.rw}, Math ${logged.math}`
        : `in the Bluebook app, ${Math.floor(TEST_MINUTES / 60)}h ${TEST_MINUTES % 60}m, then log the score here`,
      count: TEST_QUESTIONS,
      target: 1,
      finished: logged ? 1 : 0,
      minutes: TEST_MINUTES,
      done: Boolean(logged),
    });
  } else {
    const target = adaptiveTarget(store, bank, now);
    const remaining = Math.max(0, target - newDone);
    const section = sectionForDay(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    items.push({
      key: "new",
      section,
      label: `${remaining || newDone} new ${sectionName(section)} question${(remaining || newDone) === 1 ? "" : "s"}`,
      note: remaining
        ? early
          ? `Day 1 is tomorrow. This is its work, if you would rather begin now.`
          : steer(section)
            ? `${sectionName(section)} day · starting with ${steer(section)}, which the Bluebook test showed you missing`
            : `${sectionName(section)} day · ${sectionName(sectionForDay(tomorrow))} tomorrow`
        : "today's quota is done",
      count: remaining,
      target: Math.max(target, newDone),
      finished: newDone,
      minutes: remaining ? minutes(remaining, MINUTES_NEW) : 0,
      done: remaining === 0,
    });
    if (isWeekend(now) && weekly.length) {
      items.push({
        key: "weekly",
        label: `Weekly review · ${weekly.length}`,
        note: "everything you missed this week, in one set",
        count: weekly.length,
        target: weekly.length,
        finished: 0,
        minutes: minutes(weekly.length, MINUTES_REVIEW),
        done: false,
      });
    }
  }

  const left = items.filter((item) => !item.done);
  return {
    items,
    testDay,
    early,
    nextTest: next,
    minutesLeft: left.reduce((sum, item) => sum + item.minutes, 0),
    done: left.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Building a day's set.
// ---------------------------------------------------------------------------

export const SECTION_NAMES = { rw: "Reading and Writing", math: "Math" };
// Which section each official skill belongs to, for steering by a report.
const RW_SKILLS = ["Boundaries", "Central Ideas and Details", "Command of Evidence", "Cross-Text Connections", "Form, Structure, and Sense", "Inferences", "Rhetorical Synthesis", "Text Structure and Purpose", "Transitions", "Words in Context"];
const SKILL_SECTION = new Map(RW_SKILLS.map((skill) => [skill, "rw"]));
export function sectionOfSkill(skill) {
  return SKILL_SECTION.get(skill) ?? "math";
}
export const sectionName = (section) => SECTION_NAMES[section];

// The first day of the plan, and the day the rota is measured from. Fixing it
// to a date rather than to your first attempt means every date has one answer
// that never changes: today is a Math day whether or not you opened the app
// yesterday, and tomorrow can be named today.
export const ROTA_EPOCH = new Date(2026, 8, 9); // Wednesday 9 September 2026, day one of the plan

// One section a day, swapping every day: Math, then Reading and Writing, then
// Math again. A whole session in one section is long enough to settle into how
// that section thinks, and the day in between is the gap that makes the last
// one stick.
//
// Day one is Math because Math is the larger half of the bank, 1,925 questions
// against 1,845. A week is seven days and the rota is two, so the long weekend
// days fall to a different section each week and neither section ends up with
// all the big sittings.
// Before the plan begins, everything shows day one. Starting early is a good
// thing, and it should be the same work as tomorrow rather than some other
// rota that happens to fall on today.
export function planDate(now = new Date()) {
  return midnight(now) < ROTA_EPOCH ? new Date(ROTA_EPOCH) : new Date(now);
}

export function notStartedYet(now = new Date()) {
  return midnight(now) < ROTA_EPOCH;
}

export function sectionForDay(now = new Date()) {
  const elapsed = daysBetween(ROTA_EPOCH, planDate(now));
  // Dates before the epoch would give a negative remainder in JavaScript.
  return ((elapsed % 2) + 2) % 2 === 0 ? "math" : "rw";
}

// The questions a section owes, heaviest skill first: the largest untouched
// skills are met earliest so they get the most repeats before test day.
function takeFromSection(bank, seen, section, count, random) {
  const chosen = [];
  const taken = new Set();
  const add = (questions) => {
    for (const question of questions) {
      if (chosen.length >= count || taken.has(question.id)) continue;
      taken.add(question.id);
      chosen.push(question);
    }
  };
  // A skill the official test showed you missing comes before a skill that
  // is merely large. Ties, and everything else, still go by what is unseen.
  const missed = new Map(missedSkills().map((m) => [m.skill, m.misses]));
  const skills = skillSummary(bank)
    .filter((row) => row.section === section)
    .map((row) => ({ row, unseen: bank.bySkill.get(row.key).filter((q) => !seen.has(q.id)), missed: missed.get(row.skill) ?? 0 }))
    .filter((entry) => entry.unseen.length)
    .sort((a, b) => b.missed - a.missed || b.unseen.length - a.unseen.length);
  // Two skills a day: enough that a session is not forty of one thing, few
  // enough that it still eats real ground in one of them.
  const leading = skills.slice(0, 2);
  const share = Math.ceil(count / Math.max(1, leading.length));
  for (const entry of leading) add(shuffle(entry.unseen, random).slice(0, share));
  if (chosen.length < count) {
    for (const entry of skills) add(shuffle(entry.unseen, random));
  }
  return chosen;
}

// A day's work: today's section, from the skills that owe it the most. Once a
// section has nothing unseen left the day borrows from the other rather than
// coming up short, and once nothing at all is unseen it goes round again.
export function buildDailySet(bank, store, { count = null, now = new Date(), seed = null } = {}) {
  const total = count ?? adaptiveTarget(store, bank, now);
  const random = seed === null ? Math.random : mulberry32(seed);
  const seen = store.seen();
  const today = sectionForDay(now);
  const other = today === "math" ? "rw" : "math";
  const chosen = takeFromSection(bank, seen, today, total, random);
  if (chosen.length < total) {
    chosen.push(...takeFromSection(bank, seen, other, total - chosen.length, random));
  }
  if (chosen.length < total) {
    const taken = new Set(chosen.map((q) => q.id));
    chosen.push(...shuffle(bank.all.filter((q) => !taken.has(q.id)), random).slice(0, total - chosen.length));
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Building a practice test.
// ---------------------------------------------------------------------------

function seedFrom(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Split `count` across the difficulty mix so the parts add up exactly:
// whole numbers first, then the leftovers go to the largest fractions.
function allocate(count, mix) {
  const parts = Object.entries(mix).map(([level, share]) => {
    const exact = count * share;
    return { level, whole: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let left = count - parts.reduce((sum, part) => sum + part.whole, 0);
  for (const part of [...parts].sort((a, b) => b.fraction - a.fraction)) {
    if (left <= 0) break;
    part.whole += 1;
    left -= 1;
  }
  return parts.map((part) => [part.level, part.whole]);
}

function takeMix(pool, count, mix, random, used) {
  const chosen = [];
  const wanted = allocate(count, mix);
  for (const [level, want] of wanted) {
    const candidates = shuffle(pool.filter((q) => q.difficulty === level && !used.has(q.id)), random);
    for (const question of candidates.slice(0, want)) {
      used.add(question.id);
      chosen.push(question);
    }
  }
  // Rounding, or a thin pool, can leave the module short. Fill from whatever
  // is left rather than handing back a module with holes in it.
  if (chosen.length < count) {
    const rest = shuffle(pool.filter((q) => !used.has(q.id)), random);
    for (const question of rest.slice(0, count - chosen.length)) {
      used.add(question.id);
      chosen.push(question);
    }
  }
  return shuffle(chosen, random);
}

// A full-length test in the real order: both Reading and Writing modules,
// then both Math. Seeded by the date, so the same test rebuilds question for
// question if it is left and picked up again.
export function buildPracticeTest(bank, { date = new Date(), prefer = new Set() } = {}) {
  const random = mulberry32(seedFrom(dayKey(date)));
  const used = new Set();
  const questions = [];
  for (const module of MODULES) {
    const all = bank.all.filter((q) => q.section === module.section);
    const unseen = all.filter((q) => !prefer.has(q.id));
    const pool = unseen.length >= module.count * 2 ? unseen : all;
    questions.push(...takeMix(pool, module.count, module.mix, random, used));
  }
  return questions;
}
