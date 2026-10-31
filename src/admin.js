import "./icons.js";
// /admin — Feature A. Signed-in admins upload, trash, restore and permanently delete gallery photos.
// Uploaded photos: projects.deleted_at set = in Trash. Bundled photos: a hidden_photos row = in Trash.
import { ORDER, BUNDLED, messengerUrl, viberUrl } from "./data.js";
import { loadProducts, loadText, initContentTabs } from "./admin-content.js";
import { categories, loadCategories, isBuiltIn, addCategory, deleteCategory } from "./categories.js";
import { renderAccount, initAccount } from "./admin-account.js";
import { supabase, photoUrl, PHOTO_BUCKET } from "./supabase.js";
import { toWebp } from "./image.js";
import { mountAuth } from "./auth.js";
import { confirmDialog, notice } from "./confirm.js";
import { startIdleWatch, idleLabel } from "./idle.js";

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-");
const show = (el,m) => { el.hidden=!m; el.textContent=m||""; };
const busy = (btn,on,txt) => { btn.disabled=on; btn.querySelector("span").textContent=txt; };
const plural = (n,w) => `${n} ${w}${n===1?"":"s"}`;

let rows=[], hidden=new Map(), filter="All", bfilter="All";

/* auth */
let auth, recovering=false, adminEmail="", signedInId=null, idledOut=null;

// Gmail compose in a new tab, from the signed-in admin's Google account, with a drafted reply.
// Shop items = an order; only liked photos or a description = a price request.
const kindOf=q=>{ const o=(q.quote_items||[]).length>0, l=(q.liked_photos||[]).length>0; return o&&l?"Order + price request":o?"Order":"Price request"; };
const totalOf=q=>q.estimate_min===q.estimate_max?peso(q.estimate_min):`${peso(q.estimate_min)} – ${peso(q.estimate_max)}`;
function gmailDraft(q){
  const first=q.full_name.split(" ")[0], items=q.quote_items||[], liked=q.liked_photos||[], order=items.length>0;
  const est=totalOf(q);
  const body=[
    `Hi ${first},`, "",
    `Thank you for your ${order?"order":"price request"} #${q.id} (${q.project_type}).`, "",
    ...(order?["Your order:",...items.map(i=>`- ${i.qty} × ${i.id} ${i.name}`),`Total from our shop prices: ${est}`,""]:[]),
    ...(liked.length?["You'd like one like these:",...liked.map(l=>`- ${l.cat}: ${new URL(l.src,location.origin).href}`),""]:[]),
    ...(q.delivery_address?[`Deliver to: ${q.delivery_address}`,""]:[]),
    ...(q.message?["Your notes:",`"${q.message}"`,""]:[]),
    order?"[Confirm availability, delivery date, delivery fee and the 70% down payment here]":"[Write the full price and details here]", "",
    "Feel free to reply to this email or call us at 0962 269 8229.", "",
    "Best regards,", "Arkline Home & Office Furniture", "101 Lydia St., Brgy. Sta. Monica, Novaliches, Quezon City"
  ].join("\n");
  const p=new URLSearchParams({view:"cm",fs:"1",to:q.email,su:order?`Arkline order #${q.id}`:`Arkline price for request #${q.id}`,body});
  if(adminEmail) p.set("authuser",adminEmail);
  return "https://mail.google.com/mail/?"+p;
}
// Short ready-made reply for Text, Viber and Messenger; the owner only fills in the blanks.
function replyText(q){
  const first=q.full_name.split(" ")[0], items=q.quote_items||[], liked=q.liked_photos||[];
  if(items.length) return [`Hi ${first}! This is Arkline Home & Office Furniture about your order #${q.id}:`,
    ...items.map(i=>`${i.qty} × ${i.name} (${i.id})`), `Items total: ${totalOf(q)}`,
    `Delivery fee${q.delivery_address?" to "+q.delivery_address:""}: ₱___`, "70% down payment: ₱___", "Delivery date: ___", "Thank you!"].join("\n");
  return [`Hi ${first}! This is Arkline Home & Office Furniture about your price request #${q.id}${liked.length?` (one like the photo${liked.length>1?"s":""} you sent)`:""}.`,
    "Price: ₱___", "Includes: ___", "Thank you!"].join("\n");
}
async function route(session){
  if(recovering) return; // a reset-password link is open: the "Set a new password" form stays until it's saved
  $("#logout").hidden=!session;
  if(!session){
    $("#login").hidden=false; $("#app").hidden=true; auth.show("signin");
    if(idledOut){ $("#login").insertAdjacentHTML("afterbegin",`<p class="idle-note" role="status">You were signed out after ${idledOut} without activity. Sign in again to continue.</p>`); idledOut=null; }
    return;
  }
  const {data:isAdmin,error}=await supabase.rpc("is_admin");
  if(error||!isAdmin){
    $("#login").hidden=false; $("#app").hidden=true;
    $("#login").innerHTML=`<div class="q auth denied" style="display:grid"><h3 style="font-size:1.5rem">Not an admin account</h3>
      <p class="sub">You're signed in as <b>${esc(session.user.email)}</b>, which doesn't have access to Arkline's admin page. Sign out and use the admin account.</p>
      <button class="btn btn-primary" data-signout><i data-lucide="log-out"></i>Sign out</button></div>`;
    $("#login").querySelector("[data-signout]").onclick=()=>supabase.auth.signOut();
    icons(); return;
  }
  adminEmail=session.user.email; renderAccount(session.user);
  $("#login").hidden=true; $("#app").hidden=false;
  load(); loadQuotes(); loadProducts();
  loadCategories().then(err=>{ renderCats(); if(err) show($("#caterr"),err); render(); loadText(); });
}

/* tabs */
$("#atabs").onclick=e=>{
  const b=e.target.closest("[data-tab]"); if(!b) return;
  $("#atabs").querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected",x===b));
  for(const t of ["quotes","photos","prices","text","account"]) $("#tab-"+t).hidden=b.dataset.tab!==t;
  $("#amenu-label").textContent=b.textContent.trim().replace(/\d+$/,"").trim(); menuOpen(false); scrollTo({top:0});
  b.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"}); // keep the chosen tab visible in the scrolling bar on phones
};

/* quotes */
// Three steps, two of them automatic: New (the customer sent it) → Replied (the owner tapped a reply
// button on the card) → Done (one tap, or by itself after 30 days without activity). "quoted" is an
// older status and shows as Replied.
const STATUS={new:"New",contacted:"Replied",quoted:"Replied",closed:"Done"};
const STEPS=[["new","New"],["replied","Replied"],["closed","Done"]];
const stepOf=q=>q.status==="closed"?"closed":q.status==="new"?"new":"replied";
const AUTO_DONE_DAYS=30;
let quotes=[], qfilter="active", qtype="all", qsearch="";
const peso=n=>"₱"+Number(n).toLocaleString("en-PH");
const when=d=>new Date(d).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
async function loadQuotes(){
  const {data,error}=await supabase.from("quotation_requests").select("*").order("created_at",{ascending:false}).limit(500);
  if(error){ show($("#qerr"),"Couldn't load requests: "+error.message); return; }
  quotes=data; renderQuotes(); autoDone();
}
// Replied requests with no activity (reply, note, reopen) for 30 days are Done. New ones never close by themselves.
async function autoDone(){
  const cut=Date.now()-AUTO_DONE_DAYS*864e5;
  const old=quotes.filter(q=>!inTrash(q)&&stepOf(q)==="replied"&&new Date(q.last_activity_at||q.created_at)<cut);
  if(!old.length) return;
  const {error}=await supabase.from("quotation_requests").update({status:"closed"}).in("id",old.map(q=>q.id));
  if(!error){ old.forEach(q=>q.status="closed"); renderQuotes(); }
}
// Saves a change and stamps the activity time (restarts the 30 days). Works before the 008 update too.
async function touch(q,patch){
  const at=new Date().toISOString();
  let {error}=await supabase.from("quotation_requests").update({...patch,last_activity_at:at}).eq("id",q.id);
  if(error&&/last_activity_at/.test(error.message)) ({error}=await supabase.from("quotation_requests").update(patch).eq("id",q.id));
  else if(!error) q.last_activity_at=at;
  if(!error) Object.assign(q,patch);
  return error;
}
/* live: new or changed requests appear without reloading (every 20 s, and when the tab comes back).
   Never redraws while a note, status or search is being edited; it catches up on the next check. */
const qsig=list=>JSON.stringify(list.map(q=>[q.id,q.status,q.deleted_at,q.notes,q.last_activity_at]));
async function pollQuotes(){
  if(document.hidden||$("#app").hidden) return;
  const f=document.activeElement; if(f&&$("#qlist").contains(f)&&f.matches("textarea,select,input")) return;
  const {data,error}=await supabase.from("quotation_requests").select("*").order("created_at",{ascending:false}).limit(500);
  if(error||qsig(data)===qsig(quotes)) return;
  const known=new Set(quotes.map(q=>q.id)), fresh=data.filter(q=>!known.has(q.id)&&!q.deleted_at);
  quotes=data; renderQuotes();
  for(const q of fresh.slice(0,3)) toast(`New ${kindOf(q).toLowerCase()} #${q.id} from ${q.full_name}`);
  if(fresh.length>3) toast(`${fresh.length} new requests`);
}
setInterval(pollQuotes,20000);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) pollQuotes(); });
// Requests in Trash have deleted_at set; every other view leaves them out.
const inTrash=q=>!!q.deleted_at;
const inView=(q,k)=>k==="trash"?inTrash(q):!inTrash(q)&&(k==="all"||(k==="active"?q.status!=="closed":stepOf(q)===k));
// Orders (shop items) and price requests (custom work, liked photos) share one inbox; the type switch narrows it.
const isOrder=q=>(q.quote_items||[]).length>0;
const ofType=(q,t)=>t==="all"||(t==="order")===isOrder(q);
const QTYPES=[["all","All"],["order","Orders"],["price","Price requests"]];
// Earlier requests from the same mobile or email, for the "Returning customer" link.
let earlier=new Map();
const who=q=>[q.mobile,q.email&&q.email.toLowerCase()].filter(Boolean);
function renderQuotes(){
  const seen=new Map(); earlier=new Map();
  for(const q of quotes.filter(q=>!inTrash(q)).sort((a,b)=>a.created_at<b.created_at?-1:1)){
    earlier.set(q.id,Math.max(0,...who(q).map(k=>seen.get(k)||0)));
    for(const k of who(q)) seen.set(k,(seen.get(k)||0)+1);
  }
  // Typing in search looks through every request (Trash only when Trash is open), whatever status button is on.
  const s=qsearch.toLowerCase().replace(/^#/,""), searching=!!s&&qfilter!=="trash";
  const shown=q=>searching?!inTrash(q):inView(q,qfilter);
  const n=k=>quotes.filter(q=>inView(q,k)&&ofType(q,qtype)).length;
  const fresh=quotes.filter(q=>inView(q,"new")).length; $("#newc").textContent=fresh; $("#newc").hidden=!fresh;
  $("#qcount").textContent=plural(quotes.filter(q=>!inTrash(q)).length,"request");
  $("#qtype").innerHTML=QTYPES.map(([t,l])=>{ const c=quotes.filter(q=>shown(q)&&ofType(q,t)).length, nw=t==="all"?0:quotes.filter(q=>inView(q,"new")&&ofType(q,t)).length;
    return `<button role="tab" aria-selected="${t===qtype}" data-qt="${t}">${l}<small>${c}</small>${nw?`<span class="badge" title="${nw} new" aria-label="${nw} new">${nw}</span>`:""}</button>`; }).join("");
  $("#qfilters").innerHTML=[["active","Open"],...STEPS,["trash","Trash"]]
    .map(([k,l])=>`<button class="chip${k===qfilter&&!searching?" on":""}${k==="trash"?" trash":""}" data-qf="${k}"${k==="trash"?` title="Trash" aria-label="Trash, ${n(k)}"`:""}>${k==="trash"?'<i data-lucide="trash-2"></i>':l}<small>${n(k)}</small></button>`).join("");
  const vis=quotes.filter(q=>shown(q)&&ofType(q,qtype)
    &&(!s||[q.id,q.full_name,q.mobile,q.email,q.message].some(v=>String(v??"").toLowerCase().includes(s))));
  $("#qlist").innerHTML=vis.length?vis.map(card).join(""):empty(qfilter==="trash"?"Trash is empty.":quotes.length?`No ${qtype==="order"?"orders":qtype==="price"?"price requests":"requests"} match${searching?` "${esc(qsearch)}"`:""}.`:"No price requests yet. They'll appear here as soon as a customer sends the form.");
  icons();
}
function card(q){
  const items=(q.quote_items||[]);
  return `<article class="qc st-${q.status}${inTrash(q)?" trashed":""}" data-id="${q.id}">
    <div class="qc-top">
      <div><div class="qc-id"><span class="kind ${(q.quote_items||[]).length?"order":"price"}">${kindOf(q)}</span>${q.contact_pref?`<span class="kind pref">Prefers ${esc(q.contact_pref)}</span>`:""} #${q.id} · ${when(q.created_at)}</div><h3>${esc(q.full_name)}</h3><div class="meta">${esc(q.project_type)}${q.mobile?" · "+esc(q.mobile):""}${q.email?" · "+esc(q.email):""}</div>${earlier.get(q.id)?`<button class="link returning" data-history="${esc(q.mobile||q.email)}"><i data-lucide="history"></i>Returning customer · ${plural(earlier.get(q.id),"earlier request")}</button>`:""}</div>
      ${inTrash(q)
        ?`<div class="qc-trash"><span class="hint">In Trash since ${when(q.deleted_at)}</span><button class="btn btn-outline" data-qrestore><i data-lucide="rotate-ccw"></i>Restore</button><button class="btn btn-outline pc-del" data-qforever><i data-lucide="x"></i>Delete forever</button></div>`
        :`<div class="qc-side"><span class="qstep s-${stepOf(q)}">${STATUS[q.status]||esc(q.status)}</span>${q.status==="closed"
          ?`<button class="btn btn-outline qsm" data-qreopen><i data-lucide="rotate-ccw"></i>Reopen</button>`
          :`<button class="btn btn-outline qsm" data-qdone title="Finished: ordered and delivered, or they decided not to"><i data-lucide="check"></i>Done</button>`}<button class="mini qdel" data-qdel title="Move to Trash" aria-label="Move request #${q.id} to Trash"><i data-lucide="trash-2"></i></button></div>`}
    </div>
    <div class="acts2">
      ${q.mobile?`<a class="btn btn-dark" data-reply href="tel:${esc(q.mobile)}"><i data-lucide="phone"></i>Call</a><a class="btn btn-outline" data-reply href="sms:${esc(q.mobile)}?&body=${encodeURIComponent(replyText(q))}"><i data-lucide="message-square"></i>Text</a>`:""}
      ${viberUrl(q.mobile)?`<a class="btn btn-outline viber" data-reply href="${esc(viberUrl(q.mobile))}"><i data-lucide="phone-call"></i>Viber</a>`:""}
      ${q.facebook?(messengerUrl(q.facebook)
        ?`<a class="btn btn-outline msgr" data-reply href="${esc(messengerUrl(q.facebook))}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>Messenger</a>`
        :`<a class="btn btn-outline msgr" data-reply href="https://www.facebook.com/search/people/?q=${encodeURIComponent(q.facebook)}" target="_blank" rel="noopener" title="Search Facebook for ${esc(q.facebook)}"><i data-lucide="search"></i>Find on Facebook</a>`):""}
      ${q.email?`<a class="btn btn-outline" data-reply href="${esc(gmailDraft(q))}" target="_blank" rel="noopener"><i data-lucide="mail"></i>Reply in Gmail</a>`:""}
      ${viberUrl(q.mobile)||q.facebook?`<button class="btn btn-outline" data-copymsg title="A ready reply to paste in Viber or Messenger"><i data-lucide="copy"></i>Copy message</button>`:""}
      ${q.attachment_path?`<button class="btn btn-outline" data-photo="${esc(q.attachment_path)}"><i data-lucide="image"></i>Reference photo</button>`:""}
    </div>
    ${q.delivery_address?`<div class="addr"><i data-lucide="map-pin"></i><span><b>Deliver to:</b> ${esc(q.delivery_address)}</span></div>`:""}
    ${q.message?`<div class="msg">${esc(q.message)}</div>`:""}
    ${items.length?`<ul class="items">${items.map(i=>`<li><b>${i.qty} ×</b> ${esc(i.id)} ${esc(i.name)}</li>`).join("")}</ul>
      <div class="est">Order total ${q.estimate_min===q.estimate_max?peso(q.estimate_min):peso(q.estimate_min)+" – "+peso(q.estimate_max)}</div>`:""}
    ${(q.liked_photos||[]).length?`<div class="liked"><div class="hint">Wants one like ${q.liked_photos.length>1?"these":"this"}:</div><div class="lrow">${q.liked_photos.map(l=>`<a href="${esc(l.src)}" target="_blank" rel="noopener" title="${esc(l.cat)}"><img src="${esc(l.src)}" alt="${esc(l.cat)}"><span>${esc(l.cat)}</span></a>`).join("")}</div></div>`:""}
    <label>Notes <span class="hint">Private. Saved when you click away.</span><textarea data-notes maxlength="5000" placeholder="e.g. Called 10/24, sending the price Friday">${esc(q.notes||"")}</textarea></label>
  </article>`;
}
$("#qfilters").onclick=e=>{const b=e.target.closest("[data-qf]"); if(b){qfilter=b.dataset.qf; renderQuotes();}};
$("#qtype").onclick=e=>{const b=e.target.closest("[data-qt]"); if(b){qtype=b.dataset.qt; renderQuotes();}};
$("#qsearch").oninput=e=>{qsearch=e.target.value.trim(); renderQuotes();};
// Any reply button marks a New request Replied; Copy message also puts the ready reply on the clipboard.
$("#qlist").addEventListener("click",async e=>{
  const r=e.target.closest("[data-reply],[data-copymsg],[data-history]"); if(!r) return;
  const q=quotes.find(x=>x.id===+r.closest(".qc").dataset.id);
  if(r.dataset.history!==undefined){ $("#qsearch").value=qsearch=r.dataset.history; renderQuotes(); $("#qsearch").scrollIntoView({block:"center",behavior:"smooth"}); return; }
  if(r.dataset.copymsg!==undefined) try{ await navigator.clipboard.writeText(replyText(q)); toast("Message copied. Paste it in Viber or Messenger, then fill in the blanks."); }catch{ toast("Copy is blocked here. Use Text or Reply in Gmail instead."); }
  if(q.status==="new"&&!await touch(q,{status:"contacted"})) renderQuotes();
});

/* Download: every request (Trash included, marked) as a CSV that opens in Excel or Google Sheets.
   Arkline's own backup, since the free Supabase plan keeps none. */
$("#qexport").onclick=async()=>{
  const btn=$("#qexport"); busy(btn,true,"Preparing…");
  const {data,error}=await supabase.from("quotation_requests").select("*").order("id");
  busy(btn,false,"Download");
  if(error) return show($("#qerr"),"Couldn't download: "+error.message);
  const cell=v=>{ const s=String(v??""); return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
  const abs=u=>u?new URL(u,location.origin).href:"";
  const cols=[["Number",q=>q.id],["Date",q=>new Date(q.created_at).toLocaleString("en-PH")],["Type",kindOf],["Status",q=>STATUS[q.status]||q.status],
    ["In Trash",q=>q.deleted_at?"yes":""],["Name",q=>q.full_name],["Mobile",q=>q.mobile],["Email",q=>q.email],["Contact by",q=>q.contact_pref],["Facebook",q=>q.facebook],["Delivery address",q=>q.delivery_address],
    ["Project type",q=>q.project_type],["Items",q=>(q.quote_items||[]).map(i=>`${i.qty} x ${i.id} ${i.name}`).join("; ")],
    ["Total from (PHP)",q=>q.estimate_min],["Total to (PHP)",q=>q.estimate_max],["Liked photos",q=>(q.liked_photos||[]).map(l=>`${l.cat}: ${abs(l.src)}`).join(" ; ")],
    ["Reference photo",q=>q.attachment_path?"yes":""],["Message",q=>q.message],["Private notes",q=>q.notes]];
  const csv="﻿"+[cols.map(c=>c[0]),...data.map(q=>cols.map(c=>c[1](q)))].map(r=>r.map(cell).join(",")).join("\r\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`arkline-requests-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast(`${plural(data.length,"request")} downloaded`);
};
$("#qlist").addEventListener("click",async e=>{
  const b=e.target.closest("[data-qdone],[data-qreopen]"); if(!b) return;
  const q=quotes.find(x=>x.id===+b.closest(".qc").dataset.id), done=b.dataset.qdone!==undefined;
  b.disabled=true;
  const error=await touch(q,{status:done?"closed":"contacted"});
  if(error){ b.disabled=false; show($("#qerr"),"Couldn't change status: "+error.message); return; }
  toast(done?`#${q.id} is Done`:`#${q.id} reopened`); renderQuotes();
});
$("#qlist").addEventListener("focusout",async e=>{
  const ta=e.target.closest("[data-notes]"); if(!ta) return;
  const q=quotes.find(x=>x.id===+ta.closest(".qc").dataset.id);
  if((q.notes||"")===ta.value) return;
  const error=await touch(q,{notes:ta.value||null});
  if(error){ show($("#qerr"),/notes/.test(error.message)?"Notes need one database update: run supabase/002_quotes_admin.sql in Supabase.":"Couldn't save notes: "+error.message); return; }
  toast(`Notes saved for #${q.id}`);
});
const TRASH_DB="Deleting requests needs one database update: run supabase/006_request_trash.sql in the Supabase SQL Editor.";
$("#qlist").addEventListener("click",async e=>{
  const b=e.target.closest("[data-qdel],[data-qrestore],[data-qforever]"); if(!b) return;
  const q=quotes.find(x=>x.id===+b.closest(".qc").dataset.id), who=`#${q.id} ${q.full_name}`;
  if(b.dataset.qdel!==undefined){
    if(!await confirmDialog({title:`Move request ${who} to Trash?`,message:"It leaves the inbox but stays saved. You can restore it from Trash at any time.",confirmLabel:"Move to Trash",danger:true,icon:"trash-2"})) return;
    const at=new Date().toISOString(), {error}=await supabase.from("quotation_requests").update({deleted_at:at}).eq("id",q.id);
    if(error) return show($("#qerr"),/deleted_at/.test(error.message)?TRASH_DB:"Couldn't delete: "+error.message);
    q.deleted_at=at; toast(`${who} moved to Trash`);
  } else if(b.dataset.qrestore!==undefined){
    const {error}=await supabase.from("quotation_requests").update({deleted_at:null}).eq("id",q.id);
    if(error) return show($("#qerr"),"Couldn't restore: "+error.message);
    q.deleted_at=null; toast(`${who} restored`);
  } else {
    if(!await confirmDialog({title:`Delete request ${who} forever?`,message:`The request${q.attachment_path?" and the customer's photo are":" is"} erased from the database and can't be restored.`,confirmLabel:"Delete forever",danger:true})) return;
    const {data,error}=await supabase.from("quotation_requests").delete().eq("id",q.id).select("id");
    if(error||!data?.length) return show($("#qerr"),error&&!/policy/i.test(error.message)?"Couldn't delete: "+error.message:TRASH_DB);
    if(q.attachment_path) await supabase.storage.from("quote-attachments").remove([q.attachment_path]);
    quotes=quotes.filter(x=>x!==q); toast(`${who} deleted forever`);
  }
  show($("#qerr")); renderQuotes();
});
$("#qlist").addEventListener("click",async e=>{
  const b=e.target.closest("[data-photo]"); if(!b) return;
  const w=window.open("","_blank");
  const {data,error}=await supabase.storage.from("quote-attachments").createSignedUrl(b.dataset.photo,600);
  if(error){ w?.close(); show($("#qerr"),"Couldn't open the photo: "+error.message); return; }
  if(w) w.location=data.signedUrl; else location.href=data.signedUrl;
});
$("#logout").onclick=()=>supabase.auth.signOut();

/* phone menu: ☰ opens the section list (#atabs); shown only while the dashboard is */
function menuOpen(on){ $("#atabs").classList.toggle("open",on); $("#amenu").setAttribute("aria-expanded",on); $("#amenu").setAttribute("aria-label",on?"Close menu":"Open menu"); }
$("#amenu").onclick=e=>{ e.stopPropagation(); menuOpen(!$("#atabs").classList.contains("open")); };
document.addEventListener("click",e=>{ if($("#atabs").classList.contains("open")&&!e.target.closest("#atabs")) menuOpen(false); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") menuOpen(false); });
new MutationObserver(()=>{ $("#amenu").hidden=$("#app").hidden; if($("#app").hidden) menuOpen(false); }).observe($("#app"),{attributes:true,attributeFilter:["hidden"]});

/* load + render */
async function load(){
  const [p,h]=await Promise.all([
    supabase.from("projects").select("*").order("created_at",{ascending:false}),
    supabase.from("hidden_photos").select("photo,created_at")
  ]);
  const err=p.error||h.error;
  if(err){ $("#list").innerHTML=`<p class="err">Couldn't load photos: ${esc(err.message)}</p>`; return; }
  rows=p.data; hidden=new Map(h.data.map(r=>[r.photo,r.created_at]));
  render();
}
// uploaded photos can be in any category; the bundled ones only in the built-in ones
const chips=(cur,n,list=categories())=>["All",...list].map(c=>`<button class="chip${c===cur?" on":""}" data-cat="${esc(c)}">${esc(c)}<small>${n(c)}</small></button>`).join("");
const tile=(src,cat,label,btn)=>`<div class="tile"><img src="${src}" alt="${esc(label)}" loading="lazy"><span class="tag">${esc(cat)}</span>${btn}</div>`;
const trashBtn=attr=>`<button class="del" ${attr} aria-label="Move to Trash" title="Move to Trash"><i data-lucide="trash-2"></i></button>`;
const empty=m=>`<div class="empty"><i data-lucide="image-off"></i><p>${m}</p></div>`;

function render(){
  const live=rows.filter(r=>!r.deleted_at);
  const n=c=>live.filter(r=>c==="All"||r.category===c).length;
  $("#count").textContent=plural(live.length,"photo");
  $("#afilters").innerHTML=chips(filter,n);
  const vis=live.filter(r=>filter==="All"||r.category===filter);
  $("#list").innerHTML=vis.length?vis.map(r=>tile(photoUrl(r.storage_path),r.category,r.caption||r.category,trashBtn(`data-trash="${r.id}"`))).join("")
    :empty(`No uploaded photos${filter==="All"?"":" in "+esc(filter)} yet.`);

  const shown=BUNDLED.filter(b=>!hidden.has(b.n));
  const bn=c=>shown.filter(b=>c==="All"||b.cat===c).length;
  $("#bcount").textContent=`${shown.length} of ${BUNDLED.length} showing`;
  $("#bfilters").innerHTML=chips(bfilter,bn,ORDER);
  const bvis=shown.filter(b=>bfilter==="All"||b.cat===bfilter);
  $("#blist").innerHTML=bvis.length?bvis.map(b=>tile(b.src,b.cat,b.cat,trashBtn(`data-hide="${b.n}"`))).join("")
    :empty(`All original${bfilter==="All"?"":" "+esc(bfilter)} photos are in Trash.`);

  // Trash: newest deletions first, uploaded and bundled together.
  const trash=[
    ...rows.filter(r=>r.deleted_at).map(r=>({at:r.deleted_at,html:tile(photoUrl(r.storage_path),r.category,r.caption||r.category,
      `<div class="acts"><button data-restore="${r.id}"><i data-lucide="rotate-ccw"></i>Restore</button><button class="forever" data-forever="${r.id}"><i data-lucide="x"></i>Delete forever</button></div>`)})),
    ...BUNDLED.filter(b=>hidden.has(b.n)).map(b=>({at:hidden.get(b.n),html:tile(b.src,b.cat,b.cat,
      `<div class="acts"><button data-unhide="${b.n}"><i data-lucide="rotate-ccw"></i>Restore</button></div>`)}))
  ].sort((a,b)=>a.at<b.at?1:-1);
  $("#tcount").textContent=plural(trash.length,"photo"); $("#gtcount").textContent=trash.length||"";
  $("#tlist").innerHTML=trash.length?trash.map(t=>t.html).join(""):empty("Trash is empty.");
  icons();
}
// Shortcut to Trash at the bottom of the Photos tab; once Trash is on screen it takes you back to the top.
let atTrash=false;
new IntersectionObserver(([e])=>{
  atTrash=e.isIntersecting; const b=$("#gotrash");
  b.classList.toggle("up",atTrash); b.setAttribute("aria-label",atTrash?"Back to top":"Go to Trash");
  b.querySelector("span").textContent=atTrash?"Top":"Trash";
}).observe($("#trash"));
$("#gotrash").onclick=()=>atTrash?scrollTo({top:0,behavior:"smooth"}):$("#trash").scrollIntoView({behavior:"smooth",block:"start"});
$("#afilters").onclick=e=>{const b=e.target.closest("[data-cat]"); if(b){filter=b.dataset.cat; render();}};
$("#bfilters").onclick=e=>{const b=e.target.closest("[data-cat]"); if(b){bfilter=b.dataset.cat; render();}};

/* trash, restore, delete forever */
async function act(btn,fn){
  btn.disabled=true;
  const {error}=await fn();
  if(error&&error.code!=="23505"){ notice("Couldn't update",error.message); btn.disabled=false; return false; }
  return true;
}
const now=()=>new Date().toISOString();
const askTrash=()=>confirmDialog({title:"Move this photo to Trash?",message:"It disappears from the website gallery. You can restore it from Trash at any time.",confirmLabel:"Move to Trash",danger:true,icon:"trash-2"});
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-trash],[data-hide],[data-restore],[data-unhide],[data-forever]"); if(!b) return;
  const d=b.dataset;
  if((d.trash||d.hide)&&!await askTrash()) return;
  if(d.trash){ const r=rows.find(x=>x.id===d.trash), at=now();
    if(await act(b,()=>supabase.from("projects").update({deleted_at:at}).eq("id",r.id))){ r.deleted_at=at; toast("Moved to Trash"); } }
  else if(d.hide){ const n=+d.hide, at=now();
    if(await act(b,()=>supabase.from("hidden_photos").insert({photo:n}))){ hidden.set(n,at); toast("Moved to Trash"); } }
  else if(d.restore){ const r=rows.find(x=>x.id===d.restore);
    if(await act(b,()=>supabase.from("projects").update({deleted_at:null}).eq("id",r.id))){ r.deleted_at=null; toast("Restored to the gallery"); } }
  else if(d.unhide){ const n=+d.unhide;
    if(await act(b,()=>supabase.from("hidden_photos").delete().eq("photo",n))){ hidden.delete(n); toast("Restored to the gallery"); } }
  else if(d.forever){ const r=rows.find(x=>x.id===d.forever);
    if(!await confirmDialog({title:"Delete this photo forever?",message:"It's removed from storage and can't be restored.",confirmLabel:"Delete forever",danger:true})) return;
    if(!await act(b,()=>supabase.from("projects").delete().eq("id",r.id))) return;
    await supabase.storage.from(PHOTO_BUCKET).remove([r.storage_path]);
    rows=rows.filter(x=>x!==r); toast("Deleted forever"); }
  render();
});
function toast(m){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.innerHTML=`<i data-lucide="check-circle-2"></i>`;t.append(m);document.body.appendChild(t);icons();setTimeout(()=>t.remove(),2300);}

/* upload */
/* categories: pick one for the upload, add a new one, delete the selected one */
function renderCats(selected=$("#u-cat").value){
  $("#u-cat").innerHTML=categories().map(c=>`<option${c===selected?" selected":""}>${esc(c)}</option>`).join("");
  $("#delcat").disabled=!categories().length;
}
renderCats();
async function addCat(){
  const btn=$("#addcat"); busy(btn,true,"Adding…");
  const err=await addCategory($("#newcat").value);
  busy(btn,false,"Add category"); show($("#caterr"),err);
  if(err) return;
  const name=categories().at(-1); $("#newcat").value=""; renderCats(name); render(); loadText();
  toast(`"${name}" added. Choose photos and Upload to show it on the website.`);
}
$("#addcat").onclick=addCat;
$("#newcat").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addCat(); } }); // don't submit the upload form
// "Delete category" removes the selected category, after a confirmation window.
$("#delcat").onclick=()=>{ const name=$("#u-cat").value; if(name) removeCat(name); else show($("#caterr"),"There's no category to delete."); };
async function removeCat(name){
  // uploaded photos in this category (on the site or in Trash) are deleted forever together with it
  const mine=rows.filter(r=>r.category===name), trashed=mine.filter(r=>r.deleted_at).length;
  const photos=mine.length?` Its ${plural(mine.length,"uploaded photo")}${trashed?` (${trashed} in Trash)`:""} will be deleted forever too.`:"";
  const msg=(isBuiltIn(name)
    ?"It disappears from the website together with its original photos. They aren't lost: add a category with exactly this name to bring them all back."
    :"It disappears from the category list and the website.")+photos;
  if(!await confirmDialog({title:`Remove the "${name}" category?`,message:msg,confirmLabel:mine.length?"Delete photos and category":"Remove category",danger:true})) return;
  for(const r of mine){
    const {error}=await supabase.from("projects").delete().eq("id",r.id);
    if(error){ return show($("#caterr"),"Couldn't delete a photo: "+error.message); }
    await supabase.storage.from(PHOTO_BUCKET).remove([r.storage_path]);
    rows=rows.filter(x=>x!==r);
  }
  const err=await deleteCategory(name);
  if(err){ show($("#caterr"),err); return; } // show why, e.g. it still has photos
  show($("#caterr")); renderCats(); render(); loadText(); toast(`"${name}" removed`);
}
$("#u-files").onchange=()=>{
  $("#queue").innerHTML=[...$("#u-files").files].map((f,i)=>`<div class="qitem" id="qi${i}"><img src="${URL.createObjectURL(f)}" alt=""><span>Ready</span></div>`).join("");
};
const mark=(i,cls,txt)=>{const el=$("#qi"+i); if(!el) return; el.className="qitem "+cls; el.querySelector("span").textContent=txt;};
$("#up").addEventListener("submit",async e=>{
  e.preventDefault();
  const files=[...$("#u-files").files], category=$("#u-cat").value, caption=$("#u-cap").value.trim()||null;
  if(!files.length){ show($("#uerr"),"Choose at least one photo."); return; }
  show($("#uerr")); const btn=$("#ubtn"); busy(btn,true,"Uploading…");
  let ok=0; const fails=[];
  for(const [i,f] of files.entries()){
    mark(i,"","Converting…");
    try{
      const w=await toWebp(f,1920,.8,{watermark:true});
      const path=`${slug(category)}/${crypto.randomUUID()}.${w.ext}`;
      mark(i,"",`Uploading ${Math.round(w.blob.size/1024)} KB…`);
      const up=await supabase.storage.from(PHOTO_BUCKET).upload(path,w.blob,{contentType:w.blob.type,cacheControl:"31536000"});
      if(up.error) throw up.error;
      const ins=await supabase.from("projects").insert({category,caption,storage_path:path,width:w.width,height:w.height});
      if(ins.error){ await supabase.storage.from(PHOTO_BUCKET).remove([path]); throw ins.error; }
      ok++; mark(i,"done","Uploaded");
    }catch(err){ fails.push(f.name+": "+(err.message||err)); mark(i,"fail","Failed"); }
  }
  busy(btn,false,"Upload");
  if(fails.length) show($("#uerr"),`${fails.length} of ${files.length} failed. ${fails.join(" · ")}`);
  if(ok){ $("#u-files").value=""; filter="All"; await load(); if(!fails.length) setTimeout(()=>$("#queue").innerHTML="",1500); }
});

if(!supabase){ $("#cfg").hidden=false; }
else{
  initContentTabs(toast); initAccount(toast);
  // auto sign-out after the chosen time without activity (Account tab), with a one-minute warning
  startIdleWatch({ isActive:()=>!$("#app").hidden, onTimeout:m=>{ idledOut=idleLabel(m); supabase.auth.signOut({scope:"local"}); } });
  auth=mountAuth($("#login"),{
    title:"Admin sign in", sub:"Use the Arkline admin account.",
    onPasswordSet:async()=>{ recovering=false; route((await supabase.auth.getSession()).data.session); }
  });
  // A reset-password link signs the user in first; ask for the new password before opening the admin.
  // Spot it from the link itself, because "signed in" can arrive before "password recovery".
  const showReset=()=>{ recovering=true; $("#app").hidden=true; $("#login").hidden=false; $("#logout").hidden=true; auth.show("reset"); };
  if(/(^|[#&?])type=recovery(&|$)/.test(location.hash+"&"+location.search.slice(1))) showReset();
  supabase.auth.onAuthStateChange((ev,session)=>{
    if(ev==="PASSWORD_RECOVERY"){ if(!recovering) setTimeout(showReset,0); recovering=true; return; }
    if(recovering||ev==="TOKEN_REFRESHED"||ev==="USER_UPDATED") return;
    if(ev==="SIGNED_IN"&&session?.user?.id&&session.user.id===signedInId) return; // password re-check in the Account tab
    signedInId=session?.user?.id||null;
    setTimeout(()=>route(session),0);
  });
  // Back/forward can bring back an old snapshot of this page (e.g. the sign-in screen): show who is signed in now.
  addEventListener("pageshow",e=>{ if(e.persisted) supabase.auth.getSession().then(({data})=>route(data.session)); });
}
icons();
