// Talking to the private repository from the browser.
//
// The app itself is a handful of static files on GitHub Pages, so the same URL
// opens on any device. Everything that matters — the 3,770 questions, their
// images, and Eduardo's record — stays in the private repository and is fetched
// with a token he pastes in once per device. Nothing sensitive is ever part of
// the published site.
//
// This module is the key and the record: proving a key works, reading the
// record and committing it back. The questions and the pictures come through
// assets.js, which caches them; the record never is, because it changes.
//
// The repository is part of the login rather than baked into the build, so the
// one published site serves anyone with their own copy: the code is the same
// for everybody, and the key decides whose questions and whose record it opens.

export const DEFAULT_REPO = "eduardodelabanderakato-collab/sat-mastery";
const API = "https://api.github.com";
export const TOKEN_KEY = "sat-mastery.token.v1";
export const REPO_KEY = "sat-mastery.repo.v1";
// A guest reads the bank and keeps their practice in their own browser. There
// is no repository of theirs anywhere, which is the point: nothing to reach.
export const GUEST_KEY = "sat-mastery.guest.v1";
const PROGRESS_PATH = "data/progress.json";

export function isGuest() {
  try {
    return window.localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuest(on) {
  try {
    if (on) window.localStorage.setItem(GUEST_KEY, "1");
    else window.localStorage.removeItem(GUEST_KEY);
  } catch {}
}

// "owner/name". Anything that is not that shape is ignored in favour of the
// default, so a half-typed value can never send requests somewhere strange.
export function getRepo() {
  try {
    const held = window.localStorage.getItem(REPO_KEY);
    return validRepo(held) ? held : DEFAULT_REPO;
  } catch {
    return DEFAULT_REPO;
  }
}

export function setRepo(repo) {
  try {
    window.localStorage.setItem(REPO_KEY, repo);
  } catch {}
}

export function validRepo(repo) {
  return typeof repo === "string" && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(repo.trim());
}

export function repoUrl(path = "", repo = getRepo()) {
  return `${API}/repos/${repo}/contents/${path}`;
}

// True when the app is served from anywhere other than this machine. Opened
// locally there is a Python server that reads the disk and takes a POST, so
// none of this is needed.
//
// ?remote=1 turns it on anyway. That is how the hosted path — the key, the
// worker, the requests to GitHub — is exercised on this machine before anything
// is published, rather than finding out on the day.
export function hosted() {
  if (new URLSearchParams(window.location.search).get("remote") === "1") return true;
  const host = window.location.hostname;
  return window.location.protocol.startsWith("http") && host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

// The key stays in this browser's own storage and is sent to nobody but
// GitHub. Clearing the browser clears it; the record itself is safe in the
// repository, and pasting a new key picks it straight back up.
export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function headers(token = getToken(), extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

// A token is good when it can see the private repository. Anything else — a
// typo, an expired token, one made for the wrong account — fails here, before
// it is ever stored, so the connect screen can say what went wrong.
// A key is good when it can write the repository it names, and that repository
// actually holds a question bank. Both are checked before anything is stored,
// so a wrong repository or a read-only key is caught here rather than three
// screens later as an empty dashboard.
export async function checkToken(token, repo = getRepo(), { guest = false } = {}) {
  if (!validRepo(repo)) {
    return { ok: false, reason: "That does not look like a repository. It should read owner/name — for example eduardo/sat-mastery." };
  }
  let response;
  try {
    response = await fetch(`${API}/repos/${repo}`, { headers: headers(token) });
  } catch {
    return { ok: false, reason: "No connection to GitHub. Check the network and try again." };
  }
  if (response.status === 401) return { ok: false, reason: "GitHub does not recognise that token. Copy it again — it is only shown once." };
  if (response.status === 403) return { ok: false, reason: `That token is not allowed to read ${repo}. Give it Contents access to that repository.` };
  if (response.status === 404) return { ok: false, reason: `That token cannot see ${repo}. Check the name, and pick that repository when you make the token.` };
  if (!response.ok) return { ok: false, reason: `GitHub answered ${response.status}. Try again in a moment.` };

  const found = await response.json();
  if (!guest && found.permissions && !found.permissions.push) {
    return { ok: false, reason: "That token can read but not write, so your answers could never be saved. Set Contents to Read and write." };
  }

  // A repository that opens but holds no bank would leave the app on a loading
  // screen with nothing to say. Better to say it now.
  const bank = await fetch(repoUrl("data", repo), { headers: headers(token) });
  if (bank.ok) {
    const entries = await bank.json();
    const names = Array.isArray(entries) ? entries.map((e) => e.name) : [];
    if (!names.includes("questions.json")) {
      return { ok: false, reason: `${repo} opens, but there is no question bank in it. Point this at the repository that holds data/questions.json.` };
    }
  }
  return { ok: true };
}

// The blob sha of a file, which a write has to quote so two devices can never
// overwrite each other silently. Read from the directory listing rather than
// the file, so it works whatever the file's size.
async function shaOf(path) {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const response = await fetch(repoUrl(dir), { headers: headers() });
  if (!response.ok) return null;
  const entries = await response.json();
  return Array.isArray(entries) ? entries.find((e) => e.name === name)?.sha ?? null : null;
}

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function readProgress() {
  if (isGuest()) return null;
  try {
    const response = await fetch(repoUrl(PROGRESS_PATH), {
      headers: headers(getToken(), { Accept: "application/vnd.github.raw" }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// One commit per save. If another device wrote in between, GitHub refuses the
// stale sha; we read the current one and put it again rather than losing either
// side's work — the payload we are writing already carries the merged record.
export async function writeProgress(payload, message) {
  // A guest has nowhere to write and no permission to. Their practice lives in
  // their browser, and the app never asks GitHub to keep it.
  if (isGuest()) return false;
  const body = JSON.stringify(payload, null, 1);
  for (let attempt = 0; attempt < 3; attempt++) {
    const sha = await shaOf(PROGRESS_PATH);
    const response = await fetch(repoUrl(PROGRESS_PATH), {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ message, content: encode(body), sha: sha ?? undefined }),
    });
    if (response.ok) return true;
    if (response.status !== 409 && response.status !== 422) return false;
  }
  return false;
}

