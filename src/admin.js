// /admin — Feature A. Signed-in admins upload, trash, restore and permanently delete gallery photos.
// Uploaded photos: projects.deleted_at set = in Trash. Bundled photos: a hidden_photos row = in Trash.
import { ORDER, BUNDLED, messengerUrl, viberUrl } from "./data.js";
import { loadProducts, loadText, initContentTabs } from "./admin-content.js";
import { supabase, photoUrl, PHOTO_BUCKET } from "./supabase.js";
import { toWebp } from "./image.js";
import { mountAuth } from "./auth.js";
import { confirmDialog, notice } from "./confirm.js";

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-");
const show = (el,m) => { el.hidden=!m; el.textContent=m||""; };
const busy = (btn,on,txt) => { btn.disabled=on; btn.querySelector("span").textContent=txt; };
const plural = (n,w) => `${n} ${w}${n===1?"":"s"}`;

let rows=[], hidden=new Map(), filter="All", bfilter="All";

/* auth */
let auth, recovering=false, adminEmail="";

// Gmail compose in a new tab, from the signed-in admin's Google account, with a drafted reply.
// Shop items = an order; only liked photos or a description = a price request.
const kindOf=q=>{ const o=(q.quote_items||[]).length>0, l=(q.liked_photos||[]).length>0; return o&&l?"Order + price request":o?"Order":"Price request"; };
function gmailDraft(q){
  const first=q.full_name.split(" ")[0], items=q.quote_items||[], liked=q.liked_photos||[], order=items.length>0;
  const est=q.estimate_min===q.estimate_max?peso(q.estimate_min):`${peso(q.estimate_min)} – ${peso(q.estimate_max)}`;
  const body=[
    `Hi ${first},`, "",
    `Thank you for your ${order?"order":"price request"} #${q.id} (${q.project_type}).`, "",
    ...(order?["Your order:",...items.map(i=>`- ${i.qty} × ${i.id} ${i.name}`),`Total from our shop prices: ${est}`,""]:[]),
    ...(liked.length?["You'd like one like these:",...liked.map(l=>`- ${l.cat}: ${new URL(l.src,location.origin).href}`),""]:[]),
    ...(q.message?["Your notes:",`"${q.message}"`,""]:[]),
    order?"[Confirm availability, delivery date, delivery fee and the 70% down payment here]":"[Write the full price and details here]", "",
    "Feel free to reply to this email or call us at 0962 269 8229.", "",
    "Best regards,", "Arkline Home & Office Furniture", "101 Lydia St., Brgy. Sta. Monica, Novaliches, Quezon City"
  ].join("\n");
  const p=new URLSearchParams({view:"cm",fs:"1",to:q.email,su:order?`Arkline order #${q.id}`:`Arkline price for request #${q.id}`,body});
  if(adminEmail) p.set("authuser",adminEmail);
  return "https://mail.google.com/mail/?"+p;
}
async function route(session){
  $("#logout").hidden=!session;
  if(!session){ $("#login").hidden=false; $("#app").hidden=true; auth.show("signin"); return; }
  const {data:isAdmin,error}=await supabase.rpc("is_admin");
  if(error||!isAdmin){
    $("#login").hidden=false; $("#app").hidden=true;
    $("#login").innerHTML=`<div class="q auth denied" style="display:grid"><h3 style="font-size:1.5rem">Not an admin account</h3>
      <p class="sub">You're signed in as <b>${esc(session.user.email)}</b>, which doesn't have access to Arkline's admin page. Sign out and use the admin account.</p>
      <button class="btn btn-primary" data-signout><i data-lucide="log-out"></i>Sign out</button></div>`;
    $("#login").querySelector("[data-signout]").onclick=()=>supabase.auth.signOut();
    icons(); return;
  }
  adminEmail=session.user.email;
  $("#login").hidden=true; $("#app").hidden=false;
  load(); loadQuotes(); loadProducts(); loadText();
}

/* tabs */
$("#atabs").onclick=e=>{
  const b=e.target.closest("[data-tab]"); if(!b) return;
  $("#atabs").querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected",x===b));
  for(const t of ["quotes","photos","prices","text"]) $("#tab-"+t).hidden=b.dataset.tab!==t;
};

/* quotes */
const STATUS={new:"New",contacted:"Contacted",quoted:"Price sent",closed:"Closed"};
let quotes=[], qfilter="active", qsearch="";
const peso=n=>"₱"+Number(n).toLocaleString("en-PH");
const when=d=>new Date(d).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
async function loadQuotes(){
  const {data,error}=await supabase.from("quotation_requests").select("*").order("created_at",{ascending:false}).limit(500);
  if(error){ show($("#qerr"),"Couldn't load requests: "+error.message); return; }
  quotes=data; renderQuotes();
}
function renderQuotes(){
  const n=k=>k==="all"?quotes.length:k==="active"?quotes.filter(q=>q.status!=="closed").length:quotes.filter(q=>q.status===k).length;
  const fresh=n("new"); $("#newc").textContent=fresh; $("#newc").hidden=!fresh;
  $("#qcount").textContent=plural(quotes.length,"request");
  $("#qfilters").innerHTML=[["active","Open"],...Object.entries(STATUS),["all","All"]]
    .map(([k,l])=>`<button class="chip${k===qfilter?" on":""}" data-qf="${k}">${l}<small>${n(k)}</small></button>`).join("");
  const s=qsearch.toLowerCase().replace(/^#/,"");
  const vis=quotes.filter(q=>(qfilter==="all"||(qfilter==="active"?q.status!=="closed":q.status===qfilter))
    &&(!s||[q.id,q.full_name,q.mobile,q.email,q.message].some(v=>String(v??"").toLowerCase().includes(s))));
  $("#qlist").innerHTML=vis.length?vis.map(card).join(""):empty(quotes.length?"No requests match.":"No price requests yet. They'll appear here as soon as a customer sends the form.");
  icons();
}
function card(q){
  const items=(q.quote_items||[]);
  return `<article class="qc st-${q.status}" data-id="${q.id}">
    <div class="qc-top">
      <div><div class="qc-id"><span class="kind ${(q.quote_items||[]).length?"order":"price"}">${kindOf(q)}</span>${q.contact_pref?`<span class="kind pref">Prefers ${esc(q.contact_pref)}</span>`:""} #${q.id} · ${when(q.created_at)}</div><h3>${esc(q.full_name)}</h3><div class="meta">${esc(q.project_type)}${q.mobile?" · "+esc(q.mobile):""}${q.email?" · "+esc(q.email):""}</div></div>
      <select data-status aria-label="Status of request #${q.id}">${Object.entries(STATUS).map(([k,l])=>`<option value="${k}"${k===q.status?" selected":""}>${l}</option>`).join("")}</select>
    </div>
    <div class="acts2">
      ${q.mobile?`<a class="btn btn-dark" href="tel:${esc(q.mobile)}"><i data-lucide="phone"></i>Call</a><a class="btn btn-outline" href="sms:${esc(q.mobile)}"><i data-lucide="message-square"></i>Text</a>`:""}
      ${viberUrl(q.mobile)?`<a class="btn btn-outline viber" href="${esc(viberUrl(q.mobile))}"><i data-lucide="phone-call"></i>Viber</a>`:""}
      ${q.facebook?(messengerUrl(q.facebook)
        ?`<a class="btn btn-outline msgr" href="${esc(messengerUrl(q.facebook))}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>Messenger</a>`
        :`<a class="btn btn-outline msgr" href="https://www.facebook.com/search/people/?q=${encodeURIComponent(q.facebook)}" target="_blank" rel="noopener" title="Search Facebook for ${esc(q.facebook)}"><i data-lucide="search"></i>Find on Facebook</a>`):""}
      ${q.email?`<a class="btn btn-outline" href="${esc(gmailDraft(q))}" target="_blank" rel="noopener"><i data-lucide="mail"></i>Reply in Gmail</a>`:""}
      ${q.attachment_path?`<button class="btn btn-outline" data-photo="${esc(q.attachment_path)}"><i data-lucide="image"></i>Reference photo</button>`:""}
    </div>
    ${q.message?`<div class="msg">${esc(q.message)}</div>`:""}
    ${items.length?`<ul class="items">${items.map(i=>`<li><b>${i.qty} ×</b> ${esc(i.id)} ${esc(i.name)}</li>`).join("")}</ul>
      <div class="est">Order total ${q.estimate_min===q.estimate_max?peso(q.estimate_min):peso(q.estimate_min)+" – "+peso(q.estimate_max)}</div>`:""}
    ${(q.liked_photos||[]).length?`<div class="liked"><div class="hint">Wants one like ${q.liked_photos.length>1?"these":"this"}:</div><div class="lrow">${q.liked_photos.map(l=>`<a href="${esc(l.src)}" target="_blank" rel="noopener" title="${esc(l.cat)}"><img src="${esc(l.src)}" alt="${esc(l.cat)}"><span>${esc(l.cat)}</span></a>`).join("")}</div></div>`:""}
    <label>Notes <span class="hint">Private. Saved when you click away.</span><textarea data-notes maxlength="5000" placeholder="e.g. Called 10/24, sending the price Friday">${esc(q.notes||"")}</textarea></label>
  </article>`;
}
$("#qfilters").onclick=e=>{const b=e.target.closest("[data-qf]"); if(b){qfilter=b.dataset.qf; renderQuotes();}};
$("#qsearch").oninput=e=>{qsearch=e.target.value.trim(); renderQuotes();};
$("#qlist").addEventListener("change",async e=>{
  const sel=e.target.closest("[data-status]"); if(!sel) return;
  const q=quotes.find(x=>x.id===+sel.closest(".qc").dataset.id), prev=q.status;
  sel.disabled=true;
  const {error}=await supabase.from("quotation_requests").update({status:sel.value}).eq("id",q.id);
  sel.disabled=false;
  if(error){ sel.value=prev; show($("#qerr"),"Couldn't change status: "+error.message); return; }
  q.status=sel.value; toast(`#${q.id} marked ${STATUS[q.status]}`); renderQuotes();
});
$("#qlist").addEventListener("focusout",async e=>{
  const ta=e.target.closest("[data-notes]"); if(!ta) return;
  const q=quotes.find(x=>x.id===+ta.closest(".qc").dataset.id);
  if((q.notes||"")===ta.value) return;
  const {error}=await supabase.from("quotation_requests").update({notes:ta.value||null}).eq("id",q.id);
  if(error){ show($("#qerr"),/notes/.test(error.message)?"Notes need one database update: run supabase/002_quotes_admin.sql in Supabase.":"Couldn't save notes: "+error.message); return; }
  q.notes=ta.value||null; toast(`Notes saved for #${q.id}`);
});
$("#qlist").addEventListener("click",async e=>{
  const b=e.target.closest("[data-photo]"); if(!b) return;
  const w=window.open("","_blank");
  const {data,error}=await supabase.storage.from("quote-attachments").createSignedUrl(b.dataset.photo,600);
  if(error){ w?.close(); show($("#qerr"),"Couldn't open the photo: "+error.message); return; }
  if(w) w.location=data.signedUrl; else location.href=data.signedUrl;
});
$("#logout").onclick=()=>supabase.auth.signOut();

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
const chips=(cur,n)=>["All",...ORDER].map(c=>`<button class="chip${c===cur?" on":""}" data-cat="${c}">${c}<small>${n(c)}</small></button>`).join("");
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
  $("#bfilters").innerHTML=chips(bfilter,bn);
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
  $("#tcount").textContent=plural(trash.length,"photo");
  $("#tlist").innerHTML=trash.length?trash.map(t=>t.html).join(""):empty("Trash is empty.");
  icons();
}
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
$("#u-cat").innerHTML=ORDER.map(c=>`<option>${c}</option>`).join("");
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
      const w=await toWebp(f,1920,.8);
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
  initContentTabs(toast);
  auth=mountAuth($("#login"),{
    title:"Admin sign in", sub:"Use the Arkline admin account.",
    onPasswordSet:async()=>{ recovering=false; route((await supabase.auth.getSession()).data.session); }
  });
  supabase.auth.onAuthStateChange((ev,session)=>{
    // A reset-password link signs the user in first; ask for the new password before opening the admin.
    if(ev==="PASSWORD_RECOVERY"){ recovering=true; $("#app").hidden=true; $("#login").hidden=false; $("#logout").hidden=true; setTimeout(()=>auth.show("reset"),0); return; }
    if(recovering||ev==="TOKEN_REFRESHED"||ev==="USER_UPDATED") return;
    setTimeout(()=>route(session),0);
  });
}
icons();
