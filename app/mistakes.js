// The error log: every question that has ever gone wrong, and what happened to
// it since.
//
// The point of it is not the count. It is being able to look at a miss, see
// what you put and what was right, and open the question again with its
// explanation — without waiting for the schedule to bring it back. Everything
// here is derived from the attempt log, so it can never disagree with it.

import { escapeHtml } from "./html.js?v=dcf29171";
import { daysUntilDue, reviewState } from "./review.js?v=dcf29171";

const SECTION_NAME = { rw: "Reading & Writing", math: "Math" };

function shortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// What state a miss is in now: fixed for good, owed today, or waiting for the
// day the ladder brings it back.
function standing(entry, now) {
  if (entry.retired) return { key: "fixed", label: "Fixed", note: "four clean passes" };
  const days = daysUntilDue(entry, now);
  if (days === null) return { key: "open", label: "Open", note: "" };
  if (days <= 0) return { key: "due", label: "Due now", note: days < 0 ? `${-days}d overdue` : "today" };
  return { key: "waiting", label: `Back in ${days}d`, note: "" };
}

// One row per question ever answered wrong. Newest first, with anything owed
// today lifted to the top: that is what you would want to act on.
export function mistakeLog(store, bank, now = new Date()) {
  const state = reviewState(store.attempts);
  const latest = new Map();
  const wrongCount = new Map();
  for (const attempt of store.attempts) {
    latest.set(attempt.id, attempt);
    if (!attempt.correct) wrongCount.set(attempt.id, (wrongCount.get(attempt.id) ?? 0) + 1);
  }

  const rows = [];
  for (const [id, entry] of state) {
    if (!entry.misses) continue;
    const question = bank.byId.get(id);
    const last = latest.get(id);
    const wrong = store.attempts.filter((a) => a.id === id && !a.correct).pop();
    rows.push({
      id,
      section: question?.section ?? null,
      sectionName: SECTION_NAME[question?.section] ?? "—",
      skill: question?.skill ?? "—",
      difficulty: question?.difficulty ?? "—",
      format: question?.format ?? "mcq",
      youAnswered: wrong?.response ?? null,
      correctAnswer: question?.correct ?? null,
      timesMissed: wrongCount.get(id) ?? entry.misses,
      lastAt: entry.lastAt,
      missedAt: wrong?.at ?? entry.lastAt,
      // Whether it has since been put right. A mistake never leaves this log —
      // it is a record of what has gone wrong, not a list of chores — but a
      // question you have since answered correctly should say so plainly.
      putRight: Boolean(last?.correct),
      lastWasCorrect: Boolean(last?.correct),
      standing: standing(entry, now),
    });
  }

  const order = { due: 0, open: 1, waiting: 2, fixed: 3 };
  rows.sort((a, b) => order[a.standing.key] - order[b.standing.key] || b.missedAt - a.missedAt);
  return rows;
}

export function mistakeSummary(rows) {
  const bySkill = new Map();
  for (const row of rows) {
    const entry = bySkill.get(row.skill) ?? { skill: row.skill, section: row.section, count: 0, open: 0 };
    entry.count += 1;
    if (row.standing.key !== "fixed") entry.open += 1;
    bySkill.set(row.skill, entry);
  }
  return {
    total: rows.length,
    open: rows.filter((row) => row.standing.key !== "fixed").length,
    fixed: rows.filter((row) => row.standing.key === "fixed").length,
    due: rows.filter((row) => row.standing.key === "due").length,
    bySkill: [...bySkill.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)),
  };
}

// A fill-in answer is shown as typed; a multiple choice as its letter. Nothing
// is shown for a question left blank on a test, because nothing was chosen.
function answerCell(value, kind) {
  if (value === null || value === undefined || value === "") return `<span class="ml-blank">blank</span>`;
  return `<span class="ml-a ml-a-${kind}">${escapeHtml(String(value))}</span>`;
}

export function renderMistakes(root, { bank, store, onBack, onOpen, onDrill, now = new Date() }) {
  const rows = mistakeLog(store, bank, now);
  const sum = mistakeSummary(rows);

  const body = rows.length
    ? rows
        .map(
          (row) => `<tr data-id="${row.id}" tabindex="0" title="Open this question and its explanation">
            <td class="ml-when">${escapeHtml(shortDate(new Date(row.missedAt)))}</td>
            <td class="ml-skill"><span class="ml-sec ${row.section ?? ""}"></span>${escapeHtml(row.skill)}</td>
            <td class="ml-diff">${escapeHtml(row.difficulty)}</td>
            <td class="ml-you">${answerCell(row.youAnswered, "wrong")}</td>
            <td class="ml-right">${answerCell(row.correctAnswer, "right")}</td>
            <td class="ml-times">${row.timesMissed > 1 ? `${row.timesMissed}×` : ""}</td>
            <td class="ml-later">${row.putRight ? `<span class="ml-tag later">✓ right later</span>` : ""}</td>
            <td class="ml-state"><span class="ml-tag ${row.standing.key}">${escapeHtml(row.standing.label)}</span>${
              row.standing.note ? `<em>${escapeHtml(row.standing.note)}</em>` : ""
            }</td>
          </tr>`
        )
        .join("")
    : `<tr class="ml-empty"><td colspan="8">Nothing wrong yet. This fills in as you work — and everything here comes back on its own until you have it four times running.</td></tr>`;

  root.innerHTML = `
  <div class="mc-bank ml-screen">
    <div class="mc-panel">
      <div class="mc-head">
        <h4><i class="dot" style="background:#e0453b"></i>Every mistake</h4>
        <button type="button" id="ml-back" class="mc-ghost">← Mission Control</button>
      </div>
      <p class="ml-lede">Every question you have got wrong, what you put, and what was right. Click any row to
        open it again with its explanation — looking at one here does not count as an attempt.</p>

      <div class="ml-tiles">
        <div class="ml-tile"><span class="v">${sum.total}</span><span class="k">missed in all</span></div>
        <div class="ml-tile"><span class="v">${sum.open}</span><span class="k">still open</span></div>
        <div class="ml-tile"><span class="v">${sum.fixed}</span><span class="k">fixed for good</span></div>
        <div class="ml-tile ${sum.due ? "hot" : ""}"><span class="v">${sum.due}</span><span class="k">owed today</span></div>
      </div>

      ${
        sum.bySkill.length
          ? `<div class="ml-skills">${sum.bySkill
              .slice(0, 10)
              .map(
                (s) => `<span class="ml-chip ${s.section ?? ""}">${escapeHtml(s.skill)}<b>${s.count}</b></span>`
              )
              .join("")}</div>`
          : ""
      }

      <table class="ml-table">
        <thead><tr>
          <th>Missed</th><th>Skill</th><th>Level</th><th>You put</th><th>Right</th><th></th><th></th><th>Standing</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>

      ${sum.due ? `<div class="ml-foot"><button type="button" id="ml-drill">Work the ${sum.due} owed today</button></div>` : ""}
    </div>
  </div>`;

  root.querySelector("#ml-back").addEventListener("click", onBack);
  root.querySelector("#ml-drill")?.addEventListener("click", onDrill);
  for (const tr of root.querySelectorAll("tbody tr[data-id]")) {
    tr.addEventListener("click", () => onOpen(tr.dataset.id));
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(tr.dataset.id);
      }
    });
  }
}

// The dashboard's own small view of the log: what has gone wrong lately, with
// anything owed today first, and the door to the whole thing.
export function renderErrorPanel(box, { bank, store, onAll, onOpen, limit = 6, now = new Date() }) {
  if (!box) return;
  const rows = mistakeLog(store, bank, now);
  const sum = mistakeSummary(rows);
  if (!rows.length) {
    box.innerHTML = `<div class="mc-empty"><span>◎</span>Nothing wrong yet. Every question you miss lands here for good —
      including the ones you later put right.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="el-counts">
      <span><b>${sum.total}</b> in all</span>
      <span><b>${sum.open}</b> still open</span>
      <span class="${sum.due ? "hot" : ""}"><b>${sum.due}</b> owed today</span>
      <span class="ok"><b>${rows.filter((r) => r.putRight).length}</b> put right</span>
    </div>
    <ul class="el-list">${rows
      .slice(0, limit)
      .map(
        (row) => `<li data-id="${row.id}" tabindex="0" title="Open it with its explanation">
          <span class="el-sec ${row.section ?? ""}"></span>
          <span class="el-skill">${escapeHtml(row.skill)}</span>
          <span class="el-ans">${answerCell(row.youAnswered, "wrong")}<i>→</i>${answerCell(row.correctAnswer, "right")}</span>
          <span class="el-tag ${row.putRight ? "later" : row.standing.key}">${row.putRight ? "✓ right later" : escapeHtml(row.standing.label)}</span>
        </li>`
      )
      .join("")}</ul>
    <button type="button" class="el-all">The whole error log · ${sum.total} →</button>`;

  box.querySelector(".el-all").addEventListener("click", onAll);
  for (const li of box.querySelectorAll("li[data-id]")) {
    li.addEventListener("click", () => onOpen(li.dataset.id));
    li.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(li.dataset.id);
      }
    });
  }
}
