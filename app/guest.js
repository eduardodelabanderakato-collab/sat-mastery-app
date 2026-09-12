// Signing in without a GitHub account.
//
// There is no server here to check a password against, so the login does the
// only honest thing a static site can: the password decrypts a key that is
// already sitting in the page, and a wrong password decrypts to nothing at all.
// No "incorrect password" is ever sent by anybody — it simply does not open.
//
// The key inside is read-only and opens the bank repository alone. Eduardo's
// record is in a different repository that key cannot see, and a guest's own
// practice never leaves their browser. So the worst a guessed password could
// do is let someone read College Board questions, which College Board gives
// away.
//
// The numbers here must match tools/invite.py exactly, on both sides.

const ITERATIONS_MAX = 2_000_000;

function bytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// Usernames become a path, so they are checked before they are one.
export function validName(name) {
  return typeof name === "string" && /^[a-z0-9][a-z0-9-]{0,30}$/.test(name.trim());
}

export async function fetchInvite(name) {
  if (!validName(name)) return null;
  try {
    const response = await fetch(`invites/${name}.json`, { cache: "no-store" });
    if (!response.ok) return null;
    const envelope = await response.json();
    const sane =
      envelope?.v === 1 &&
      envelope.kdf === "PBKDF2-SHA256" &&
      Number.isInteger(envelope.iterations) &&
      envelope.iterations > 0 &&
      envelope.iterations <= ITERATIONS_MAX &&
      typeof envelope.salt === "string" &&
      typeof envelope.iv === "string" &&
      typeof envelope.sealed === "string" &&
      typeof envelope.repo === "string";
    return sane ? envelope : null;
  } catch {
    return null;
  }
}

export async function unseal(envelope, password) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bytes(envelope.salt), iterations: envelope.iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  // A wrong password fails here, in the cipher's own authentication tag. That
  // is the whole check: there is nothing else to ask.
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(envelope.iv) }, key, bytes(envelope.sealed));
  return new TextDecoder().decode(plain);
}

// The two ways this can fail are worth telling apart: a name nobody has been
// given, and a password that does not open one that exists.
export async function signIn(name, password) {
  if (!crypto?.subtle) {
    return { ok: false, reason: "This browser cannot sign in here. Open the page over https rather than as a file." };
  }
  const envelope = await fetchInvite(name);
  if (!envelope) return { ok: false, reason: "No account by that name. Check the spelling — it is all lowercase." };
  try {
    const token = await unseal(envelope, password);
    return { ok: true, token, repo: envelope.repo };
  } catch {
    return { ok: false, reason: "That password does not open this account. Check it and try again." };
  }
}
