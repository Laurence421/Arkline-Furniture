// /admin — Feature A. Signed-in admins upload, trash, restore and permanently delete gallery photos.
// Uploaded photos: projects.deleted_at set = in Trash. Bundled photos: a hidden_photos row = in Trash.
import { ORDER, BUNDLED } from "./data.js";
import { supabase, photoUrl, PHOTO_BUCKET } from "./supabase.js";
import { toWebp } from "./image.js";

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-");
const show = (el,m) => { el.hidden=!m; el.textContent=m||""; };
const busy = (btn,on,txt) => { btn.disabled=on; btn.querySelector("span").textContent=txt; };
const plural = (n,w) => `${n} ${w}${n===1?"":"s"}`;

let rows=[], hidden=new Map(), filter="All", bfilter="All";

/* auth */
async function route(session){
  $("#logout").hidden=!session;
  if(!session){ $("#login").hidden=false; $("#app").hidden=true; return; }
  const {data:isAdmin,error}=await supabase.rpc("is_admin");
  if(error||!isAdmin){
    await supabase.auth.signOut();
    show($("#lerr"),"This account isn't an Arkline admin.");
    return;
  }
  $("#login").hidden=true; $("#app").hidden=false;
  load();
}
$("#login").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("#lbtn"); busy(btn,true,"Signing in…"); show($("#lerr"));
  const {error}=await supabase.auth.signInWithPassword({email:$("#l-email").value.trim(),password:$("#l-pass").value});
  busy(btn,false,"Sign in");
  if(error) show($("#lerr"),error.message==="Invalid login credentials"?"Wrong email or password.":error.message);
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
  if(error&&error.code!=="23505"){ alert("Couldn't update: "+error.message); btn.disabled=false; return false; }
  return true;
}
const now=()=>new Date().toISOString();
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-trash],[data-hide],[data-restore],[data-unhide],[data-forever]"); if(!b) return;
  const d=b.dataset;
  if(d.trash){ const r=rows.find(x=>x.id===d.trash), at=now();
    if(await act(b,()=>supabase.from("projects").update({deleted_at:at}).eq("id",r.id))){ r.deleted_at=at; toast("Moved to Trash"); } }
  else if(d.hide){ const n=+d.hide, at=now();
    if(await act(b,()=>supabase.from("hidden_photos").insert({photo:n}))){ hidden.set(n,at); toast("Moved to Trash"); } }
  else if(d.restore){ const r=rows.find(x=>x.id===d.restore);
    if(await act(b,()=>supabase.from("projects").update({deleted_at:null}).eq("id",r.id))){ r.deleted_at=null; toast("Restored to the gallery"); } }
  else if(d.unhide){ const n=+d.unhide;
    if(await act(b,()=>supabase.from("hidden_photos").delete().eq("photo",n))){ hidden.delete(n); toast("Restored to the gallery"); } }
  else if(d.forever){ const r=rows.find(x=>x.id===d.forever);
    if(!confirm("Delete this photo forever? This can't be undone.")) return;
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
  supabase.auth.onAuthStateChange((ev,session)=>{ if(ev!=="TOKEN_REFRESHED") setTimeout(()=>route(session),0); });
}
icons();
