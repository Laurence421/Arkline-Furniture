// /admin "Account" tab: who is signed in, change or set the password, sign out on every device.
import { supabase } from "./supabase.js";
import { confirmDialog } from "./confirm.js";

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
  $("#signall").onclick = async () => {
    const ok = await confirmDialog({ title: "Sign out on all devices?", message: "You'll need to sign in again here and on every other phone or computer.", confirmLabel: "Sign out everywhere", danger: true, icon: "log-out" });
    if (ok) await supabase.auth.signOut({ scope: "global" });
  };
}

export function initAccount(showToast){ toast = showToast; }
