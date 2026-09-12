// Grading, pure. MCQ compares letters. SPR compares against every accepted
// form, as text after normalisation and as a number, so 3/2, 1.5 and a
// decimal rounded to fit the entry field all grade the way the test does.

export function normalize(text) {
  return String(text ?? "")
    .trim()
    .replace(/[$,\s]/g, "")
    .replace(/^\+/, "")
    .replace(/^(-?)\./, "$10.");
}

export function toNumber(text) {
  const s = normalize(text);
  if (s === "") return null;
  const fraction = s.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  return Number(s);
}

// The entry field holds a limited number of characters. A decimal that does
// not fit may be rounded or truncated at the last place that fits, so a
// response with three or more decimal places is accepted within one unit of
// its last place. Shorter decimals must be exact: .66 is not 2/3.
const MIN_DECIMALS_FOR_TOLERANCE = 3;

function decimalsIn(text) {
  const parts = text.split(".");
  return parts.length === 2 ? parts[1].length : 0;
}

export function sameValue(a, b) {
  if (a === null || b === null) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= 1e-9 * scale;
}

// A value as it may be typed: integer, decimal with or without its leading
// zero, or fraction, any of them negative.
const NUMERIC_FORM = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:\/\d+)?$/;

// Every accepted way of entering the answer, as separate forms. The export
// writes them on one line — "3.44, 86/25", "either 0 or 3" — and stored that
// way they match nothing a person could type. Splitting here as well as at
// ingest means a stale bank still grades correctly. Choice letters are left
// alone, and a form nobody could type is kept only when there is nothing
// better, so a question is never made ungradeable by this.
export function answerForms(question) {
  const stored = question.acceptedAnswers?.length ? question.acceptedAnswers : [question.correct];
  const kept = stored.map((form) => String(form ?? "").trim()).filter(Boolean);
  if (question.format !== "spr") return kept;
  const forms = [];
  for (const entry of kept) {
    for (const part of entry.split(/,|\bor\b|\beither\b/)) {
      const form = part.trim();
      if (NUMERIC_FORM.test(form) && !forms.includes(form)) forms.push(form);
    }
  }
  return forms.length ? forms : kept;
}

export function gradeSpr(question, response) {
  const forms = answerForms(question);
  const given = normalize(response);
  if (given === "") return false;
  const givenNumber = toNumber(given);
  const decimals = decimalsIn(given);
  const tolerance = decimals >= MIN_DECIMALS_FOR_TOLERANCE ? 10 ** -decimals : 0;
  return forms.some((form) => {
    if (normalize(form) === given) return true;
    const value = toNumber(form);
    if (sameValue(value, givenNumber)) return true;
    if (tolerance === 0 || value === null || givenNumber === null) return false;
    return Math.abs(value - givenNumber) < tolerance;
  });
}

export function gradeMcq(question, letter) {
  return Boolean(letter) && letter === question.correct;
}

export function grade(question, response) {
  return question.format === "spr" ? gradeSpr(question, response) : gradeMcq(question, response);
}
