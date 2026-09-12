// The one thing this app asks for: a key to the private repository.
//
// The site itself is public — it is only code. The questions, the images and
// the record are not, and stay behind a token that never leaves this browser.
// It is asked for once per device and then never again.

import { checkToken, getRepo, setGuest, setRepo, setToken } from "./remote.js?v=dcf29171";
import { signIn } from "./guest.js?v=dcf29171";

const NEW_TOKEN = "https://github.com/settings/personal-access-tokens/new";

// The repository goes into an attribute, so a stray quote must not be able to
// walk out of it.
const escapeAttr = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function showConnect(root, { reason = "" } = {}) {
  return new Promise((resolve) => {
    // Two ways in, and most people only ever need one of them. Someone handed a
    // username and password should not have to read five steps about tokens
    // first, so that is the way the screen opens.
    root.innerHTML = `
      <div class="summary connect">
        <div class="kick">SAT Mastery</div>
        <h2>Sign in</h2>
        ${reason ? `<p class="why">${reason}</p>` : ""}

        <div class="cn-ways">
          <button type="button" class="cn-way is-on" data-way="guest">I was given a username</button>
          <button type="button" class="cn-way" data-way="owner">I have a GitHub key</button>
        </div>

        <form id="guest-form" class="cn-pane">
          <p class="cn-say">Type what you were given. Your practice is kept in this browser and goes nowhere else.</p>
          <input id="who" type="text" autocomplete="username" spellcheck="false" placeholder="username" aria-label="Username">
          <input id="word" type="password" autocomplete="current-password" placeholder="password" aria-label="Password">
          <button type="submit">Sign in</button>
        </form>

        <form id="connect-form" class="cn-pane" hidden>
          <p class="cn-say">Your work lives in a private repository. Name it, and paste a key that opens it.
             Both are stored here, on this device only.</p>
          <ol class="steps">
            <li><a href="${NEW_TOKEN}" target="_blank" rel="noopener">Open GitHub's token page</a> — you are already signed in</li>
            <li>Token name <code>SAT Mastery</code>, expiration <code>No expiration</code></li>
            <li>Repository access <code>Only select repositories</code> → the one named below</li>
            <li>Permissions → Repository permissions → <code>Contents</code> → <code>Read and write</code></li>
            <li>Generate it, copy it, paste it here</li>
          </ol>
          <input id="repo" type="text" autocomplete="off" spellcheck="false" placeholder="owner/repository"
                 aria-label="Repository" value="${escapeAttr(getRepo())}">
          <input id="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" aria-label="GitHub token">
          <button type="submit">Connect</button>
        </form>

        <p class="state" id="state"></p>
      </div>`;

    const state = root.querySelector("#state");
    const panes = { guest: root.querySelector("#guest-form"), owner: root.querySelector("#connect-form") };
    const focusFirst = (pane) => pane?.querySelector("input")?.focus();

    for (const tab of root.querySelectorAll(".cn-way")) {
      tab.addEventListener("click", () => {
        for (const other of root.querySelectorAll(".cn-way")) other.classList.toggle("is-on", other === tab);
        for (const [key, pane] of Object.entries(panes)) pane.hidden = key !== tab.dataset.way;
        state.textContent = "";
        focusFirst(panes[tab.dataset.way]);
      });
    }
    focusFirst(panes.guest);

    function working(form, on, message = "") {
      form.querySelector("button").disabled = on;
      state.className = "state";
      state.textContent = message;
    }

    function fail(form, reason) {
      working(form, false);
      state.className = "state bad";
      state.textContent = reason;
    }

    panes.guest.addEventListener("submit", async (event) => {
      event.preventDefault();
      const who = root.querySelector("#who").value.trim().toLowerCase();
      const word = root.querySelector("#word").value;
      if (!who || !word) return;
      working(panes.guest, true, "Signing in…");
      const result = await signIn(who, word);
      if (!result.ok) return fail(panes.guest, result.reason);

      const usable = await checkToken(result.token, result.repo, { guest: true });
      if (!usable.ok) return fail(panes.guest, usable.reason);
      setRepo(result.repo);
      setToken(result.token);
      setGuest(true);
      state.className = "state good";
      state.textContent = "Signed in. Loading the questions…";
      resolve(result.token);
    });

    panes.owner.addEventListener("submit", async (event) => {
      event.preventDefault();
      const token = root.querySelector("#token").value.trim();
      const repo = root.querySelector("#repo").value.trim();
      if (!token) return;
      working(panes.owner, true, "Checking…");
      const result = await checkToken(token, repo);
      if (!result.ok) return fail(panes.owner, result.reason);
      setGuest(false);
      setRepo(repo);
      setToken(token);
      state.className = "state good";
      state.textContent = "Connected. Loading the bank…";
      resolve(token);
    });
  });
}
