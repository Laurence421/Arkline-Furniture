// Admin auto sign-out after a period without activity. The duration is chosen per device (Account tab);
// activity in any open admin tab counts (shared through localStorage). A one-minute warning comes first.
const KEY_LAST = "ark-admin-last-active", KEY_MIN = "ark-admin-idle-minutes", WARN = 60_000;
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};
export const IDLE_OPTIONS = [[15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"], [120, "2 hours"], [0, "Never"]];
export const idleMinutes = () => { const v = store.get(KEY_MIN); return v !== null && IDLE_OPTIONS.some(o => o[0] === +v) ? +v : 30; };
export const idleLabel = (m = idleMinutes()) => IDLE_OPTIONS.find(o => o[0] === m)?.[1] || `${m} minutes`;

let last = Date.now(), dlg = null;
const touch = () => { last = Date.now(); store.set(KEY_LAST, String(last)); };
const lastActive = () => Math.max(last, +store.get(KEY_LAST) || 0);
export const setIdleMinutes = m => { store.set(KEY_MIN, String(m)); touch(); };

function warning(seconds, stay){
  if (!dlg) {
    dlg = document.createElement("dialog"); dlg.className = "cdlg"; document.body.appendChild(dlg);
    dlg.innerHTML = `<form method="dialog" class="cdlg-box">
        <div class="cdlg-ico"><i data-lucide="clock"></i></div>
        <h3>Still there?</h3>
        <p>For safety, you'll be signed out in <b data-count></b> because the admin page hasn't been used for a while.</p>
        <div class="cdlg-acts"><button class="btn btn-primary" value="stay">Stay signed in</button></div></form>`;
    dlg.addEventListener("close", () => { if (dlg.returnValue === "stay") stay(); });
    try { window.lucide && lucide.createIcons(); } catch {}
  }
  dlg.querySelector("[data-count]").textContent = `0:${String(Math.max(0, seconds)).padStart(2, "0")}`;
  if (!dlg.open) { dlg.returnValue = ""; dlg.showModal(); }
}

// isActive(): only watch while the admin dashboard is shown. onTimeout(): sign out.
export function startIdleWatch({ isActive, onTimeout }){
  let throttle = 0;
  const activity = () => { const n = Date.now(); if (n - throttle > 3000) { throttle = n; touch(); } };
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart", "wheel"]) addEventListener(ev, activity, { passive: true, capture: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  touch();
  function check(){
    const m = idleMinutes();
    if (!isActive() || !m) { if (dlg?.open) dlg.close(); return; }
    const limit = m * 60_000, idle = Date.now() - lastActive();
    if (idle >= limit) { if (dlg?.open) dlg.close(); touch(); onTimeout(m); }
    else if (idle >= limit - WARN) warning(Math.ceil((limit - idle) / 1000), touch);
    else if (dlg?.open) dlg.close(); // activity here or in another admin tab
  }
  setInterval(check, 1000);
  return { touch };
}
