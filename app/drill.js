import { answerForms, grade } from "./grade.js?v=dcf29171";
import { coachingFor, desmosFor, stepPicture } from "./coaching.js?v=dcf29171";
import { escapeHtml } from "./html.js?v=dcf29171";
import { imageAttrs } from "./assets.js?v=dcf29171";

const LETTERS = ["A", "B", "C", "D"];
// The drill budgets 90 seconds a question, roughly the real test's Math pace.
const SECONDS_PER_QUESTION = 90;
const SECTION_NAME = { rw: "Reading and Writing", math: "Math" };
// Highlight styles, in the order Bluebook offers them.
const HL_STYLES = ["yellow", "pink", "blue", "under"];

// Turn the module list into spans over the question list, so the question
// index alone says which module you are in and where it started.
function moduleSpans(modules) {
  let start = 0;
  return modules.map((module, index) => {
    const span = { ...module, start, end: start + module.count, number: index + 1 };
    start += module.count;
    return span;
  });
}

function moduleIndexAt(spans, index) {
  const found = spans.findIndex((span) => index < span.end);
  return found === -1 ? spans.length - 1 : found;
}

function clock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Show the image when one exists, otherwise the text. Math text is incomplete
// because its equations are art; R&W text is complete unless a figure or an
// underline forced an image.
function content(text, image, className) {
  if (image) return `<img class="${className}" ${imageAttrs(image)} alt="">`;
  return escapeHtml(text);
}

// The passage as blocks: R&W stems carry their paragraphs and question apart,
// the way the test shows them; anything else is one block of the stem.
function blocksOf(q) {
  if (q.section === "rw" && q.passage?.length) return q.passage;
  return [{ kind: "p", text: q.stem }];
}

// Highlights are spans of character offsets into the passage text, blocks
// joined by a newline. Rendering splits each block's text at every highlight
// boundary; the latest highlight wins where two overlap.
function markup(text, base, highlights) {
  const cuts = new Set([0, text.length]);
  for (const h of highlights) {
    for (const x of [h.s, h.e]) {
      const r = x - base;
      if (r > 0 && r < text.length) cuts.add(r);
    }
  }
  const points = [...cuts].sort((a, b) => a - b);
  let html = "";
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], at = base + a;
    let hit = -1;
    highlights.forEach((h, index) => { if (h.s <= at && at < h.e) hit = index; });
    const segment = escapeHtml(text.slice(a, b));
    html += hit >= 0 ? `<mark class="hl hl-${highlights[hit].c}" data-hl="${hit}">${segment}</mark>` : segment;
  }
  return html;
}

function renderBlocks(blocks, highlights) {
  let offset = 0;
  const out = [];
  let listOpen = false;
  for (const block of blocks) {
    const inner = markup(block.text, offset, highlights);
    if (block.kind === "li") {
      if (!listOpen) { out.push('<ul class="bb-notes">'); listOpen = true; }
      out.push(`<li data-off="${offset}">${inner}</li>`);
    } else {
      if (listOpen) { out.push("</ul>"); listOpen = false; }
      out.push(block.kind === "h" ? `<h5 class="bb-h" data-off="${offset}">${inner}</h5>` : `<p data-off="${offset}">${inner}</p>`);
    }
    offset += block.text.length + 1;
  }
  if (listOpen) out.push("</ul>");
  return out.join("");
}

// Character offset of a DOM position inside the passage, or null if the
// position is outside it. Walks the text nodes of the enclosing block so
// existing <mark> wrappers do not disturb the count.
function offsetAt(node, offset, container) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (offset < node.childNodes.length) {
      node = node.childNodes[offset];
      offset = 0;
      while (node.nodeType === Node.ELEMENT_NODE && node.firstChild) node = node.firstChild;
    } else {
      while (node.nodeType === Node.ELEMENT_NODE && node.lastChild) node = node.lastChild;
      offset = node.nodeType === Node.TEXT_NODE ? node.length : 0;
    }
  }
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const block = node.parentElement?.closest("[data-off]");
  if (!block || !container.contains(block)) return null;
  let sum = 0;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (t === node) break;
    sum += t.length;
  }
  return Number(block.dataset.off) + sum + offset;
}

// A set can be paused, saved and resumed. Pausing stops both clocks and covers
// the question, the way a break does on the real test. Every answer is saved,
// so closing the tab loses nothing.
export function startDrill(root, { bank, store, questions, title, onDone, onPause, onSaved = null, mode = "work", modules = null, resume = null, ephemeral = false }) {
  // A practice test is timed module by module, as on the day: the clock
  // restarts at each module and time cannot be carried across. Everything
  // else runs on one clock for the whole set.
  const isTest = mode === "test";
  const spans = modules ? moduleSpans(modules) : null;
  const budgetAt = (index) =>
    spans ? spans[moduleIndexAt(spans, index)].minutes * 60_000 : questions.length * SECONDS_PER_QUESTION * 1000;
  // How much of this module's clock has already run down, restored on resume.
  const clockSpent = resume ? Math.max(0, budgetAt(resume.index ?? 0) - resume.remainingMs) : 0;
  const state = {
    index: clampToSet(resume?.index ?? 0),
    // One entry per question, so an answer survives navigating away and back.
    answers: sized(resume?.answers, null),
    crossed: sized(resume?.crossed, null).map((list) => new Set(list ?? [])),
    marked: new Set(resume?.marked ?? []),
    // Milliseconds spent looking at each question, accumulated as you move.
    spent: sized(resume?.spent, 0).map((ms) => Number(ms) || 0),
    // "answering" while the module is open, "review" on its review page,
    // "results" once it has been submitted and marked.
    phase: resume?.phase === "results" ? "results" : resume?.phase === "review" ? "review" : "answering",
    results: resume?.results?.length ? resume.results.slice() : null,
    navOpen: false,
    abc: false,
    hideTimer: false,
    annotate: true,
    zoom: false,
    paused: false,
    pausedAt: 0,
    pausedTotal: 0,
    clockStartedAt: Date.now() - clockSpent,
    questionStartedAt: Date.now(),
  };

  function sized(saved, fill) {
    const list = Array.isArray(saved) ? saved.slice(0, questions.length) : [];
    while (list.length < questions.length) list.push(fill);
    return list;
  }

  function clampToSet(index) {
    return Math.max(0, Math.min(Number(index) || 0, questions.length - 1));
  }

  let ticker = null;
  let popover = null;

  function current() {
    return questions[state.index];
  }

  function remainingMs() {
    const pausedNow = state.paused ? Date.now() - state.pausedAt : 0;
    return budgetAt(state.index) - (Date.now() - state.clockStartedAt - state.pausedTotal - pausedNow);
  }

  function moduleNow() {
    return spans ? spans[moduleIndexAt(spans, state.index)] : null;
  }

  // On the real test you may move freely inside a module and never back into
  // one you have submitted. A drill is a single module, so this is the whole
  // set; a practice test is bounded by the module you are in.
  function bounds() {
    const m = moduleNow();
    return m ? { start: m.start, end: m.end } : { start: 0, end: questions.length };
  }

  function answered(index) {
    const value = state.answers[index];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  // Time is charged to the question you are leaving, so the per-question
  // seconds in the record are real even when you jump about.
  function chargeTime() {
    if (state.paused) return;
    state.spent[state.index] += Date.now() - state.questionStartedAt;
    state.questionStartedAt = Date.now();
  }

  function persist() {
    if (ephemeral) return;
    store.saveSession({
      title,
      mode,
      ids: questions.map((q) => q.id),
      index: state.index,
      answers: state.answers,
      crossed: state.crossed.map((set) => [...set]),
      marked: [...state.marked],
      spent: state.spent,
      phase: state.phase,
      results: state.results ?? [],
      remainingMs: remainingMs(),
    });
  }

  function render() {
    if (state.phase === "review") return renderReview();
    const q = current();
    const n = state.index + 1;
    const isSpr = q.format === "spr";
    const done = state.phase === "results";
    const result = done ? state.results?.[state.index] : null;
    const split = q.section === "rw" && Boolean(q.prompt);
    const highlights = store.highlightsFor(q.id);
    const picked = state.answers[state.index];
    const crossed = state.crossed[state.index];

    const choices = isSpr
      ? `<div class="bb-spr"><label for="spr">Answer</label><input id="spr" autocomplete="off" inputmode="decimal" ${done ? "disabled" : ""}></div>`
      : LETTERS.map((L) => {
          const classes = ["bb-ch"];
          if (crossed.has(L)) classes.push("gone");
          if (!done && picked === L) classes.push("sel");
          if (done && L === q.correct) classes.push("right");
          if (done && picked === L && L !== q.correct) classes.push("wrong");
          return `
            <div class="${classes.join(" ")}" data-letter="${L}" role="button" tabindex="0">
              <div class="bb-let">${L}</div>
              <div class="bb-txt">${content(q.choices[L] ?? "", q.choiceImages?.[L], "choice")}</div>
              <div class="bb-strike" data-strike="${L}" title="Cross out">${L}</div>
            </div>`;
        }).join("");

    const stem = q.stemImage
      ? `<img class="stem" id="stem-image" ${imageAttrs(q.stemImage)} alt="" title="Click to enlarge">`
      : `<div class="bb-passage" id="passage">${renderBlocks(blocksOf(q), highlights)}</div>`;
    const head = `
      <div class="bb-qhead">
        <div class="bb-num">${n}</div>
        <button type="button" class="bb-mark ${state.marked.has(q.id) ? "on" : ""}" id="mark">🔖 Mark for Review</button>
        ${isSpr || done ? "" : `<button type="button" class="bb-abc ${state.abc ? "on" : ""}" id="abc">ABC</button>`}
      </div>`;
    const main = split
      ? `<div class="bb-main bb-split ${q.stemImage ? "bb-figure" : ""} ${state.zoom ? "bb-zoom" : ""}">
           <div class="bb-left">${stem}</div>
           <div class="bb-right">${head}<div class="bb-prompt">${escapeHtml(q.prompt)}</div><div id="choices">${choices}</div></div>
         </div>`
      : `<div class="bb-main">${head}<div class="bb-stem">${stem}</div><div id="choices">${choices}</div></div>`;

    root.innerHTML = `
      <div class="bb ${state.abc ? "abc-on" : ""}">
        <div class="bb-top">
          <div><div class="bb-mod">${escapeHtml(moduleNow()?.label ?? `${SECTION_NAME[q.section]} · ${title}`)}</div><div class="bb-dir">${done ? "Reviewing your answers" : "Directions ⌄"}</div></div>
          <div class="bb-timer">
            ${done ? `<div class="t done">${scoreLine()}</div>`
                   : `<div class="t ${state.hideTimer ? "hidden" : ""}" id="clock">${clock(remainingMs())}</div>
                      <div class="bb-timer-btns">
                        <button type="button" class="h" id="hide">${state.hideTimer ? "Show" : "Hide"}</button>
                        <button type="button" class="h" id="pause">${state.paused ? "Resume" : "Pause"}</button>
                      </div>`}
          </div>
          <div class="bb-tools">
            ${q.section === "math" ? "<div><span>🖩</span>Calculator</div><div><span>📖</span>Reference</div>" : ""}
            ${q.stemImage ? "" : `<div class="${state.annotate ? "on" : ""}" id="annotate" role="button" title="Select text to highlight it"><span>🖍</span>Highlights &amp; Notes</div>`}
            <div><span>⋯</span>More</div>
          </div>
        </div>
        ${main}
        <div id="feedback"></div>
        ${bottomBar(q, n, done)}
        ${state.navOpen ? navigator(done) : ""}
        ${state.paused ? `
        <div class="bb-pause" role="dialog" aria-label="Paused">
          <div class="bb-pause-card">
            <div class="bb-pause-kick">Paused</div>
            <div class="bb-pause-t">${clock(remainingMs())} left · question ${n} of ${questions.length}</div>
            <p>Take your time. Nothing is lost while you're away, and your set is saved if you leave.</p>
            <button type="button" class="bb-btn" id="resume">Resume</button>
            <button type="button" class="bb-btn ghost" id="save-paused">Save &amp; exit</button>
          </div>
        </div>` : ""}
      </div>`;

    if (done && result) renderFeedback(q);
    bind(q, isSpr, done);
  }

  // Right out of what was actually answered, with the blanks said plainly.
  function scoreLine() {
    const graded = state.results.filter((r) => r && !r.skipped);
    const blank = state.results.filter((r) => r && r.skipped).length;
    const right = graded.filter((r) => r.correct).length;
    return `${right} / ${graded.length}${blank ? ` · ${blank} blank` : ""}`;
  }

  // Save and exit, where you are, and where to go next. On the real test the
  // counter in the middle opens the list of questions; so does this.
  function bottomBar(q, n, done) {
    const { start, end } = bounds();
    const m = moduleNow();
    const where = m
      ? `Question ${n - m.start} of ${m.count}`
      : `Question ${n} of ${questions.length}`;
    const atLast = state.index >= end - 1;
    const nextLabel = done ? (atLast ? "Finish" : "Next →") : atLast ? "Review" : "Next →";
    return `
      <div class="bb-bot">
        <div>
          ${done ? "" : `<button type="button" class="bb-btn ghost" id="save">Save &amp; exit</button>`}
          <span class="bb-name">${escapeHtml(q.difficulty)} · ${escapeHtml(q.id)}</span>
        </div>
        <button type="button" class="bb-count" id="nav" aria-expanded="${state.navOpen}">${where} ${state.navOpen ? "▾" : "▴"}</button>
        <div>
          <button type="button" class="bb-btn ghost" id="back" ${state.index <= start ? "disabled" : ""}>← Back</button>
          <button type="button" class="bb-btn" id="next">${nextLabel}</button>
        </div>
      </div>`;
  }

  // The question list: answered, unanswered, marked, or once submitted right
  // and wrong. Click any square to go straight there.
  function navigator(done) {
    const { start, end } = bounds();
    const squares = [];
    for (let i = start; i < end; i++) {
      squares.push(square(i, done));
    }
    return `
      <div class="bb-nav" id="nav-panel">
        <div class="bb-nav-card">
          <div class="bb-nav-head">${escapeHtml(moduleNow()?.label ?? title)}</div>
          <div class="bb-nav-grid">${squares.join("")}</div>
          <div class="bb-nav-key">
            <span><i class="k-cur"></i>where you are</span>
            <span><i class="k-ans"></i>${done ? "correct" : "answered"}</span>
            <span><i class="k-none"></i>${done ? "wrong" : "not yet"}</span>
            ${done ? `<span><i class="k-blank"></i>left blank</span>` : ""}
            <span><i class="k-mark"></i>marked</span>
          </div>
          ${done ? "" : `<button type="button" class="bb-btn" id="to-review">Go to review page</button>`}
        </div>
      </div>`;
  }

  function square(i, done) {
    const m = moduleNow();
    const label = m ? i - m.start + 1 : i + 1;
    const classes = ["bb-sq"];
    if (i === state.index) classes.push("cur");
    if (done) classes.push(state.results?.[i]?.skipped ? "blank" : state.results?.[i]?.correct ? "ok" : "no");
    else if (answered(i)) classes.push("ans");
    if (state.marked.has(questions[i].id)) classes.push("mark");
    return `<button type="button" class="${classes.join(" ")}" data-go="${i}">${label}</button>`;
  }

  // The review page, as on the test: everything in this module at a glance,
  // then the one button that submits it.
  function renderReview() {
    const { start, end } = bounds();
    const m = moduleNow();
    const total = end - start;
    let doneCount = 0;
    const squares = [];
    for (let i = start; i < end; i++) {
      if (answered(i)) doneCount += 1;
      squares.push(square(i, false));
    }
    const left = total - doneCount;
    const markedHere = [...Array(total).keys()].filter((k) => state.marked.has(questions[start + k].id)).length;
    root.innerHTML = `
      <div class="bb">
        <div class="bb-top">
          <div><div class="bb-mod">${escapeHtml(m?.label ?? `${SECTION_NAME[questions[state.index].section]} · ${title}`)}</div><div class="bb-dir">Review page</div></div>
          <div class="bb-timer">
            <div class="t ${state.hideTimer ? "hidden" : ""}" id="clock">${clock(remainingMs())}</div>
            <div class="bb-timer-btns">
              <button type="button" class="h" id="hide">${state.hideTimer ? "Show" : "Hide"}</button>
              <button type="button" class="h" id="pause">${state.paused ? "Resume" : "Pause"}</button>
            </div>
          </div>
          <div class="bb-tools"><div><span>⋯</span>More</div></div>
        </div>
        <div class="bb-main bb-reviewpage">
          <h2>Check your work</h2>
          <p class="bb-review-sub">${
            left === 0
              ? `All ${total} answered${markedHere ? `, ${markedHere} marked for review` : ""}. Nothing is marked right or wrong until you submit.`
              : `${doneCount} of ${total} answered · <strong>${left} still blank</strong>${markedHere ? ` · ${markedHere} marked for review` : ""}. Click any number to go back to it.`
          }</p>
          <div class="bb-nav-grid big">${squares.join("")}</div>
          <div class="bb-nav-key">
            <span><i class="k-ans"></i>answered</span>
            <span><i class="k-none"></i>not yet</span>
            <span><i class="k-mark"></i>marked for review</span>
          </div>
        </div>
        <div class="bb-bot">
          <div>
            <button type="button" class="bb-btn ghost" id="save">Save &amp; exit</button>
            <span class="bb-name">nothing is graded until you submit</span>
          </div>
          <button type="button" class="bb-count" id="back-to-q">← Back to the questions</button>
          <div>
            <button type="button" class="bb-btn" id="submit">${spans && moduleNow().number < spans.length ? `Submit module ${moduleNow().number}` : "Submit and see how you did"}</button>
          </div>
        </div>
        ${state.paused ? `
        <div class="bb-pause" role="dialog" aria-label="Paused">
          <div class="bb-pause-card">
            <div class="bb-pause-kick">Paused</div>
            <div class="bb-pause-t">${clock(remainingMs())} left</div>
            <p>Take your time. Nothing is lost while you're away, and your set is saved if you leave.</p>
            <button type="button" class="bb-btn" id="resume">Resume</button>
            <button type="button" class="bb-btn ghost" id="save-paused">Save &amp; exit</button>
          </div>
        </div>` : ""}
      </div>`;
    bindCommon();
    root.querySelector("#back-to-q").addEventListener("click", () => { state.phase = "answering"; render(); });
    root.querySelector("#submit").addEventListener("click", submit);
    root.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", () => goTo(Number(el.dataset.go), { leaveReview: true }))
    );
  }

  function renderFeedback(q) {
    const result = state.results[state.index];
    const forms = answerForms(q);
    const coach = coachingFor(q);
    const desmos = desmosFor(q);
    root.querySelector("#feedback").innerHTML = `
      <div class="fb">
        <div class="verdict ${result.correct ? "right" : result.skipped ? "blank" : "wrong"}">${
          result.skipped ? "Left blank" : result.correct ? "Correct" : "Incorrect"
        } · answer ${escapeHtml(forms.join(" or "))}${result.correct || result.skipped ? "" : ` · you put ${escapeHtml(result.response ?? "nothing")}`}${
          result.skipped ? " · not recorded, so it will come round again" : ""
        }</div>
        ${q.coach ? tutor(q, result) : ""}
        ${thisQuestion(q, result)}
        ${coach ? `<details class="fb-fold"><summary>The method for every ${escapeHtml(q.skill)} question</summary>${method(coach)}</details>` : ""}
        ${desmos ? `<details class="fb-fold"><summary>In Desmos, step by step</summary>${desmosBlock(desmos)}</details>` : ""}
      </div>`;
  }

  // A tutor's route through this one question: what it is really asking,
  // the steps to the answer, the trap, a five-second check, and the Desmos
  // keystrokes when they beat working by hand. Written ahead of time by
  // tools/coach.py from the question, the key and the official rationale.
  function tutor(q, result) {
    const c = q.coach;
    const picked = result.response;
    const wrongPicked = q.format === "mcq" && picked && picked !== q.correct && c.whyWrong?.[picked];
    return `
      <h4>How to get there</h4>
      <p class="fb-gist">${escapeHtml(c.gist)}</p>
      ${wrongPicked ? `<p class="fb-picked"><em>You chose ${escapeHtml(picked)}.</em> ${escapeHtml(c.whyWrong[picked])}</p>` : ""}
      <ol class="fb-route">${c.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <div class="fb-twin">
        <p class="fb-trap"><span>The trap</span>${escapeHtml(c.trap)}</p>
        <p class="fb-check"><span>Check it</span>${escapeHtml(c.check)}</p>
      </div>
      ${c.desmos?.length ? `<p class="fb-keys-line"><span>In Desmos</span>${c.desmos.map((k) => `<code>${escapeHtml(k)}</code>`).join(" ")}</p>` : ""}`;
  }

  // What is true of this question and no other: why the right answer is
  // right, why the one you chose is wrong if it was, and why the others are.
  // For Math the export drew its equations as pictures, so the worked
  // solution is shown as the College Board rendered it and the text is used
  // only where it survived whole.
  function thisQuestion(q, result) {
    const x = q.explanation;
    if (!x) return `<h4>Official rationale</h4><div class="fb-rationale">${content(q.rationale, q.rationaleImage, "rationale")}</div>`;
    const worked = q.rationaleImage
      ? `<h4>The worked solution, as the College Board wrote it</h4><div class="fb-rationale"><img class="rationale" ${imageAttrs(q.rationaleImage)} alt="Worked solution"></div>`
      : "";
    if (x.kind === "spr") {
      const steps = x.steps?.length
        ? `<h4>${x.complete ? "How it is worked" : "The steps that survive as text"}</h4><ol class="fb-worked">${x.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
        : "";
      return `${x.complete && steps ? steps + worked : worked + steps}`;
    }
    const letters = !x.lettersUnreliable;
    const picked = result.response;
    const yours = x.wrong.find((w) => w.letter === picked && picked !== q.correct);
    const anyText = Boolean(x.correct?.text) || x.wrong.some((w) => w.text);
    const tag = (group) =>
      letters
        ? `<b class="fb-let ${group.right ? "ok" : "no"}">${group.letters.join(" ")}</b>`
        : "";
    // Wrong choices that share one explanation are one line, not three.
    const groups = [];
    for (const w of x.wrong) {
      const same = groups.find((g) => g.text === w.text && w.text);
      if (same) same.letters.push(w.letter);
      else groups.push({ letters: [w.letter], text: w.text, right: false, yours: w === yours });
    }
    for (const g of groups) if (yours && g.letters.includes(yours.letter)) g.yours = true;
    const line = (group, label) => {
      if (!group) return "";
      const fallback = "See the worked solution below.";
      // Without any story to tell, the verdict line and the picture say it all.
      if (!group.text && !anyText) return "";
      return `<li class="${label === "yours" ? "fb-yours" : label === "right" ? "fb-right" : ""}">${tag(group)}<span>${label === "yours" ? "<em>You chose this.</em> " : ""}${escapeHtml(group.text || fallback)}</span></li>`;
    };
    const rightGroup = x.correct ? { letters: [x.correct.letter], text: x.correct.text, right: true } : null;
    const yoursGroup = groups.find((g) => g.yours) ?? null;
    const others = groups.filter((g) => g !== yoursGroup);
    const note = x.note ? `<p class="fb-note">${escapeHtml(x.note)}</p>` : "";
    const lead = x.lead ? `<p class="fb-lead">${escapeHtml(x.lead)}</p>` : "";
    const items = [line(yoursGroup, "yours"), line(rightGroup, "right"), ...others.map((g) => line(g, "other"))].filter(Boolean);
    const list = items.length ? `<ul class="fb-choices">${items.join("")}</ul>` : "";
    return `
      <h4>This question</h4>
      ${note}${lead}${list}
      ${q.rationaleImage ? worked : anyText ? "" : `<div class="fb-rationale">${content(q.rationale, null, "rationale")}</div>`}`;
  }

  // The method that carries from this question to every other of its kind.
  function method(coach) {
    return `
      <div class="fb-pattern"><span class="fb-tag">The pattern</span>${escapeHtml(coach.pattern)}</div>
      <h4>Why this works</h4>
      <p class="fb-why">${escapeHtml(coach.why)}</p>
      <h4>How to do it</h4>
      <ol class="fb-steps">${coach.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p class="fb-remember"><span>Remember</span>${escapeHtml(coach.remember)}</p>
      <h4>What the wrong answers look like</h4>
      <ul class="fb-traps">${coach.traps
        .map((trap) => `<li><strong>${escapeHtml(trap.key)}</strong> — ${escapeHtml(trap.text)}</li>`)
        .join("")}</ul>`;
  }

  function desmosBlock(desmos) {
    return `
      <h4>In Desmos, step by step</h4>
      <div class="fb-desmos">
        <p class="fb-intro">${escapeHtml(desmos.intro)}</p>
        <ol class="fb-walk">${desmos.steps.map((step, index) => desmosStep(desmos.scene, step, index + 1)).join("")}</ol>
        <p class="fb-read"><span>What you read off</span>${escapeHtml(desmos.reading)}</p>
        ${desmos.note ? `<p class="fb-note">${escapeHtml(desmos.note)}</p>` : ""}
      </div>`;
  }

  // One step: what to type or click, why it works, and the screenshot of the
  // screen once you have done it. Callouts sit on top of the picture at the
  // graph coordinates they name.
  function desmosStep(scene, step, number) {
    const picture = stepPicture(scene, step);
    const typed = /^[a-z0-9_^()~<>=+\-*/. ]+$/i.test(step.do) && !step.do.includes(" the ");
    const markers = picture
      ? picture.markers
          .map(
            (marker) =>
              `<span class="fb-mark fb-mark-${escapeHtml(marker.place ?? "right")}" style="left:${marker.left}%;top:${marker.top}%"><i></i>${escapeHtml(marker.label)}</span>`
          )
          .join("")
      : "";
    return `
      <li class="fb-step">
        <div class="fb-step-text">
          <span class="${typed ? "fb-type" : "fb-act"}">${typed ? "" : "→ "}${escapeHtml(step.do)}</span>
          <span class="fb-dwhy">${escapeHtml(step.why)}</span>
        </div>
        ${picture
          ? `<div class="fb-shot"><div class="fb-shot-inner"><img src="assets/desmos/${escapeHtml(picture.image)}" alt="Step ${number} on the Desmos screen" loading="lazy">${markers}</div></div>`
          : ""}
      </li>`;
  }

  // Wiring shared by every screen: the clock buttons and leaving the set.
  function bindCommon() {
    root.querySelector("#hide")?.addEventListener("click", () => { state.hideTimer = !state.hideTimer; render(); });
    root.querySelector("#pause")?.addEventListener("click", togglePause);
    root.querySelector("#resume")?.addEventListener("click", togglePause);
    root.querySelector("#save")?.addEventListener("click", saveAndExit);
    root.querySelector("#save-paused")?.addEventListener("click", saveAndExit);
  }

  function bind(q, isSpr, done) {
    bindCommon();
    root.querySelector("#mark").addEventListener("click", () => {
      state.marked.has(q.id) ? state.marked.delete(q.id) : state.marked.add(q.id);
      persist();
      render();
    });
    root.querySelector("#abc")?.addEventListener("click", () => { state.abc = !state.abc; render(); });
    root.querySelector("#annotate")?.addEventListener("click", () => { state.annotate = !state.annotate; hidePopover(); render(); });
    root.querySelector(".bb-split #stem-image")?.addEventListener("click", () => { state.zoom = !state.zoom; render(); });
    root.querySelector("#nav").addEventListener("click", () => { state.navOpen = !state.navOpen; render(); });
    root.querySelector("#back").addEventListener("click", () => goTo(state.index - 1));
    root.querySelector("#next").addEventListener("click", forward);
    root.querySelector("#to-review")?.addEventListener("click", () => { state.navOpen = false; toReview(); });
    root.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", () => goTo(Number(el.dataset.go)))
    );
    root.querySelector("#nav-panel")?.addEventListener("click", (event) => {
      if (event.target.id === "nav-panel") { state.navOpen = false; render(); }
    });

    const passage = root.querySelector("#passage");
    if (passage) {
      passage.addEventListener("mouseup", () => setTimeout(() => onSelect(q, passage), 0));
      passage.addEventListener("click", (e) => {
        const mark = e.target.closest("mark[data-hl]");
        if (mark && window.getSelection()?.isCollapsed) showPopover(mark.getBoundingClientRect(), { index: Number(mark.dataset.hl) }, q);
      });
    }

    if (isSpr) {
      const input = root.querySelector("#spr");
      const saved = state.answers[state.index];
      if (saved !== null && saved !== undefined) input.value = saved;
      if (!done && !state.paused && !state.navOpen) input.focus();
      input.addEventListener("input", () => {
        state.answers[state.index] = input.value;
        persist();
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") forward(); });
    } else if (!done) {
      root.querySelectorAll(".bb-ch").forEach((el) => {
        el.addEventListener("click", () => select(el.dataset.letter));
        el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") select(el.dataset.letter); });
      });
      root.querySelectorAll(".bb-strike").forEach((el) => {
        el.addEventListener("click", (e) => { e.stopPropagation(); cross(el.dataset.strike); });
      });
    }
  }

  // ----- highlighter -----

  function onSelect(q, passage) {
    if (!state.annotate || state.paused) return;
    const selection = window.getSelection();
    // A plain click leaves no selection; the click handler owns that case.
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const s = offsetAt(range.startContainer, range.startOffset, passage);
    const e = offsetAt(range.endContainer, range.endOffset, passage);
    if (s === null || e === null || e <= s) return hidePopover();
    showPopover(range.getBoundingClientRect(), { s, e }, q);
  }

  function showPopover(rect, target, q) {
    hidePopover();
    popover = document.createElement("div");
    popover.className = "bb-hlpop";
    popover.innerHTML =
      HL_STYLES.map((c) => `<button type="button" class="c ${c}" data-c="${c}" title="${c === "under" ? "Underline" : c[0].toUpperCase() + c.slice(1)}">${c === "under" ? "U" : ""}</button>`).join("") +
      (target.index !== undefined ? `<button type="button" class="x" data-x title="Remove highlight">✕</button>` : "");
    document.body.appendChild(popover);
    const top = window.scrollY + rect.top - popover.offsetHeight - 8;
    const left = Math.max(8, Math.min(window.scrollX + rect.left + rect.width / 2 - popover.offsetWidth / 2, window.scrollX + window.innerWidth - popover.offsetWidth - 8));
    popover.style.top = `${Math.max(window.scrollY + 4, top)}px`;
    popover.style.left = `${left}px`;
    popover.addEventListener("mousedown", (e) => e.preventDefault());
    popover.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button) return;
      const list = store.highlightsFor(q.id).slice();
      if (button.dataset.x !== undefined) list.splice(target.index, 1);
      else if (target.index !== undefined) list[target.index] = { ...list[target.index], c: button.dataset.c };
      else list.push({ s: target.s, e: target.e, c: button.dataset.c });
      store.saveHighlights(q.id, list);
      window.getSelection()?.removeAllRanges();
      hidePopover();
      render();
    });
  }

  function hidePopover() {
    popover?.remove();
    popover = null;
  }

  function onPointerDown(e) {
    if (popover && !popover.contains(e.target)) hidePopover();
  }

  // ----- flow -----

  function togglePause() {
    if (state.paused) {
      const away = Date.now() - state.pausedAt;
      state.pausedTotal += away;
      state.questionStartedAt += away;
      state.paused = false;
    } else {
      chargeTime();
      state.paused = true;
      state.pausedAt = Date.now();
    }
    hidePopover();
    persist();
    render();
  }

  // Choosing an answer, and changing your mind, are the same thing: nothing
  // is marked right or wrong until the module is submitted. Clicking the
  // answer you already chose leaves it chosen, as Bluebook does — losing an
  // answer to a stray second click is not a thing the real test can do to
  // you. Crossing the choice out is the way to take it back.
  function select(letter) {
    if (state.paused || state.crossed[state.index].has(letter)) return;
    if (state.answers[state.index] === letter) return;
    state.answers[state.index] = letter;
    persist();
    render();
  }

  function cross(letter) {
    if (state.paused) return;
    const set = state.crossed[state.index];
    set.has(letter) ? set.delete(letter) : set.add(letter);
    if (state.answers[state.index] === letter) state.answers[state.index] = null;
    persist();
    render();
  }

  function goTo(index, { leaveReview = false } = {}) {
    const { start, end } = bounds();
    const target = Math.max(start, Math.min(index, end - 1));
    if (target === state.index && !state.navOpen && !leaveReview) return;
    chargeTime();
    state.index = target;
    state.navOpen = false;
    state.zoom = false;
    if (leaveReview) state.phase = state.results ? "results" : "answering";
    hidePopover();
    persist();
    render();
    window.scrollTo(0, 0);
  }

  // The Next button. In a module it walks to the end and then offers the
  // review page; in the results it walks to the end and then finishes.
  function forward() {
    if (state.paused) return;
    const { end } = bounds();
    if (state.index < end - 1) return goTo(state.index + 1);
    return state.phase === "results" ? finish() : toReview();
  }

  function toReview() {
    chargeTime();
    state.phase = "review";
    hidePopover();
    persist();
    render();
    window.scrollTo(0, 0);
  }

  // Submitting is the only moment anything is marked, and it marks the whole
  // module at once.
  //
  // A blank counts as wrong on a practice test, because that is the score.
  // In a practice set it is recorded as nothing at all: a question you ran
  // out of time for was not answered wrongly, and calling it a miss would
  // put it in the review queue, count it as seen, and drag the accuracy
  // down on evidence that does not exist. It simply comes round again.
  function submit() {
    chargeTime();
    const { start, end } = bounds();
    const results = state.results ? state.results.slice() : [];
    for (let i = start; i < end; i++) {
      const q = questions[i];
      const response = answered(i) ? String(state.answers[i]) : null;
      const ms = state.spent[i];
      if (response === null && !isTest) {
        results[i] = { id: q.id, correct: false, ms, response: null, skipped: true };
        continue;
      }
      const correct = response !== null && grade(q, response);
      results[i] = { id: q.id, correct, ms, response };
      store.recordAttempt({ id: q.id, correct, mode, ms, response });
    }
    state.results = results;
    onSaved?.();

    // A practice test moves on to the next module with a fresh clock and
    // keeps its marking to itself until the whole test is done.
    const nextModule = spans && moduleNow().number < spans.length;
    if (nextModule) {
      state.index = end;
      state.phase = "answering";
      state.clockStartedAt = Date.now();
      state.pausedTotal = 0;
      state.questionStartedAt = Date.now();
      persist();
      render();
      window.scrollTo(0, 0);
      return;
    }
    state.phase = "results";
    state.index = start;
    persist();
    render();
    window.scrollTo(0, 0);
  }

  function saveAndExit() {
    chargeTime();
    persist();
    stop();
    onPause?.();
  }

  function finish() {
    stop();
    if (!ephemeral) store.clearSession();
    onSaved?.({ immediate: true });
    onDone((state.results ?? []).filter(Boolean));
  }

  function onKey(e) {
    if (e.target.tagName === "INPUT") return;
    const key = e.key.toUpperCase();
    if (key === "P") return togglePause();
    if (state.paused) return;
    if (e.key === "Escape" && state.navOpen) { state.navOpen = false; return render(); }
    if (e.key === "ArrowLeft") return goTo(state.index - 1);
    if (e.key === "ArrowRight") return goTo(state.index + 1);
    if (state.phase !== "answering") {
      if (e.key === "Enter") return forward();
      return;
    }
    if (LETTERS.includes(key) && current().format === "mcq") return select(key);
    if (e.key === "Enter") return forward();
    if (key === "M") return root.querySelector("#mark")?.click();
    if (key === "X") return root.querySelector("#abc")?.click();
    if (key === "N") return root.querySelector("#nav")?.click();
  }

  function stop() {
    clearInterval(ticker);
    hidePopover();
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("mousedown", onPointerDown);
  }

  document.addEventListener("keydown", onKey);
  document.addEventListener("mousedown", onPointerDown);
  ticker = setInterval(() => {
    const el = root.querySelector("#clock");
    if (el && state.phase !== "results") el.textContent = clock(remainingMs());
  }, 1000);
  if (!resume) persist();
  render();
}
