// Pure helpers over the question records. No DOM, no storage.

export function skillKey(question) {
  return `${question.section}:${question.skill}`;
}

export function buildBank(records) {
  const byId = new Map();
  const bySkill = new Map();
  for (const question of records) {
    byId.set(question.id, question);
    const key = skillKey(question);
    if (!bySkill.has(key)) bySkill.set(key, []);
    bySkill.get(key).push(question);
  }
  const skills = [...bySkill.keys()].sort();
  return { all: records, byId, bySkill, skills };
}

// Small deterministic PRNG so a "random" set can be reproduced from a seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick(bank, options = {}) {
  const { skill = null, difficulty = null, exclude = new Set(), limit = 20, seed = null } = options;
  let pool = skill ? bank.bySkill.get(skill) ?? [] : bank.all;
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
  pool = pool.filter((q) => !exclude.has(q.id));
  const random = seed === null ? Math.random : mulberry32(seed);
  return shuffle(pool, random).slice(0, limit);
}

export function skillSummary(bank) {
  return bank.skills.map((key) => {
    const questions = bank.bySkill.get(key);
    const counts = { Easy: 0, Medium: 0, Hard: 0 };
    for (const question of questions) counts[question.difficulty]++;
    return {
      key,
      section: questions[0].section,
      domain: questions[0].domain,
      skill: questions[0].skill,
      total: questions.length,
      counts,
    };
  });
}
