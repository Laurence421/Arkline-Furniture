// /admin "Account" tab: who is signed in, change or set the password, sign out on every device.
import { supabase } from "./supabase.js";
import { confirmDialog } from "./confirm.js";
import { IDLE_OPTIONS, idleMinutes, setIdleMinutes, idleLabel } from "./idle.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
let toast = () => {};

const hasPassword = u => (u.app_metadata?.providers || []).includes("email") || (u.identities || []).some(i => i.provider === "email");
const via = u => { const p = u.app_metadata?.providers || []; return [p.includes("google") && "Google", hasPassword(u) && "email and password"].filter(Boolean).join(" or ") || "email"; };

export function renderAccount(user){
  const pw = hasPassword(user);
  $("#acct").innerHTML = `
    <div class="q auth acct-who">
      <div class="tf-foot" style="gap:14px"><div class="cdlg-ico"><i data-lucide="user"></i></div>
        <div><h3 style="font-size:1.2rem">${esc(user.email)}</h3><p class="sub">Signs in with ${via(user)}${user.last_sign_in_at ? ` · last sign-in ${new Date(user.last_sign_in_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}` : ""}</p></div></div>
    </div>
    <form class="q auth" id="pwform" novalidate>
      <div><h3 style="font-size:1.25rem">${pw ? "Change password" : "Set a password"}</h3>
        <p class="sub">${pw ? "Enter your current password first, then the new one." : "You sign in with Google. Add a password so you can also sign in with your email."}</p></div>
      ${pw ? `<label>Current password<input name="cur" type="password" autocomplete="current-password"></label>` : ""}
      <div class="f2">
        <label>New password <span class="hint">at least 8 characters</span><input name="pw" type="password" autocomplete="new-password" minlength="8"></label>
        <label>Confirm new password<input name="pw2" type="password" autocomplete="new-password"></label>
      </div>
      <label class="sw"><input type="checkbox" data-showpw>Show passwords</label>
      <p class="err" role="alert" hidden></p>
      <div class="tf-foot"><button class="btn btn-primary" type="submit"><i data-lucide="key-round"></i><span>${pw ? "Change password" : "Set password"}</span></button></div>
    </form>
    <div class="q auth" id="alerts">
      <div><h3 style="font-size:1.25rem">Email alerts</h3>
        <p class="sub">These emails get a message for every new order or price request. Any admin can add or remove them.</p></div>
      <ul class="alist" id="alist"><li class="hint">Loading…</li></ul>
      <form class="aadd" id="aadd" novalidate>
        <label for="anew" class="sr">Add an email</label>
        <input id="anew" type="email" autocomplete="email" maxlength="200" placeholder="name@gmail.com">
        <button class="btn btn-outline" type="submit"><i data-lucide="plus"></i><span>Add</span></button>
      </form>
      <p class="err" role="alert" hidden></p>
      <p class="hint">Alerts are sent once email sending (Resend) is set up. Until the website's own domain is added there, only the Resend sign-up email receives them.</p>
    </div>
    <div class="q auth">
      <div><h3 style="font-size:1.25rem">Auto sign-out</h3>
        <p class="sub">Signs this device out of the admin page after a period with no clicks, typing or scrolling. A one-minute warning appears first.</p></div>
      <label for="idlemin">Sign out after<select id="idlemin">${IDLE_OPTIONS.map(([m,l])=>`<option value="${m}"${m===idleMinutes()?" selected":""}>${l}${m===30?" (recommended)":""}</option>`).join("")}</select></label>
    </div>
    <div class="q auth">
      <div><h3 style="font-size:1.25rem">Sign out everywhere</h3>
        <p class="sub">Signs this account out on every phone and computer, including this one. Use it after signing in on a shared or lost device.</p></div>
      <div class="tf-foot"><button class="btn btn-outline pc-del" type="button" id="signall"><i data-lucide="log-out"></i>Sign out on all devices</button></div>
    </div>`;
  icons();
  const f = $("#pwform"), err = f.querySelector(".err");
  const fail = m => { err.hidden = false; err.textContent = m; };
  f.querySelector("[data-showpw]").onchange = e => f.querySelectorAll('input[type="password"],input[data-pwshown]').forEach(i => { i.type = e.target.checked ? "text" : "password"; i.toggleAttribute("data-pwshown", e.target.checked); });
  f.onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const cur = f.cur?.value, next = f.pw.value, again = f.pw2.value;
    if (pw && !cur) return fail("Enter your current password.");
    if (next.length < 8) return fail("Use at least 8 characters for the new password.");
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return fail("Mix letters and numbers so it's harder to guess.");
    if (next !== again) return fail("The two new passwords don't match.");
    if (pw && next === cur) return fail("Choose a password different from your current one.");
    const btn = f.querySelector("[type=submit]"), span = btn.querySelector("span"), label = span.textContent;
    btn.disabled = true; span.textContent = "Saving…";
    try {
      if (pw) { // prove it's really the owner before changing anything
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: cur });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Your current password is wrong." : error.message);
      }
      const { data, error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(/reauthenticat/i.test(error.message) ? "For security, sign out and sign in again, then change the password." : error.message);
      toast(pw ? "Password changed" : "Password set. You can now sign in with your email too.");
      renderAccount(data.user);
    } catch (x) { fail(x.message); }
    finally { btn.disabled = false; span.textContent = label; }
  };
  initAlerts();
  $("#idlemin").onchange = e => { const m = +e.target.value; setIdleMinutes(m); toast(m ? `Auto sign-out set to ${idleLabel(m)}` : "Auto sign-out turned off on this device"); };
  $("#signall").onclick = async () => {
    const ok = await confirmDialog({ title: "Sign out on all devices?", message: "You'll need to sign in again here and on every other phone or computer.", confirmLabel: "Sign out everywhere", danger: true, icon: "log-out" });
    if (ok) await supabase.auth.signOut({ scope: "global" });
  };
}

export function initAccount(showToast){ toast = showToast; }

/* Email alerts: the notify_emails list the server sends each new request to. */
const NEEDS_009 = "Email alerts need one database update: run supabase/009_notify_emails.sql in the Supabase SQL Editor.";
const okEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
let alerts = [];
async function initAlerts(){
  const box = $("#alerts"), err = box.querySelector(".err");
  const fail = m => { err.hidden = !m; err.textContent = m || ""; };
  const draw = () => {
    $("#alist").innerHTML = alerts.length
      ? alerts.map(e => `<li><i data-lucide="mail"></i><span>${esc(e)}</span><button type="button" class="mini qdel" data-arm="${esc(e)}" title="Remove" aria-label="Remove ${esc(e)}"><i data-lucide="x"></i></button></li>`).join("")
      : `<li class="hint">No one gets email alerts right now. New requests still appear under Requests.</li>`;
    icons();
  };
  const { data, error } = await supabase.from("notify_emails").select("email").order("created_at");
  if (error){ $("#alist").innerHTML = ""; $("#aadd").hidden = true; return fail(/notify_emails/.test(error.message) ? NEEDS_009 : "Couldn't load the alert emails: " + error.message); }
  alerts = data.map(r => r.email); draw();
  $("#aadd").onsubmit = async e => {
    e.preventDefault(); fail();
    const inp = $("#anew"), email = inp.value.trim().toLowerCase();
    if (!okEmail(email)) return fail("Enter a full email address, like name@gmail.com.");
    if (alerts.includes(email)) return fail(`${email} is already on the list.`);
    const btn = e.target.querySelector("button"); btn.disabled = true;
    const { error } = await supabase.from("notify_emails").insert({ email });
    btn.disabled = false;
    if (error) return fail(error.code === "23505" ? `${email} is already on the list.` : "Couldn't add it: " + error.message);
    alerts.push(email); inp.value = ""; draw(); toast(`${email} will get email alerts`);
  };
  $("#alist").onclick = async e => {
    const b = e.target.closest("[data-arm]"); if (!b) return;
    const email = b.dataset.arm, last = alerts.length === 1; fail();
    const ok = await confirmDialog({ title: `Stop email alerts to ${email}?`, message: last ? "This is the last email on the list: no one will get an email for new requests. They'll still appear under Requests." : "This email won't get messages for new requests any more. You can add it back at any time.", confirmLabel: "Remove", danger: true, icon: "mail" });
    if (!ok) return;
    const { data, error } = await supabase.from("notify_emails").delete().eq("email", email).select("email");
    if (error || !data?.length) return fail("Couldn't remove it: " + (error?.message || "not allowed."));
    alerts = alerts.filter(x => x !== email); draw(); toast(`${email} removed from email alerts`);
  };
}
