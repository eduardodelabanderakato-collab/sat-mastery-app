// The questions and their pictures, when the app is not running off a disk.
//
// On GitHub Pages there is no data/ directory to serve: every image and the
// bank itself come from the private repository over the API, with the key this
// browser holds. Each one is kept in the browser's cache store afterwards, so a
// picture is fetched once and then belongs to this device.
//
// An image tag is written without a src and with the path in data-asset. A
// watcher fills it in as soon as the bytes are there, which means a question
// never asks the network for a URL that does not exist and never shows a broken
// picture while it waits.

import { getToken, headers, hosted, repoUrl } from "./remote.js?v=dcf29171";

const IMG_CACHE = "sat-mastery-img-v1";
const BANK_CACHE = "sat-mastery-bank-v1";
const LOCAL = "https://sat-mastery.invalid/";

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", json: "application/json" };

const ready = new Map();
const inFlight = new Map();

function typeFor(path) {
  return TYPES[path.slice(path.lastIndexOf(".") + 1)] ?? "application/octet-stream";
}

function apiUrl(path) {
  return repoUrl(path);
}

// Cache storage is missing in a few private-browsing modes. Everything still
// works without it; it just fetches again next time.
async function open(name) {
  try {
    return await caches.open(name);
  } catch {
    return null;
  }
}

async function fromRepo(path) {
  const response = await fetch(apiUrl(path), {
    headers: headers(getToken(), { Accept: "application/vnd.github.raw" }),
  });
  if (!response.ok) {
    const error = new Error(`GitHub answered ${response.status} for ${path}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

// The attributes for an image tag. Served locally the path is simply the path;
// hosted, it is a promise this module keeps.
export function imageAttrs(path, { remote = hosted() } = {}) {
  const safe = String(path).replace(/"/g, "&quot;");
  return remote ? `data-asset="data/${safe}"` : `src="data/${safe}"`;
}

export async function resolve(path) {
  if (ready.has(path)) return ready.get(path);
  if (inFlight.has(path)) return inFlight.get(path);

  const job = (async () => {
    const key = LOCAL + path;
    const cache = await open(IMG_CACHE);
    let held = cache ? await cache.match(key) : null;
    if (!held) {
      const response = await fromRepo(path);
      held = new Response(await response.blob(), { headers: { "Content-Type": typeFor(path) } });
      if (cache) await cache.put(key, held.clone());
    }
    const url = URL.createObjectURL(await held.blob());
    ready.set(path, url);
    inFlight.delete(path);
    return url;
  })().catch((error) => {
    inFlight.delete(path);
    throw error;
  });

  inFlight.set(path, job);
  return job;
}

function fill(node) {
  const images = [];
  if (node.matches?.("img[data-asset]")) images.push(node);
  if (node.querySelectorAll) images.push(...node.querySelectorAll("img[data-asset]"));
  for (const image of images) {
    const path = image.dataset.asset;
    delete image.dataset.asset;
    resolve(path).then(
      (url) => {
        image.src = url;
      },
      () => {
        // The picture would not come. The question's words are still there,
        // and the next question is not held up by it.
        image.alt = "This picture would not load. Check the connection and reload.";
      },
    );
  }
}

// Watches the whole page for images the app has just written, so no render
// site has to remember to ask for its pictures.
export function watchAssets(root = document.body) {
  fill(root);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node.nodeType === 1) fill(node);
    }
  }).observe(root, { childList: true, subtree: true });
}

// The bank, kept under the build it belongs to. A republished bank has a new
// stamp and is fetched once; an unchanged one is never downloaded twice.
export async function loadBank(stamp) {
  const key = `${LOCAL}bank/${stamp}`;
  const cache = await open(BANK_CACHE);
  const held = cache ? await cache.match(key) : null;
  if (held) return held.json();

  const response = await fromRepo("data/questions.json");
  const text = await response.text();
  if (cache) {
    for (const old of await cache.keys()) if (old.url !== key) await cache.delete(old);
    await cache.put(key, new Response(text, { headers: { "Content-Type": "application/json" } }));
  }
  return JSON.parse(text);
}

// The backdrop the glass sits on. It is his own photograph, so it lives in the
// private repository with everything else and is fetched with his key rather
// than published to a public URL. Until it is there, the ground is a gradient
// cut to the same palette, so nothing ever looks broken.
export async function applyBackdrop(remote = hosted()) {
  const path = "data/backdrop.jpg";
  try {
    const url = remote ? await resolve(path) : path;
    const probe = await new Promise((done) => {
      const img = new Image();
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
    });
    if (!probe) return false;
    document.documentElement.style.setProperty("--backdrop", `url("${url}")`);
    document.documentElement.dataset.backdrop = "on";
    return true;
  } catch {
    return false;
  }
}
