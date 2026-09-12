import { buildBank, pick } from "./bank.js?v=dcf29171";
import { createStore } from "./store.js?v=dcf29171";
import { renderBank, renderCalendar, renderHome, renderScoreLog } from "./home.js?v=dcf29171";
import { renderMistakes } from "./mistakes.js?v=dcf29171";
import { startDrill } from "./drill.js?v=dcf29171";
import { dueForReview, weeklyReview } from "./review.js?v=dcf29171";
import { MODULES, buildDailySet, buildPracticeTest, sectionForDay } from "./plan.js?v=dcf29171";
import { adoptRemote, createSync, commitMessage } from "./sync.js?v=dcf29171";
import { loadBluebook } from "./bluebook.js?v=dcf29171";
import { hosted, getToken, clearToken, isGuest, readProgress, writeProgress } from "./remote.js?v=dcf29171";
import { applyBackdrop, loadBank, watchAssets } from "./assets.js?v=dcf29171";
import { showConnect } from "./connect.js?v=dcf29171";
import { BANK_STAMP } from "./version.js?v=dcf29171";

const root = document.getElementById("app");
// Set once the bank is loaded; writes progress out to data/progress.json.
let sync = () => {};

// The bank: off the disk when a server is serving it, out of the private
// repository when the app is opened from anywhere else. Either way the app
// above this line sees the same 3,770 questions.
//
// A key that no longer opens the repository is the one failure worth catching
// by hand: it is not a broken app, it is an expired token, and saying so is the
// difference between a minute and an evening.
async function loadRecords(remote) {
  try {
    if (remote) return await loadBank(BANK_STAMP);
    const response = await fetch("data/questions.json");
    if (!response.ok) throw new Error(`the bank would not load (${response.status})`);
    return await response.json();
  } catch (error) {
    if (remote && [401, 403, 404].includes(error.status)) {
      clearToken();
      await showConnect(root, { reason: "That key no longer opens the repository. Make a new one and paste it here." });
      window.location.reload();
      return null;
    }
    throw error;
  }
}

async function boot() {
  const remote = hosted();
  if (remote) {
    if (!getToken()) await showConnect(root);
    watchAssets(document.body);
  }
  await loadBluebook();
  let records;
  try {
    records = await loadRecords(remote);
  } catch (error) {
    root.innerHTML = `<p class="boot">${error.message}. Reload to try again.</p>`;
    return;
  }
  if (!records) return;
  if (!Array.isArray(records)) {
    root.innerHTML = `<p class="boot">data/questions.json is missing. Run <code>python3 -m tools.ingest</code> first.</p>`;
    return;
  }
  const bank = buildBank(records);
  const store = createStore(window.localStorage);
  // A guest's practice stays in their browser: there is no repository of
  // theirs, and their key could not write to one anyway. Local storage is the
  // whole record, and it is enough for a day's work.
  const guest = remote && isGuest();
  sync = createSync(store, bank, remote && !guest ? { transport: repoTransport(bank) } : { transport: async () => {} });
  if (window.location.hash === "#reset") {
    store.resetAll();
    sync({ immediate: true });
    return showReset(bank, store);
  }
  if (remote && !guest) await adoptRemote(store, bank, readProgress);
  // Never awaited: the dashboard should draw at once and the photograph can
  // arrive a moment later.
  applyBackdrop(remote);
  const one = questionFromHash(bank);
  if (one) {
    runDrill(bank, store, [one], one.skill, { ephemeral: true });
    return;
  }
  // #test sits a mock built from the bank: 98 questions in the real order and
  // the real timing, but drawn from the question bank, not an official form.
  // The scheduled practice tests are the official ones in the Bluebook app;
  // this is extra, for when you want the clock without spending one of those.
  if (window.location.hash === "#test") {
    window.location.hash = "";
    runPracticeTest(bank, store);
    return;
  }
  showHome(bank, store);
}

// A save is a commit on the private repository, so the record has a history and
// can be read from anywhere — including here, in a conversation about it.
function repoTransport(bank) {
  return async function push(payload) {
    await writeProgress(payload, commitMessage(payload));
  };
}

// Typing #reset in the address bar erases everything stored in this
// browser. It has to be a URL, because storage belongs to the browser
// showing the page, not to the machine serving it.
function showReset(bank, store) {
  screen("summary");
  root.innerHTML = `
    <div class="summary">
      <div class="kick">Reset</div>
      <div class="big">0</div>
      <p>Every answer, every saved set and every highlight in this browser is gone.</p>
      <p>3,770 questions, all unseen. Today is Day 1.</p>
      <button type="button" id="home">Start from the beginning</button>
    </div>`;
  root.querySelector("#home").addEventListener("click", () => {
    window.location.hash = "";
    showHome(bank, store);
  });
}

// #q=<id> opens a single question directly. Useful for checking a specific
// item, and later for reviewing feedback written for it.
function questionFromHash(bank) {
  const match = window.location.hash.match(/^#q=([0-9a-f]{8})$/);
  return match ? bank.byId.get(match[1]) ?? null : null;
}

function screen(name) {
  document.documentElement.dataset.screen = name;
  window.scrollTo(0, 0);
}

function runDrill(bank, store, questions, title, options = {}) {
  if (!questions.length) return showHome(bank, store);
  screen("drill");
  startDrill(root, {
    bank,
    store,
    questions,
    title,
    ...options,
    onSaved: (opts) => sync(opts),
    onDone: options.onDone ?? ((results) => showSummary(bank, store, results, options.mode === "test")),
    onPause: options.onPause ?? (() => showHome(bank, store)),
  });
}

// A review set is the same drill, tagged so the schedule can tell a review
// apart from a first meeting.
// Reviews keep their longest-overdue order, but today's section comes first,
// so a review sits inside the same frame of mind as the rest of the day.
function runReview(bank, store, ids, title) {
  const questions = ids.map((id) => bank.byId.get(id)).filter(Boolean);
  if (!questions.length) return showHome(bank, store);
  const today = sectionForDay();
  const ordered = [
    ...questions.filter((q) => q.section === today),
    ...questions.filter((q) => q.section !== today),
  ];
  runDrill(bank, store, ordered, title, { mode: "review" });
}

// The day's own set: one section, whichever the rota says, sized by the same
// pace the dashboard shows, so the number on the card is the number you get.
function startToday(bank, store) {
  const questions = buildDailySet(bank, store);
  runDrill(bank, store, questions, "today's set");
}

// A full-length mock from the bank: four timed modules, no feedback until
// the end, everything missed dropping into the review queue.
function runPracticeTest(bank, store) {
  const questions = buildPracticeTest(bank, { date: new Date(), prefer: store.seen() });
  runDrill(bank, store, questions, "Mock test from the bank", {
    mode: "test",
    modules: MODULES,
  });
}

function startSkill(bank, store, { skill, count }) {
  const fresh = pick(bank, { skill, limit: count, exclude: store.seen() });
  const questions = fresh.length ? fresh : pick(bank, { skill, limit: count });
  runDrill(bank, store, questions, skill.split(":")[1]);
}

function showHome(bank, store) {
  screen("home");
  sync();
  const session = store.loadSession();
  renderHome(root, {
    bank,
    store,
    session,
    onStart: (choice) => startSkill(bank, store, choice),
    onToday: () => startToday(bank, store),
    onResume() {
      const saved = store.loadSession();
      if (!saved) return showHome(bank, store);
      const questions = saved.ids.map((id) => bank.byId.get(id)).filter(Boolean);
      // A set saved against a bank that has since been rebuilt may point at
      // nothing. Drop it rather than open an empty drill.
      if (!questions.length) {
        store.clearSession();
        return showHome(bank, store);
      }
      // A practice test comes back as a practice test: same mode, same
      // module clocks, still no feedback until the end.
      const mode = saved.mode ?? "work";
      runDrill(bank, store, questions, saved.title, {
        mode,
        modules: mode === "test" ? MODULES : null,
        // Everything the set had when it was left: the answers, what was
        // crossed out and marked, the time spent on each question, which
        // screen you were on, and how much of the clock was left.
        resume: {
          index: Math.min(saved.index ?? 0, questions.length - 1),
          answers: saved.answers ?? [],
          crossed: saved.crossed ?? [],
          marked: saved.marked ?? [],
          spent: saved.spent ?? [],
          phase: saved.phase ?? "answering",
          results: saved.results ?? [],
          remainingMs: saved.remainingMs ?? 0,
        },
      });
    },
    onReviewDue: () => runReview(bank, store, dueForReview(store), "Review · due today"),
    onWeekly: () => runReview(bank, store, weeklyReview(store), "Weekly review"),
    onLogScore: () => showScoreLog(bank, store),
    onBank: () => showBank(bank, store),
    onCalendar: () => showCalendar(bank, store),
    onMistakes: () => showMistakes(bank, store),
    onOpenMistake: (id) => openMistake(bank, store, id, () => showHome(bank, store)),
    // Taking a day off changes what every later day is asked for, so the
    // record is written and the dashboard redrawn from it.
    onRest: (off) => {
      store.setRestDay(new Date(), off);
      // Taking the day off should actually clear it. A set opened for today
      // and not started is part of the day being waived; one already under way
      // is work, and work is never thrown away without being asked.
      if (off) {
        const open = store.loadSession();
        const answered = (open?.answers ?? []).filter((a) => a !== null && a !== undefined && String(a).trim() !== "").length;
        if (open && answered === 0) store.clearSession();
      }
      sync({ immediate: true });
      showHome(bank, store);
    },
    // The mosaic reads its colours from the stylesheet as it paints, so a
    // change of theme has to redraw rather than only restyle.
    onTheme: () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem("sat-mastery.theme.v1", next);
      } catch {}
      showHome(bank, store);
    },
  });
}

// The error log. Opening a question from it is deliberately ephemeral: looking
// at a mistake is not the same as answering it again, and only answering it
// again should move it along the review ladder.
function showMistakes(bank, store) {
  screen("mistakes");
  renderMistakes(root, {
    bank,
    store,
    onBack: () => showHome(bank, store),
    onOpen: (id) => openMistake(bank, store, id, () => showMistakes(bank, store)),
    onDrill: () => runReview(bank, store, dueForReview(store), "Review · due today"),
  });
}

// One mistake, opened already graded on the answer that was given, so the
// explanation is there at once rather than after answering it again from
// memory. Nothing is recorded: only a real attempt moves the review ladder.
function openMistake(bank, store, id, back) {
  const question = bank.byId.get(id);
  if (!question) return;
  const wrong = store.attemptsFor(id).filter((a) => !a.correct).pop();
  const response = wrong?.response ?? null;
  runDrill(bank, store, [question], `Looking back · ${question.skill}`, {
    ephemeral: true,
    resume: {
      index: 0,
      answers: [response],
      crossed: [[]],
      marked: [],
      spent: [wrong?.ms ?? 0],
      phase: "results",
      results: [{ id, correct: false, ms: wrong?.ms ?? 0, response }],
      remainingMs: 0,
    },
    onDone: back,
    onPause: back,
  });
}

function showCalendar(bank, store) {
  screen("calendar");
  renderCalendar(root, { bank, store, onBack: () => showHome(bank, store), onLogScore: () => showScoreLog(bank, store) });
}

function showScoreLog(bank, store) {
  screen("scores");
  renderScoreLog(root, { store, onBack: () => showHome(bank, store) });
  sync();
}

function showBank(bank, store) {
  screen("bank");
  renderBank(root, {
    bank,
    store,
    onStart: (choice) => startSkill(bank, store, choice),
    onBack: () => showHome(bank, store),
  });
}

function showSummary(bank, store, results, isTest = false) {
  screen("summary");
  if (!results.length) {
    root.innerHTML = `
      <div class="summary">
        <div class="kick">Nothing answered</div>
        <div class="big">—</div>
        <p>The set was ended before any question was answered, so nothing was recorded.</p>
        <button type="button" id="home">Back to Mission Control</button>
      </div>`;
    root.querySelector("#home").addEventListener("click", () => showHome(bank, store));
    return;
  }
  // Blanks in a practice set were never graded, so they are not part of the
  // score; they are counted separately and said plainly.
  const graded = results.filter((r) => !r.skipped);
  const blank = results.length - graded.length;
  const right = graded.filter((r) => r.correct).length;
  const minutes = Math.round(results.reduce((t, r) => t + r.ms, 0) / 60000);
  const pct = graded.length ? Math.round((100 * right) / graded.length) : 0;
  const rows = results
    .map((r) => {
      const q = bank.byId.get(r.id);
      const mark = r.skipped ? '<span class="blank">blank</span>' : `<span class="${r.correct ? "good" : "bad"}">${r.correct ? "✓" : "✕"}</span>`;
      return `<li><a href="#q=${r.id}">${r.id}</a><span>${q ? q.skill : ""}</span>${mark}</li>`;
    })
    .join("");
  root.innerHTML = `
    <div class="summary">
      <div class="kick">${isTest ? "Mock test complete" : "Session complete"}</div>
      <div class="big">${isTest ? estimateScore(bank, results).total : `${right} / ${graded.length}`}</div>
      <p>${isTest ? scoreLine(bank, results) : `${pct}% · ${minutes} minute${minutes === 1 ? "" : "s"}${blank ? ` · ${blank} left blank, not recorded` : ""}`}</p>
      ${isTest ? `<p class="rough">${right} of ${results.length} right in ${minutes} minutes. This is a mock from the bank and the score is a rough guide; the real measure is a Bluebook test, logged from Mission Control.</p>` : ""}
      <p class="rough">Everything you missed is now in the review queue, back in two days.</p>
      <ul>${rows}</ul>
      <button type="button" id="home">Back to Mission Control</button>
    </div>`;
  root.querySelector("#home").addEventListener("click", () => showHome(bank, store));
}

// A rough scaled score. The real conversion is a guarded table that varies by
// form; this is a straight line from the raw fraction onto each section's
// 200 to 800, rounded to the nearest ten, and it is labelled as approximate
// wherever it is shown.
function estimateScore(bank, results) {
  const section = (name) => {
    const rows = results.filter((r) => bank.byId.get(r.id)?.section === name);
    if (!rows.length) return null;
    const share = rows.filter((r) => r.correct).length / rows.length;
    return Math.round((200 + 600 * share) / 10) * 10;
  };
  const rw = section("rw");
  const math = section("math");
  return { rw, math, total: (rw ?? 0) + (math ?? 0) };
}

function scoreLine(bank, results) {
  const { rw, math } = estimateScore(bank, results);
  const parts = [];
  if (rw !== null) parts.push(`Reading and Writing about ${rw}`);
  if (math !== null) parts.push(`Math about ${math}`);
  return parts.join(" · ");
}

boot();
