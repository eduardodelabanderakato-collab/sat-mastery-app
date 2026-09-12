// Mission Control: the home screen, drawn from the attempt log and sized to
// fit one screen. Every panel has a real empty state, because practice
// starts from zero.

import { escapeHtml } from "./html.js?v=dcf29171";
import { dueForReview, reviewSummary, weeklyReview } from "./review.js?v=dcf29171";
import { mistakeLog, renderErrorPanel } from "./mistakes.js?v=dcf29171";
import { PRACTICE_TESTS, SECTION_MAX, SECTION_MIN, TEST_QUESTIONS, dailyPlan, nextPracticeTest, practiceTestDates } from "./plan.js?v=dcf29171";
import { planCalendar, planTotals, weekPlan } from "./calendar.js?v=dcf29171";
import {
  accuracyByDifficulty,
  coverage,
  coverageDeadline,
  dayKey,
  dayNumber,
  daysBetween,
  daysUntil,
  masteryBySkill,
  paceSeries,
  recommendSkill,
  streak,
  COVERAGE_WEEKS,
  TEST_DATE,
} from "./stats.js?v=dcf29171";

const SECTION_NAME = { rw: "Reading and Writing", math: "Math" };
const SECTION_COLOR = { rw: "#1b36de", math: "#eb6834" };
// The colour of a question not yet met. Read from the stylesheet rather than
// fixed here, so the mosaic follows whatever surface the dashboard is wearing:
// a light grid on a light page, a dark one on a dark page.
const UNSEEN_FALLBACK = "#e3e7f1";
function unseenColour() {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue("--unseen").trim() || UNSEEN_FALLBACK;
  } catch {
    return UNSEEN_FALLBACK;
  }
}
const WEEKDAY_TARGET = 43;
const WEEKEND_TARGET = 130;

// Sequential blue, light to dark: darker is stronger on a light surface.
const RAMP = ["#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
function shade(percent) {
  if (percent === null) return null;
  if (percent >= 90) return RAMP[4];
  if (percent >= 80) return RAMP[3];
  if (percent >= 70) return RAMP[2];
  if (percent >= 60) return RAMP[1];
  return RAMP[0];
}

// Display names for the tiles: the official names, shortened so the
// distinguishing word survives a narrow tile. The full name stays on hover.
const SHORT_NAME = {
  "Central Ideas and Details": "Central ideas & details",
  "Command of Evidence": "Command of evidence",
  "Cross-Text Connections": "Cross-text connections",
  "Form, Structure, and Sense": "Form & structure",
  "Rhetorical Synthesis": "Rhetorical synthesis",
  "Text Structure and Purpose": "Text structure & purpose",
  "Words in Context": "Words in context",
  "Evaluating statistical claims: Observational studies and experiments": "Evaluating stat. claims",
  "Inference from sample statistics and margin of error": "Margin of error",
  "Linear equations in one variable": "1-variable linear eq.",
  "Linear equations in two variables": "2-variable linear eq.",
  "Linear inequalities in one or two variables": "Linear inequalities",
  "Lines, angles, and triangles": "Lines, angles & triangles",
  "Nonlinear equations in one variable and systems of equations in two variables": "Nonlinear eq. & systems",
  "One-variable data: Distributions and measures of center and spread": "One-variable data",
  "Probability and conditional probability": "Probability",
  "Ratios, rates, proportional relationships, and units": "Ratios, rates & units",
  "Right triangles and trigonometry": "Right triangles & trig",
  "Systems of two linear equations in two variables": "Systems of linear eq.",
  "Two-variable data: Models and scatterplots": "Two-variable data",
};
const shortName = (skill) => SHORT_NAME[skill] ?? skill;

const fmt = (n) => n.toLocaleString("en-US");
const shortSection = (section) => (section === "math" ? "Math" : "Reading");
// Minutes as something a person would say out loud.
function planHours(mins) {
  if (!mins) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
const longDate = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function renderHome(root, { bank, store, session = null, onStart, onToday, onResume, onReviewDue, onWeekly, onLogScore, onBank, onCalendar, onMistakes, onOpenMistake, onTheme, onRest, now = new Date() }) {
  const cov = coverage(store, bank);
  const ringPercent = cov.seen === 0 ? "0" : cov.percent < 10 ? ((100 * cov.seen) / cov.total).toFixed(1) : String(cov.percent);
  const mastery = masteryBySkill(store, bank);
  const difficulty = accuracyByDifficulty(store, bank);
  const due = dueForReview(store, now);
  const review = reviewSummary(store, now);
  const weekly = weeklyReview(store, now);
  const pace = paceSeries(store, bank, now);
  const run = streak(store, now);
  const days = daysUntil(TEST_DATE, now);
  const day = dayNumber(store, now);
  const recommended = recommendSkill(store, bank);
  const isWeekend = [0, 6].includes(now.getDay());
  const target = isWeekend ? WEEKEND_TARGET : WEEKDAY_TARGET;
  const unseenInRecommended = recommended.total - recommended.seen;
  const startCount = Math.max(1, Math.min(target, unseenInRecommended || target));
  const last200 = store.attempts.slice(-200);
  const recentAccuracy = last200.length ? Math.round((100 * last200.filter((a) => a.correct).length) / last200.length) : null;
  const deadline = coverageDeadline(store, now);
  const weeksLeft = Math.max(0, daysBetween(now, deadline)) / 7;
  const perWeek = weeksLeft > 0 ? Math.ceil((cov.total - cov.seen) / Math.max(1, weeksLeft)) : null;
  // What is still blank in the open set, which is what "left" means once you
  // can answer them in any order.
  const left = session
    ? Math.max(0, session.ids.length - (session.answers ?? []).filter((a) => a !== null && a !== undefined && String(a).trim() !== "").length)
    : 0;
  const resumable = Boolean(session) && session.ids.length > 0 && !(session.phase === "results");
  // The review queue is served before new work: what you got wrong is worth
  // more than what you have not met yet.
  const leadReview = !resumable && due.length > 0;
  const weekendSet = isWeekend && weekly.length > 0;
  const plan = dailyPlan(store, bank, now);
  // Once the day's quota is met, everything on offer is optional. Saying so
  // plainly matters: a card that still reads "Start today's set" after today's
  // set is done looks like the app has lost track of what you did.
  const extra = plan.done && !plan.testDay;
  // The day's new questions, which is what the start button opens. Not simply
  // the first line of the plan: on a day with reviews owed, that line is the
  // review queue, and the button would promise the wrong number.
  const newToday = plan.items.find((item) => item.key === "new");
  // The switch names the theme it will give you, not the one you are in — a
  // button that says where you already are is a label, not a control.
  const themeNow = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const restToday = Boolean(store.isRestDay?.(now));
  const missCount = mistakeLog(store, bank, now).length;
  const nextTest = nextPracticeTest(now);
  const scores = store.scores();
  const latest = scores[scores.length - 1] ?? null;
  const best = scores.reduce((top, row) => (row.total > (top?.total ?? -1) ? row : top), null);

  root.innerHTML = `
  <div class="ls">
    <header class="ls-top">
      <div class="ls-brand">
        <h1>SAT Mastery</h1>
        <p>${escapeHtml(longDate(now))} · Day ${day}</p>
      </div>
      <div class="ls-top-right">
        ${run ? `<span class="ls-streak">🔥 ${run}-day streak</span>` : ""}
        <span class="ls-count"><b>${days}</b>days to the SAT</span>
        <button type="button" id="mc-theme" class="ls-theme" title="Switch the theme">${
          themeNow === "dark" ? "☀<span>Light</span>" : "☾<span>Dark</span>"
        }</button>
      </div>
    </header>

    <section class="ls-card ls-activity">
      <div class="ls-h"><h2>Activity</h2><span class="ls-tag">This week</span></div>
      <div id="mc-activity" class="ls-bars"></div>
    </section>

    <div class="ls-pills">
      <div class="ls-card ls-pill">
        <span class="ls-ic ls-ic-b">◎</span>
        <div><b>${ringPercent}%</b><span>of the bank covered</span></div>
      </div>
      <div class="ls-card ls-pill">
        <span class="ls-ic ls-ic-g">✓</span>
        <div><b>${recentAccuracy === null ? "—" : recentAccuracy + "%"}</b><span>right, last ${last200.length || 200}</span></div>
      </div>
      <div class="ls-card ls-pill ${due.length ? "is-hot" : ""}">
        <span class="ls-ic ls-ic-r">↺</span>
        <div><b>${fmt(due.length)}</b><span>due for review today</span></div>
      </div>
    </div>

    <section class="ls-card ls-overview">
      <div class="ls-h"><h2>Overview</h2><span class="ls-tag">All time</span></div>
      <div id="mc-overview" class="ls-ov"></div>
    </section>

    <section class="ls-card ls-today">
      <div class="ls-h">
        <h2>Today</h2>
        <span class="ls-tag">${plan.done ? "quota met" : `about ${planHours(plan.minutesLeft)}`}</span>
      </div>
      <div id="mc-challenges" class="ls-ch"></div>
      <p class="ls-note">${
        extra
          ? `<b>Today's quota is done.</b> Anything more is extra — and every extra question makes the days ahead lighter.`
          : resumable
            ? `A set is open · ${fmt(session.ids.length - left)} of ${fmt(session.ids.length)} answered. You don't have to do it in one sitting.`
            : "You don't have to do it in one sitting. Pause whenever you like; your set is saved when you leave."
      }</p>
      <div class="ls-do">
        ${resumable ? `<button type="button" id="mc-resume" class="ls-go">Resume${extra ? " extra set" : ""}${left ? ` · ${fmt(left)} blank` : " · review and submit"}</button>` : ""}
        ${plan.testDay ? `<button type="button" id="mc-test" class="${resumable ? "ls-alt" : "ls-go"}">Log Bluebook test ${nextTest.number}</button>` : ""}
        ${due.length ? `<button type="button" id="mc-review" class="${leadReview && !plan.testDay ? "ls-go" : "ls-alt"}">Review ${fmt(due.length)} due</button>` : ""}
        <button type="button" id="mc-start" class="${resumable || leadReview || plan.testDay || extra ? "ls-alt" : "ls-go"}">${
          extra ? "One extra set" : resumable || leadReview || plan.testDay ? "Start today's set" : `Start · ${fmt(newToday?.count ?? startCount)} questions`
        }</button>
        ${weekendSet ? `<button type="button" id="mc-weekly" class="ls-alt">Weekly review · ${fmt(weekly.length)}</button>` : ""}
        ${plan.testDay ? "" : `<button type="button" id="mc-rest" class="ls-alt" title="${
          restToday ? "Put today back into the plan" : "Take today off — the other days take on its questions"
        }">${restToday ? "Put today back" : "Take today off"}</button>`}
        ${missCount ? `<button type="button" id="mc-mistakes" class="ls-alt">Error log · ${fmt(missCount)}</button>` : ""}
        <button type="button" id="mc-calendar" class="ls-alt">The plan</button>
        <button type="button" id="mc-bank" class="ls-alt">The bank</button>
      </div>
    </section>

    <div class="ls-right">
      <section class="ls-card ls-cal">
        <div class="ls-h"><h2>${escapeHtml(now.toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</h2>
          <button type="button" id="mc-nexttest" class="ls-tag ls-tag-btn">${nextTest ? (nextTest.isToday ? "test today" : `test ${nextTest.number} · ${escapeHtml(shortDate(nextTest.date))}`) : "the plan"}</button></div>
        <div class="mc-week" id="mc-week"></div>
        <div class="mc-week-foot" id="mc-week-foot"></div>
      </section>

      <section class="ls-card ls-output">
        <div class="ls-h"><h2>Output</h2><span class="ls-tag">Bluebook</span></div>
        <div class="ls-out">
          <span class="ls-ic ls-ic-y">★</span>
          <div><b>${best ? best.total : "—"}</b><span>${best ? `best of ${scores.length} · ${best.rw} R&amp;W / ${best.math} Math` : "no test sat yet"}</span></div>
          <button type="button" id="mc-score" class="ls-chip">${best ? (best.total >= 1500 ? "outstanding" : best.total >= 1350 ? "strong" : "keep going") : "log a score"}</button>
        </div>
      </section>
    </div>

    <section class="ls-card ls-coverage">
      <div class="ls-h"><h2>Coverage</h2>
        <span class="ls-legend"><i class="rw"></i>Reading &amp; Writing <i class="math"></i>Math <i class="un"></i>not yet seen</span></div>
      <div class="ls-mosaic"><canvas id="mc-mosaic" aria-label="Coverage mosaic"></canvas></div>
    </section>

    <section class="ls-card ls-pace">
      <div class="ls-h"><h2>Pace</h2><span class="ls-tag">full coverage by ${escapeHtml(shortDate(deadline))}</span></div>
      <div id="mc-pace" class="ls-fill"></div>
    </section>

    <section class="ls-card ls-skills">
      <div class="ls-h"><h2>The 29 skills</h2><span class="ls-tag">click one to drill it</span></div>
      <div id="mc-tiles" class="mc-tiles"></div>
    </section>

    <div class="ls-side">
      <section class="ls-card">
        <div class="ls-h"><h2>By difficulty</h2></div>
        <div id="mc-diff"></div>
      </section>
      <section class="ls-card">
        <div class="ls-h"><h2>Review queue</h2></div>
        <div id="mc-review-queue"></div>
      </section>
    </div>

    <section class="ls-card ls-errors">
      <div class="ls-h"><h2>Error log</h2><span class="ls-tag">every question you have got wrong</span></div>
      <div id="mc-errors"></div>
    </section>
  </div>`;

  drawActivity(root.querySelector("#mc-activity"), weekPlan(store, bank, now));
  drawOverview(root.querySelector("#mc-overview"), bank, store, cov);
  drawChallenges(root.querySelector("#mc-challenges"), plan);
  renderErrorPanel(root.querySelector("#mc-errors"), { bank, store, now, onAll: onMistakes, onOpen: onOpenMistake });
  drawMosaic(root.querySelector("#mc-mosaic"), bank, store);
  drawPace(root.querySelector("#mc-pace"), pace, cov.total);
  drawDifficulty(root.querySelector("#mc-diff"), difficulty);
  drawReviewQueue(root.querySelector("#mc-review-queue"), review, due, bank, now);
  drawWeek(root.querySelector("#mc-week"), root.querySelector("#mc-week-foot"), weekPlan(store, bank, now), onCalendar);
  drawTiles(root.querySelector("#mc-tiles"), mastery, (key) => {
    const row = mastery.find((s) => s.key === key);
    onStart({ skill: key, count: Math.max(1, Math.min(target, row.total - row.seen || target)) });
  });

  root.querySelector("#mc-start").addEventListener("click", () => onToday());
  root.querySelector("#mc-resume")?.addEventListener("click", () => onResume());
  root.querySelector("#mc-review")?.addEventListener("click", () => onReviewDue());
  root.querySelector("#mc-weekly")?.addEventListener("click", () => onWeekly());
  root.querySelector("#mc-test")?.addEventListener("click", () => onLogScore());
  root.querySelector("#mc-score")?.addEventListener("click", () => onLogScore());
  root.querySelector("#mc-calendar").addEventListener("click", () => onCalendar());
  root.querySelector("#mc-week")?.addEventListener("click", () => onCalendar());
  root.querySelector("#mc-nexttest")?.addEventListener("click", () => onCalendar());
  root.querySelector("#mc-review-queue .mc-due")?.addEventListener("click", () => onReviewDue());
  root.querySelector("#mc-bank").addEventListener("click", onBank);
  root.querySelector("#mc-mistakes")?.addEventListener("click", onMistakes);
  root.querySelector("#mc-theme")?.addEventListener("click", onTheme);
  root.querySelector("#mc-rest")?.addEventListener("click", () => onRest(!restToday));
}

// The plan, day by day, from the first day to the exam. Its own screen: it is
// a thing you look at on a Sunday to see the shape of the month, not something
// to squeeze beside the daily numbers.
export function renderCalendar(root, { bank, store, onBack, onLogScore, now = new Date() }) {
  const weeks = planCalendar(store, bank, now);
  const totals = planTotals(weeks, now);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const cell = (day) => {
    if (day.outside) return `<div class="cal-day cal-out"></div>`;
    const classes = ["cal-day"];
    if (day.isToday) classes.push("cal-today");
    if (day.isPast) classes.push("cal-past");
    if (day.met && !day.rest) classes.push("cal-met");
    if (day.rest) classes.push("cal-rest");
    if (day.practiceTest) classes.push("cal-test");
    if (day.isTestDay) classes.push("cal-exam");
    if (day.section) classes.push(`cal-${day.section}`);
    const label = day.isTestDay
      ? "The SAT"
      : day.practiceTest
        ? `Practice test ${day.practiceTest}`
        : day.rest
          ? "Day off"
          : escapeHtml(shortSection(day.section));
    const amount = day.isTestDay ? "1600" : day.score ? `${day.score.total}` : day.rest ? "—" : `${day.target}`;
    const result = day.isPast && day.done
      ? `<span class="cal-done">${day.met ? "✓" : ""}${day.done}</span>`
      : "";
    return `
      <div class="${classes.join(" ")}" title="${escapeHtml(longDate(day.date))} · ${label}${day.isTestDay ? "" : ` · ${day.target} questions`}${day.isPast && day.done ? ` · ${day.done} done` : ""}">
        <span class="cal-n">${day.firstOfMonth ? `${escapeHtml(day.month)} ` : ""}${day.dayOfMonth}</span>
        <span class="cal-label">${label}</span>
        <span class="cal-foot"><span class="cal-target">${amount}</span>${result}</span>
      </div>`;
  };

  root.innerHTML = `
  <div class="mc-bank cal-screen">
    <div class="mc-panel">
      <div class="mc-head">
        <div>
          <h4 class="mc-h4-big">The plan</h4>
          <p class="mc-sb">${totals.daysToTest} days to the SAT · ${fmt(bank.all.length)} questions to see in ${totals.daysInPlan} days · ${totals.mathDays} Math days, ${totals.readingDays} Reading and Writing days, ${totals.tests} practice tests</p>
        </div>
        <div class="mc-tools">
          <button type="button" id="back">← Mission Control</button>
          <button type="button" id="log-score">Log a Bluebook score</button>
          <span class="cal-key"><i class="k-math"></i>Math<i class="k-rw"></i>Reading &amp; Writing<i class="k-test"></i>Practice test<i class="k-exam"></i>The SAT</span>
        </div>
      </div>
      <div class="cal-grid">
        ${weekdays.map((day) => `<div class="cal-head">${day}</div>`).join("")}
        ${weeks.map((week) => week.map(cell).join("")).join("")}
      </div>
      <p class="cal-foot-note">${
        totals.daysMet
          ? `${totals.daysMet} day${totals.daysMet === 1 ? "" : "s"} finished, ${fmt(totals.questionsDone)} questions done.`
          : "Nothing done yet. The number in a box is the day's target."
      } Targets ahead are today's pace carried forward: do more than asked and every later day gets lighter, miss one and the rest pick it up. A day counts as finished when its new questions are done; reviews are extra.</p>
    </div>
  </div>`;

  root.querySelector("#back").addEventListener("click", onBack);
  root.querySelector("#log-score").addEventListener("click", () => onLogScore());
}

// Logging an official score. The Bluebook app gives each section 200 to 800;
// the total is the sum. One row per practice test, later entries replacing
// earlier ones, so a retake simply updates the number.
export function renderScoreLog(root, { store, onBack, now = new Date() }) {
  const scores = store.scores();
  const next = nextPracticeTest(now);
  const dates = practiceTestDates();
  const taken = new Set(scores.map((row) => row.test));
  const defaultTest = next?.number ?? PRACTICE_TESTS;
  const options = Array.from({ length: PRACTICE_TESTS }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${n === defaultTest ? "selected" : ""}>Bluebook Practice Test ${n} · ${shortDate(dates[n - 1])}${taken.has(n) ? " · logged" : ""}</option>`)
    .join("");
  const rows = scores
    .slice()
    .reverse()
    .map(
      (row) => `<li>
        <span class="sc-test">Test ${row.test}</span>
        <span class="sc-date">${escapeHtml(shortDate(new Date(row.at)))}</span>
        <span class="sc-parts">${row.rw} <em>R&amp;W</em> ${row.math} <em>Math</em></span>
        <span class="sc-total">${row.total}</span>
        <button type="button" class="sc-remove" data-test="${row.test}" title="Remove this score">✕</button>
      </li>`
    )
    .join("");
  const best = scores.reduce((top, row) => (row.total > (top?.total ?? -1) ? row : top), null);
  root.innerHTML = `
  <div class="mc-bank sc-screen">
    <div class="mc-panel">
      <div class="mc-head">
        <div>
          <h4 class="mc-h4-big">Bluebook scores</h4>
          <p class="mc-sb">${
            scores.length
              ? `${scores.length} logged · best ${best.total} · latest ${scores[scores.length - 1].total}. The goal is 1600.`
              : "Take the official practice tests in the Bluebook app, then type the scores here. They are the only real measure of where the 1600 stands."
          }</p>
        </div>
        <div class="mc-tools"><button type="button" id="back">← Mission Control</button></div>
      </div>
      <form class="sc-form" id="sc-form">
        <label>Which test<select id="sc-test">${options}</select></label>
        <label>Reading and Writing<input id="sc-rw" type="number" min="${SECTION_MIN}" max="${SECTION_MAX}" step="10" placeholder="200–800" required></label>
        <label>Math<input id="sc-math" type="number" min="${SECTION_MIN}" max="${SECTION_MAX}" step="10" placeholder="200–800" required></label>
        <label>Date<input id="sc-date" type="date" value="${dayKey(now)}" required></label>
        <label class="sc-wide">Note, if any<input id="sc-note" type="text" maxlength="120" placeholder="what went wrong, what to look at"></label>
        <button type="submit" class="sc-save">Save score</button>
        <span class="sc-msg" id="sc-msg"></span>
      </form>
      ${rows ? `<ul class="sc-list">${rows}</ul>` : ""}
      <p class="cal-foot-note">Bluebook reports each section from 200 to 800. Type the two section scores; the total is added for you. Logging a test again replaces the earlier entry.</p>
    </div>
  </div>`;

  root.querySelector("#back").addEventListener("click", onBack);
  const form = root.querySelector("#sc-form");
  const msg = root.querySelector("#sc-msg");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const rw = Number(root.querySelector("#sc-rw").value);
    const math = Number(root.querySelector("#sc-math").value);
    const within = (n) => Number.isInteger(n) && n >= SECTION_MIN && n <= SECTION_MAX && n % 10 === 0;
    if (!within(rw) || !within(math)) {
      msg.textContent = "Each section is a multiple of ten between 200 and 800.";
      return;
    }
    const [y, m, d] = root.querySelector("#sc-date").value.split("-").map(Number);
    const at = new Date(y, m - 1, d, 12, 0, 0).getTime();
    store.logScore({ test: root.querySelector("#sc-test").value, rw, math, at, note: root.querySelector("#sc-note").value.trim() });
    renderScoreLog(root, { store, onBack, now });
  });
  root.querySelectorAll(".sc-remove").forEach((button) =>
    button.addEventListener("click", () => {
      store.removeScore(button.dataset.test);
      renderScoreLog(root, { store, onBack, now });
    })
  );
}

// The bank: every skill with counts and a Start of any size, plus export and
// import. Its own screen so Mission Control fits one view.
export function renderBank(root, { bank, store, onStart, onBack, now = new Date() }) {
  const mastery = masteryBySkill(store, bank);
  const cov = coverage(store, bank);
  const rows = ["rw", "math"]
    .map((section) => {
      const head = `<tr class="mc-section"><td colspan="6"><i class="dot" style="background:${SECTION_COLOR[section]}"></i>${SECTION_NAME[section]}</td></tr>`;
      const body = mastery
        .filter((s) => s.section === section)
        .map(
          (s) => `
          <tr data-skill="${escapeHtml(s.key)}">
            <td>${escapeHtml(s.skill)}<div class="mc-domain">${escapeHtml(s.domain)}</div></td>
            <td class="n">${s.total}</td>
            <td class="n">${s.counts.Easy} / ${s.counts.Medium} / ${s.counts.Hard}</td>
            <td class="n">${s.seen}</td>
            <td class="n">${s.accuracy === null ? "—" : s.accuracy + "%"}</td>
            <td><div class="mc-start"><input type="number" min="1" max="${s.total}" value="20" aria-label="questions"><button type="button">Start</button></div></td>
          </tr>`
        )
        .join("");
      return head + body;
    })
    .join("");

  root.innerHTML = `
  <div class="mc-bank">
    <div class="mc-panel">
      <div class="mc-head">
        <div><h4 class="mc-h4-big">The bank</h4><p class="mc-sb">${fmt(cov.seen)} of ${fmt(cov.total)} seen. Pick a skill, choose how many, start.</p></div>
        <div class="mc-tools">
          <button type="button" id="back">← Mission Control</button>
          <button type="button" id="export">Export progress</button>
          <button type="button" id="import">Import progress</button>
          <button type="button" id="reset" class="mc-danger">Reset everything</button>
          <input type="file" id="file" accept="application/json" hidden>
          <span id="tool-msg"></span>
        </div>
      </div>
      <table class="mc-table">
        <thead><tr><th>Skill</th><th>Total</th><th>E / M / H</th><th>Seen</th><th>Accuracy</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;

  root.querySelector("#back").addEventListener("click", onBack);
  root.querySelectorAll("tr[data-skill]").forEach((tr) => {
    tr.querySelector("button").addEventListener("click", () => {
      const count = Math.max(1, Number(tr.querySelector("input").value) || 20);
      onStart({ skill: tr.dataset.skill, count });
    });
  });
  const msg = root.querySelector("#tool-msg");
  root.querySelector("#export").addEventListener("click", () => {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sat-mastery-progress-${dayKey(now)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    msg.textContent = "Exported.";
  });
  const reset = root.querySelector("#reset");
  reset.addEventListener("click", () => {
    if (reset.dataset.armed === undefined) {
      reset.dataset.armed = "";
      reset.textContent = "Click again to erase everything";
      msg.textContent = "This clears every answer, saved set and highlight in this browser.";
      return;
    }
    store.resetAll();
    onBack();
  });
  const file = root.querySelector("#file");
  root.querySelector("#import").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    try {
      store.importJson(await file.files[0].text());
      renderBank(root, { bank, store, onStart, onBack, now });
    } catch (error) {
      msg.textContent = `Import failed: ${error.message}`;
    }
  });
}

function drawMosaic(canvas, bank, store) {
  if (!canvas) return;
  const seen = store.seen();
  const cells = [];
  for (const key of bank.skills) {
    for (const q of bank.bySkill.get(key)) cells.push({ key, section: q.section, done: seen.has(q.id) });
  }
  const ctx = canvas.getContext("2d");
  const gap = 1;
  const host = canvas.parentElement;
  let cols = 1, cell = 4;

  function draw() {
    const w = host.clientWidth, h = host.clientHeight;
    if (w < 10 || h < 10) return;
    cols = Math.max(20, Math.ceil(Math.sqrt((cells.length * w) / h)));
    const rows = Math.ceil(cells.length / cols);
    cell = Math.max(2, Math.min((w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows));
    const cssW = cols * (cell + gap) - gap, cssH = rows * (cell + gap) - gap;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const r = Math.min(1.5, cell / 3);
    const unseen = unseenColour();
    cells.forEach((c, i) => {
      const x = (i % cols) * (cell + gap), y = Math.floor(i / cols) * (cell + gap);
      ctx.fillStyle = c.done ? SECTION_COLOR[c.section] : unseen;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + cell, y, x + cell, y + cell, r);
      ctx.arcTo(x + cell, y + cell, x, y + cell, r);
      ctx.arcTo(x, y + cell, x, y, r);
      ctx.arcTo(x, y, x + cell, y, r);
      ctx.closePath();
      ctx.fill();
    });
  }
  // The first draw can run before the grid has settled or fonts have loaded,
  // and a hidden tab receives no resize observations at all, so redraw on
  // every signal that the box may have changed.
  draw();
  requestAnimationFrame(draw);
  setTimeout(draw, 250);
  if (document.fonts?.ready) document.fonts.ready.then(draw);
  new ResizeObserver(draw).observe(host);
  window.addEventListener("resize", draw);
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / (cell + gap));
    const row = Math.floor((e.clientY - rect.top) / (cell + gap));
    const i = row * cols + col;
    if (col < 0 || col >= cols || i < 0 || i >= cells.length) return;
    const key = cells[i].key;
    const inSkill = cells.filter((c) => c.key === key);
    canvas.title = `${key.split(":")[1]} · ${inSkill.filter((c) => c.done).length} of ${inSkill.length} done`;
  });
}

function drawPace(box, pace, total) {
  if (!box) return;
  const W = 320, H = 190, L = 38, R = 12, T = 12, B = 26;
  const ymax = Math.max(total, 1);
  const px = (i) => L + (i * (W - L - R)) / COVERAGE_WEEKS;
  const py = (v) => T + (1 - v / ymax) * (H - T - B);
  const grid = [0, 0.5, 1].map((f) => Math.round(ymax * f));
  const plannedPath = pace.planned.map((v, i) => `${i ? "L" : "M"}${px(i)} ${py(v)}`).join(" ");
  const points = pace.actual.map((v, i) => (v === null ? null : [px(i), py(v), v, i])).filter(Boolean);
  const actualPath = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const last = points[points.length - 1];
  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative questions versus plan" preserveAspectRatio="xMidYMid meet">
      ${grid.map((v) => `<line x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}" class="mc-gl"/><text x="${L - 6}" y="${py(v) + 3}" class="mc-ax" text-anchor="end">${v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v}</text>`).join("")}
      ${[0, 2, 4, 6, 8].map((i) => `<text x="${px(i)}" y="${H - 8}" class="mc-ax" text-anchor="middle">wk ${i}</text>`).join("")}
      <path d="${plannedPath}" fill="none" class="mc-plan-line" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>
      ${points.length > 1 ? `<path d="${actualPath}" fill="none" class="mc-you-line" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
      ${points.map(([x, y, v, i]) => `<circle cx="${x}" cy="${y}" r="4.5" class="mc-you-dot" stroke-width="2"><title>Week ${i}: ${v.toLocaleString()} done · plan ${pace.planned[i].toLocaleString()}</title></circle>`).join("")}
      ${last ? `<text x="${last[0] + 5}" y="${last[1] - 9}" class="mc-you-tag" font-size="11" font-weight="700">you</text>` : ""}
    </svg>`;
}

function drawTiles(box, mastery, onPick) {
  const ordered = mastery.slice().sort((a, b) => (a.section === b.section ? 0 : a.section === "rw" ? -1 : 1));
  box.innerHTML = ordered
    .map((s) => {
      const v = s.accuracy;
      return `<button type="button" class="mc-tile" data-skill="${escapeHtml(s.key)}" style="--accent:${SECTION_COLOR[s.section]}"
        title="${escapeHtml(s.skill)} · ${s.seen} of ${s.total} seen · ${v === null ? "not started" : v + "% on " + s.attempts + " attempts"} · click to drill">
        <span class="mc-tname">${escapeHtml(shortName(s.skill))}</span>
        <span class="mc-tfoot"><span class="mc-tval">${v === null ? "—" : v + "%"}</span><span class="mc-tseen">${s.seen}/${s.total}</span></span>
        <span class="mc-tbar"><span style="width:${v === null ? 0 : v}%;background:${shade(v) ?? "transparent"}"></span></span>
      </button>`;
    })
    .join("");
  box.querySelectorAll(".mc-tile").forEach((el) => el.addEventListener("click", () => onPick(el.dataset.skill)));
}

function drawDifficulty(box, difficulty) {
  if (!box) return;
  const any = Object.values(difficulty).some((d) => d.attempts);
  if (!any) {
    box.innerHTML = `<div class="mc-empty"><span>🎯</span>Fills in with your first set.</div>`;
    return;
  }
  box.innerHTML = ["Easy", "Medium", "Hard"]
    .map((level) => {
      const d = difficulty[level];
      const pct = d.attempts ? Math.round((100 * d.correct) / d.attempts) : null;
      return `<div class="mc-drow" title="${level}: ${d.correct} of ${d.attempts} correct">
        <span class="mc-dname">${level}</span>
        <span class="mc-mtrack">${pct === null ? "" : `<span class="mc-mfill" style="width:${pct}%;background:${shade(pct)}"></span>`}</span>
        <span class="mc-mval">${pct === null ? "—" : pct + "%"}</span>
        <span class="mc-dn">${d.attempts ? `${d.correct}/${d.attempts}` : ""}</span></div>`;
    })
    .join("");
}

function drawReviewQueue(box, review, due, bank, now) {
  if (!box) return;
  if (!review.due && !review.upcoming && !review.retired) {
    box.innerHTML = `<div class="mc-empty"><span>🗂</span>Miss one and it comes back in two days.</div>`;
    return;
  }
  const nextIn = review.nextDue === null ? null : Math.max(1, Math.round((review.nextDue - new Date(now).setHours(0, 0, 0, 0)) / 86400000));
  const skills = new Map();
  for (const id of due.slice(0, 40)) {
    const question = bank.byId.get(id);
    if (question) skills.set(question.skill, (skills.get(question.skill) ?? 0) + 1);
  }
  const worst = [...skills].sort((a, b) => b[1] - a[1])[0];
  // The panel is short, so only rows that say something get a line.
  const rows = [
    review.upcoming ? ["Coming back", `${review.upcoming.toLocaleString()}${nextIn ? ` · in ${nextIn}d` : ""}`] : null,
    worst ? ["Most owed", shortName(worst[0])] : null,
    review.retired ? ["Retired", review.retired.toLocaleString()] : null,
  ].filter(Boolean).slice(0, 2);
  box.innerHTML = `
    <button type="button" class="mc-due" ${review.due ? "" : "disabled"} title="${review.due ? "Start the review set" : "Nothing owed today"}">
      <span class="mc-due-n">${review.due.toLocaleString()}</span><span class="mc-due-l">due today</span>
    </button>
    <ul class="mc-queue">${rows.map(([k, v]) => `<li><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></li>`).join("")}</ul>`;
}

// Seven days, Monday to Sunday: what each asks for, what was done, and where
// today sits. Targets ahead are today's rate carried forward, so a heavy day
// visibly lightens the rest of the week and a missed one visibly loads it.
function drawWeek(box, foot, week, onCalendar) {
  if (!box) return;
  const weekday = (date) => date.toLocaleDateString("en-US", { weekday: "short" });
  box.innerHTML = week.days
    .map((day) => {
      if (day.outside) return `<div class="mc-wd mc-wd-out"><span class="mc-wd-n">${escapeHtml(weekday(day.date))}</span></div>`;
      const classes = ["mc-wd"];
      if (day.isToday) classes.push("today");
      if (day.isPast) classes.push("past");
      if (day.met) classes.push("met");
      if (day.rest) classes.push("rest");
      if (day.practiceTest) classes.push("test");
      if (day.isTestDay) classes.push("exam");
      if (day.section) classes.push(day.section);
      const what = day.isTestDay ? "SAT" : day.practiceTest ? `Test ${day.practiceTest}` : day.rest ? "Off" : day.section === "math" ? "Math" : "R&W";
      const figure = day.rest
        ? (day.done ? `<b>${day.done}</b>` : "—")
        : day.isTestDay
        ? "1600"
        : day.score
          ? `${day.score.total}`
          : day.practiceTest
            ? "—"
            : day.isPast || day.isToday
              ? `<b>${day.done}</b><i>/${day.target}</i>`
              : `${day.target}`;
      const title = day.rest
        ? `${longDate(day.date)} · taken off${day.done ? ` · ${day.done} done anyway` : ""}`
        : `${longDate(day.date)} · ${what}${day.isTestDay ? "" : ` · ${day.target} questions`}${day.done ? ` · ${day.done} done` : ""}`;
      return `<div class="${classes.join(" ")}" title="${escapeHtml(title)}">
        <span class="mc-wd-n">${escapeHtml(weekday(day.date))} ${day.dayOfMonth}</span>
        <span class="mc-wd-what">${what}</span>
        <span class="mc-wd-fig">${day.met && !day.score ? "✓ " : ""}${figure}</span>
      </div>`;
    })
    .join("");
  foot.innerHTML = `<span>${fmt(week.done)} of ${fmt(week.planned)} this week</span><button type="button" class="mc-link">Whole plan →</button>`;
  foot.querySelector(".mc-link").addEventListener("click", (event) => { event.stopPropagation(); onCalendar(); });
}

// ── the dashboard's own three drawings ──────────────────────────────────────

// Seven bars, one per day of this week: how much of the day's target was
// actually done. A day still ahead shows its target as an outline, so the week
// reads as a plan and a record at once rather than only one of them.
function drawActivity(box, week) {
  if (!box) return;
  const weekday = (date) => date.toLocaleDateString("en-US", { weekday: "short" });
  box.innerHTML = week.days
    .map((day) => {
      if (day.outside) return `<div class="ls-bar is-out"><span class="ls-track"></span><span class="ls-day">${escapeHtml(weekday(day.date))}</span></div>`;
      // A day that holds an official test is not a day of questions from the
      // bank, and counting its 98 against the bank's target would say the
      // Saturday asks for ninety-eight when the calendar beside it says "Test 1".
      const held = day.isTestDay || Boolean(day.practiceTest) || Boolean(day.rest);
      const share = held ? (day.score ? 100 : 0) : day.target ? Math.min(100, Math.round((100 * day.done) / day.target)) : day.done ? 100 : 0;
      const classes = ["ls-bar"];
      if (day.isToday) classes.push("is-today");
      if (day.met) classes.push("is-met");
      if (held) classes.push("is-held");
      if (day.rest) classes.push("is-off");
      if (!day.isPast && !day.isToday) classes.push("is-ahead");
      if (day.section && !held) classes.push(day.section);
      const label = held
        ? day.rest ? "Off" : day.isTestDay ? "SAT" : `T${day.practiceTest}`
        : day.isPast || day.isToday ? `${share}%` : day.target;
      const title = held
        ? day.rest
          ? `${longDate(day.date)} · taken off`
          : `${longDate(day.date)} · ${day.isTestDay ? "the SAT" : `Bluebook practice test ${day.practiceTest}`}`
        : `${longDate(day.date)} · ${day.done} of ${day.target} done`;
      return `<div class="${classes.join(" ")}" title="${escapeHtml(title)}">
        <span class="ls-track"><span class="ls-barfill" style="height:${held ? 100 : Math.max(share, share ? 12 : 0)}%"></span>
          <span class="ls-pct">${label}</span></span>
        <span class="ls-day">${escapeHtml(weekday(day.date))}</span>
      </div>`;
    })
    .join("");
}

// The ring: what has been met, split by section, against what has not. The
// legend carries the same three numbers in words, because a ring alone can be
// read for a mood but not for a figure.
function drawOverview(box, bank, store, cov) {
  if (!box) return;
  const seen = store.seen();
  const totals = { rw: 0, math: 0 };
  const done = { rw: 0, math: 0 };
  for (const question of bank.all) {
    totals[question.section] += 1;
    if (seen.has(question.id)) done[question.section] += 1;
  }
  const R = 62;
  const C = 2 * Math.PI * R;
  const share = (n) => (cov.total ? (n / cov.total) * C : 0);
  const rw = share(done.rw);
  const math = share(done.math);
  const pct = cov.seen === 0 ? "0" : cov.percent < 10 ? ((100 * cov.seen) / cov.total).toFixed(1) : String(cov.percent);
  const accuracy = (section) => {
    const rows = store.attempts.filter((a) => bank.byId.get(a.id)?.section === section);
    return rows.length ? Math.round((100 * rows.filter((a) => a.correct).length) / rows.length) : null;
  };

  box.innerHTML = `
    <div class="ls-ring">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r="${R}" class="ls-ring-track"/>
        <circle cx="80" cy="80" r="${R}" class="ls-ring-rw" stroke-dasharray="${rw} ${C - rw}" transform="rotate(-90 80 80)"/>
        <circle cx="80" cy="80" r="${R}" class="ls-ring-math" stroke-dasharray="${math} ${C - math}"
                stroke-dashoffset="${-rw}" transform="rotate(-90 80 80)"/>
      </svg>
      <div class="ls-ring-mid"><b>${pct}%</b><span>${fmt(cov.seen)} of ${fmt(cov.total)}</span></div>
    </div>
    <ul class="ls-key">
      <li><span class="k"><i class="rw"></i>Reading &amp; Writing</span><b>${fmt(done.rw)}<em>/${fmt(totals.rw)}</em></b>
          <span class="d">${accuracy("rw") === null ? "—" : accuracy("rw") + "% right"}</span></li>
      <li><span class="k"><i class="math"></i>Math</span><b>${fmt(done.math)}<em>/${fmt(totals.math)}</em></b>
          <span class="d">${accuracy("math") === null ? "—" : accuracy("math") + "% right"}</span></li>
      <li><span class="k"><i class="un"></i>Not yet seen</span><b>${fmt(cov.total - cov.seen)}</b>
          <span class="d">${fmt(Math.max(0, cov.total - cov.seen))} to go</span></li>
    </ul>`;
}

// Today, as things to finish rather than a list of facts: a ring that fills as
// the day's work goes in, and a word for where each one stands.
function drawChallenges(box, plan) {
  if (!box) return;
  box.innerHTML = plan.items
    .map((item) => {
      const target = item.target ?? item.count ?? 0;
      const finished = item.finished ?? (item.done ? target : 0);
      const pct = item.done ? 100 : target ? Math.max(0, Math.min(100, Math.round((100 * finished) / target))) : 0;
      const state = item.done ? "done" : "going";
      const R = 13;
      const C = 2 * Math.PI * R;
      return `<div class="ls-row ${item.done ? "is-done" : ""}">
        <span class="ls-dial">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="${R}" class="ls-dial-track"/>
            <circle cx="16" cy="16" r="${R}" class="ls-dial-fill" stroke-dasharray="${(pct / 100) * C} ${C}" transform="rotate(-90 16 16)"/>
          </svg>
          ${item.done ? `<i>✓</i>` : ""}
        </span>
        <span class="ls-row-l">${escapeHtml(item.label)}<em>${escapeHtml(item.note)}</em></span>
        <span class="ls-row-n">${item.done ? "" : `${fmt(finished)}/${fmt(target)} · ${planHours(item.minutes)}`}</span>
        <span class="ls-state ${state}">${item.done ? "Complete" : "On going"}</span>
      </div>`;
    })
    .join("");
}
