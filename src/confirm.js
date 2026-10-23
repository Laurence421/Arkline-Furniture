// Branded confirmation modal (replaces window.confirm / alert). Resolves true when confirmed.
let dlg;
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function confirmDialog({ title, message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, icon } = {}) {
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = "cdlg";
    document.body.appendChild(dlg);
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close("cancel"); }); // backdrop click
  }
  const ic = icon || (danger ? "alert-triangle" : "circle-help");
  dlg.innerHTML = `<form method="dialog" class="cdlg-box">
      <div class="cdlg-ico${danger ? " danger" : ""}"><i data-lucide="${ic}"></i></div>
      <h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ""}
      <div class="cdlg-acts">
        ${cancelLabel ? `<button class="btn btn-outline" value="cancel">${esc(cancelLabel)}</button>` : ""}
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" value="ok">${esc(confirmLabel)}</button>
      </div></form>`;
  try { window.lucide && lucide.createIcons(); } catch (e) {}
  return new Promise(resolve => {
    dlg.onclose = () => resolve(dlg.returnValue === "ok");
    dlg.returnValue = "";
    dlg.showModal();
    dlg.querySelector(`[value="${danger && cancelLabel ? "cancel" : "ok"}"]`).focus(); // safe default for destructive actions
  });
}

// One-button notice (replaces alert).
export const notice = (title, message) => confirmDialog({ title, message, confirmLabel: "OK", cancelLabel: "", icon: "info" });
