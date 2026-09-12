// What the official Bluebook practice tests say, read from data/bluebook.json.
//
// After each test Eduardo hands over the score report; tools/bluebook.py
// reads it and writes the file. The app loads it on boot and it becomes part
// of the record: the scores sit beside anything typed in by hand, and the
// skills the real test showed to be weak are met first in the day's set.
// Opened without the server, or before any test, there is no file, and that
// is fine: the fetch fails quietly and nothing else changes.

let loaded = { tests: [] };

export async function loadBluebook(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl("data/bluebook.json", { cache: "no-store" });
    if (!response.ok) return loaded;
    const parsed = await response.json();
    loaded = normalize(parsed);
  } catch {
    // no file yet, or no server: the record is whatever was typed in
  }
  return loaded;
}

export function bluebook() {
  return loaded;
}

// Used by tests and by the loader alike, so the shape is checked in one place.
export function normalize(parsed) {
  const tests = Array.isArray(parsed?.tests) ? parsed.tests : [];
  return {
    tests: tests
      .filter((t) => t && Number.isInteger(t.test) && Number.isInteger(t.rw) && Number.isInteger(t.math))
      .map((t) => ({
        test: t.test,
        date: typeof t.date === "string" ? t.date : null,
        rw: t.rw,
        math: t.math,
        total: t.rw + t.math,
        missed: Array.isArray(t.missed)
          ? t.missed.filter((m) => m && (m.section === "rw" || m.section === "math")).map((m) => ({
              section: m.section,
              skill: typeof m.skill === "string" ? m.skill : null,
              domain: typeof m.domain === "string" ? m.domain : null,
              number: Number.isInteger(m.number) ? m.number : null,
            }))
          : [],
        source: "report",
      })),
  };
}

// The scores in the store's shape, so they can be merged with hand-typed ones.
export function reportScores(data = loaded) {
  return data.tests.map((t) => ({
    test: t.test,
    rw: t.rw,
    math: t.math,
    total: t.total,
    at: t.date ? new Date(`${t.date}T12:00:00`).getTime() : 0,
    note: "from the score report",
    source: "report",
  }));
}

// How many questions each skill was missed on across every official test,
// most missed first. This is what steers the day's set: the real test is the
// best evidence there is of where the marks are going.
export function missedSkills(data = loaded) {
  const counts = new Map();
  for (const t of data.tests) {
    for (const m of t.missed) {
      if (!m.skill) continue;
      counts.set(m.skill, (counts.get(m.skill) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([skill, misses]) => ({ skill, misses }));
}
