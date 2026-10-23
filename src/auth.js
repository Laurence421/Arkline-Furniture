// Sign-in panel: Google, email + password, forgot password, set new password (after a reset link).
// Renders into `root`; the page decides what happens once signed in (onAuthStateChange).
import { supabase } from "./supabase.js";

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const here = () => location.origin + location.pathname;
const GOOGLE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

const FRIENDLY = {
  "Invalid login credentials": "Wrong email or password.",
  "Email not confirmed": "This email isn't confirmed yet. Check your inbox for the confirmation link.",
  "New password should be different from the old password.": "Choose a password different from your old one.",
};
const nice = e => FRIENDLY[e.message] || (/provider is not enabled/i.test(e.message) ? "Google sign-in isn't switched on yet. Use your email and password for now." : /rate limit/i.test(e.message) ? "Too many emails sent. Wait a few minutes and try again." : e.message);

async function googleEnabled() {
  try {
    const r = await fetch(import.meta.env.VITE_SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } });
    return !!(await r.json()).external?.google;
  } catch { return true; } // can't tell: let Supabase answer
}

export function mountAuth(root, { title = "Sign in", sub = "", onPasswordSet } = {}) {
  let view = "signin";
  const msg = (kind, m) => { const el = root.querySelector(kind === "err" ? ".err" : ".sent"); el.hidden = !m; el.textContent = m || ""; if (m) root.querySelector(kind === "err" ? ".sent" : ".err").hidden = true; };
  const head = (h, p) => `<div><h3 style="font-size:1.5rem">${h}</h3>${p ? `<p class="sub">${p}</p>` : ""}</div>`;
  const tail = (icon, label) => `<p class="err" role="alert" hidden></p><p class="sent" role="status" hidden></p>
    <button class="btn btn-primary" type="submit"><i data-lucide="${icon}"></i><span>${label}</span></button>`;

  const VIEWS = {
    signin: () => `${head(title, sub)}
      <button type="button" class="btn btn-outline gbtn" data-google>${GOOGLE}<span>Continue with Google</span></button>
      <div class="or"><span>or</span></div>
      <label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button type="button" class="link fp" data-v="forgot">Forgot password?</button>
      ${tail("log-in", "Sign in")}`,
    forgot: () => `${head("Reset your password", "Enter your account email. We'll send a link to set a new password.")}
      <label>Email<input name="email" type="email" autocomplete="username" required></label>
      ${tail("mail", "Send reset link")}
      <button type="button" class="link" data-v="signin"><i data-lucide="arrow-left"></i>Back to sign in</button>`,
    reset: () => `${head("Set a new password", "At least 8 characters.")}
      <label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>Confirm new password<input name="confirm" type="password" autocomplete="new-password" required></label>
      ${tail("key-round", "Save new password")}`,
  };

  async function submit(f) {
    const btn = f.querySelector("[type=submit]"), span = btn.querySelector("span"), label = span.textContent;
    const email = f.email?.value.trim(), password = f.password?.value;
    let m = "";
    if (f.email && !/^\S+@\S+\.\S+$/.test(email)) m = "Enter a valid email.";
    else if (view === "signin" && !password) m = "Enter your password.";
    else if (view === "reset" && password.length < 8) m = "Use at least 8 characters.";
    else if (view === "reset" && password !== f.confirm.value) m = "The two passwords don't match.";
    if (m) return msg("err", m);
    msg("err"); btn.disabled = true; span.textContent = "Please wait…";
    try {
      if (view === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: here() });
        if (error) throw error;
        msg("sent", `If ${email} has an account, a reset link is on its way. It can take a minute; check spam too.`);
      } else if (view === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        history.replaceState(null, "", here());
        onPasswordSet?.();
      }
    } catch (e) { msg("err", nice(e)); }
    finally { btn.disabled = false; span.textContent = label; }
  }

  function show(v) {
    view = v;
    root.innerHTML = `<form class="q auth" novalidate>${VIEWS[v]()}</form>`;
    const f = root.querySelector("form");
    f.onsubmit = e => { e.preventDefault(); submit(f); };
    f.onclick = async e => {
      const sw = e.target.closest("[data-v]"); if (sw) { const em = f.email?.value; show(sw.dataset.v); if (em && root.querySelector("form").email) root.querySelector("form").email.value = em; return; }
      if (e.target.closest("[data-google]")) {
        // signInWithOAuth navigates away even when Google is off, landing on a raw JSON error. Check first.
        if (!(await googleEnabled())) return msg("err", "Google sign-in isn't switched on yet. Use your email and password for now.");
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here() } });
        if (error) msg("err", nice(error));
      }
    };
    icons();
    f.querySelector("input")?.focus({ preventScroll: true });
  }

  show(view);
  return { show };
}
