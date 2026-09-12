// Progress in one localStorage key. Everything derived is computed on demand
// from the attempt log, so the stored shape stays tiny and never goes stale.

import { skillKey } from "./bank.js?v=dcf29171";
import { reportScores } from "./bluebook.js?v=dcf29171";

export const STORAGE_KEY = "sat-mastery.v1";
// A set in progress. Kept apart from the attempt log so it can be dropped
// without touching history. Lets a day's questions be done in pieces.
export const SESSION_KEY = "sat-mastery.session.v1";
// Highlights a question's passage, keyed by question id. Each is a span of
// character offsets into the passage text plus a colour, so it survives
// re-rendering and never depends on DOM structure.
export const HIGHLIGHT_KEY = "sat-mastery.highlights.v1";
// Scores from the official Bluebook practice tests, typed in after each one.
// They are the only real measure of where the 1600 stands, so they are kept
// apart from the attempt log and never derived from it.
export const SCORE_KEY = "sat-mastery.scores.v1";
// Days deliberately taken off. A plan that runs eight weeks has to survive a
// day of school work, and the honest way to take one is to say so: the day
// stops asking for questions, and its share is carried by the days that are
// left rather than quietly written off.
export const REST_KEY = "sat-mastery.rest.v1";

const EMPTY = { version: 1, attempts: [] };

function isValid(parsed) {
  return parsed && parsed.version === 1 && Array.isArray(parsed.attempts);
}

export function createStore(storage) {
  let state = read();

  function read() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(EMPTY);
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? parsed : structuredClone(EMPTY);
    } catch {
      return structuredClone(EMPTY);
    }
  }

  function write() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  return {
    get attempts() {
      return state.attempts;
    },
    recordAttempt({ id, correct, mode = "work", ms = 0, response = null, at = Date.now() }) {
      const attempt = { id, correct: Boolean(correct), mode, ms, response, at };
      state.attempts.push(attempt);
      write();
      return attempt;
    },
    attemptsFor(id) {
      return state.attempts.filter((a) => a.id === id);
    },
    seen() {
      return new Set(state.attempts.map((a) => a.id));
    },
    exportJson() {
      return JSON.stringify(state, null, 1);
    },
    importJson(text) {
      const parsed = JSON.parse(text);
      if (!isValid(parsed)) throw new Error("not a SAT Mastery export");
      state = parsed;
      write();
    },
    reset() {
      state = structuredClone(EMPTY);
      write();
    },
    // Everything this app has ever stored: the attempt log, a set in
    // progress and every highlight. Starting over means starting over.
    resetAll() {
      state = structuredClone(EMPTY);
      write();
      storage.removeItem(SESSION_KEY);
      storage.removeItem(HIGHLIGHT_KEY);
      storage.removeItem(SCORE_KEY);
      storage.removeItem(REST_KEY);
    },
    saveSession(session) {
      storage.setItem(SESSION_KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
    },
    loadSession() {
      try {
        const parsed = JSON.parse(storage.getItem(SESSION_KEY) ?? "null");
        if (!parsed || !Array.isArray(parsed.ids) || typeof parsed.index !== "number") return null;
        return parsed;
      } catch {
        return null;
      }
    },
    clearSession() {
      storage.removeItem(SESSION_KEY);
    },
    // Typed-in scores and scores read from a Bluebook report, one row per
    // test. The report wins for the same test: it is the document itself.
    scores() {
      let typed = [];
      try {
        const parsed = JSON.parse(storage.getItem(SCORE_KEY) ?? "[]");
        typed = Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.rw === "number" && typeof row.math === "number") : [];
      } catch {
        typed = [];
      }
      const fromReports = reportScores();
      const byTest = new Map(typed.map((row) => [row.test, row]));
      for (const row of fromReports) byTest.set(row.test, row);
      return [...byTest.values()].sort((a, b) => a.at - b.at);
    },
    logScore({ test, rw, math, at = Date.now(), note = "" }) {
      const row = { test: Number(test), rw: Number(rw), math: Number(math), total: Number(rw) + Number(math), at, note };
      const list = this.scores().filter((existing) => existing.test !== row.test);
      list.push(row);
      list.sort((a, b) => a.at - b.at);
      storage.setItem(SCORE_KEY, JSON.stringify(list));
      return row;
    },
    removeScore(test) {
      storage.setItem(SCORE_KEY, JSON.stringify(this.scores().filter((row) => row.test !== Number(test))));
    },
    // Everything this browser holds, in the shape it holds it. This is what
    // travels to the repository so another device — or a later reset — can be
    // put back exactly where this one is, not merely close to it.
    snapshot() {
      return {
        attempts: state.attempts,
        session: parse(SESSION_KEY, null),
        highlights: readHighlights(),
        scores: parse(SCORE_KEY, []),
        rest: parse(REST_KEY, []),
      };
    },
    // Adopts a record from elsewhere. Used when the repository is ahead of this
    // browser: a set done on the laptop shows up on the phone.
    restore(record) {
      if (!record || !Array.isArray(record.attempts)) return false;
      state = { version: 1, attempts: record.attempts };
      write();
      put(SESSION_KEY, record.session ?? null);
      put(HIGHLIGHT_KEY, record.highlights ?? null);
      put(SCORE_KEY, Array.isArray(record.scores) && record.scores.length ? record.scores : null);
      put(REST_KEY, Array.isArray(record.rest) && record.rest.length ? record.rest : null);
      return true;
    },
    // The days marked off, as YYYY-MM-DD keys.
    restDays() {
      const held = parse(REST_KEY, []);
      return new Set(Array.isArray(held) ? held.filter((d) => typeof d === "string") : []);
    },
    isRestDay(date) {
      return this.restDays().has(keyOf(date));
    },
    setRestDay(date, off = true) {
      const days = this.restDays();
      const key = keyOf(date);
      if (off) days.add(key);
      else days.delete(key);
      put(REST_KEY, [...days].sort());
      return off;
    },
    highlightsFor(id) {
      return readHighlights()[id] ?? [];
    },
    saveHighlights(id, list) {
      const all = readHighlights();
      if (list.length) all[id] = list;
      else delete all[id];
      storage.setItem(HIGHLIGHT_KEY, JSON.stringify(all));
    },
  };

  // The same key the rest of the app dates things by, so a day off and the
  // attempts made on it can never disagree about which day it was.
  function keyOf(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parse(key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) ?? "null");
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function put(key, value) {
    if (value === null || value === undefined) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  }

  function readHighlights() {
    try {
      const parsed = JSON.parse(storage.getItem(HIGHLIGHT_KEY) ?? "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}

export function progressBySkill(store, bank) {
  const stats = new Map();
  for (const attempt of store.attempts) {
    const question = bank.byId.get(attempt.id);
    if (!question) continue;
    const key = skillKey(question);
    const entry = stats.get(key) ?? { attempts: 0, correct: 0, seen: new Set() };
    entry.attempts += 1;
    if (attempt.correct) entry.correct += 1;
    entry.seen.add(question.id);
    stats.set(key, entry);
  }
  return stats;
}
