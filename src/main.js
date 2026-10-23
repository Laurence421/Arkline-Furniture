import { CATS, ORDER, img, BUNDLED, CHAIRS, TABLES, ALL, CONTACT, pt } from "./data.js";
import { supabase, photoUrl } from "./supabase.js";
import { toWebp } from "./image.js";

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const $ = s => document.querySelector(s);

// Uploads from /admin come first, then bundled photos minus the ones an admin deleted (loadRemote).
let PHOTOS = BUNDLED;
const count = c => c==="All" ? PHOTOS.length : PHOTOS.filter(p=>p.cat===c).length;
const cover = c => PHOTOS.find(p=>p.cat===c)?.src || img(CATS[c][0]);
const alt = p => p.alt || p.cat+" completed by Arkline";

/* hero slideshow */
const SLIDES=[[186,"Workstation"],[164,"Conference Table"],[32,"Reception Counter"],[34,"Executive Table"],[72,"Workstation"]];
let si=0, timer;
function buildSlides(){
  $("#slides").innerHTML = SLIDES.map((s,i)=>`<img src="${img(s[0])}" alt="${s[1]} project by Arkline" class="${i?"":"on"}" ${i?'loading="lazy"':'fetchpriority="high"'}>`).join("");
  $("#dots").innerHTML = SLIDES.map((s,i)=>`<button aria-label="Show slide ${i+1}" class="${i?"":"on"}"></button>`).join("");
  [...$("#dots").children].forEach((b,i)=>b.onclick=()=>{go(i);restart();});
  go(0);
}
function go(i){ si=i; [...$("#slides").children].forEach((im,k)=>im.classList.toggle("on",k===i)); [...$("#dots").children].forEach((d,k)=>d.classList.toggle("on",k===i)); $("#slideCap").textContent=SLIDES[i][1]; }
function restart(){ clearInterval(timer); if(!matchMedia("(prefers-reduced-motion: reduce)").matches) timer=setInterval(()=>go((si+1)%SLIDES.length),5500); }

/* categories + gallery */
let filter="All", shown=12, visible=[];
function buildCats(){
  $("#cats").innerHTML = ORDER.map(c=>`<button class="cat" data-go="${c}"><img src="${cover(c)}" alt="${c} project" loading="lazy"><span class="lbl"><b>${c}</b><span>${count(c)} photos</span></span></button>`).join("");
  $("#filters").innerHTML = ["All",...ORDER].map(c=>`<button class="chip" data-cat="${c}">${c}<small>${count(c)}</small></button>`).join("");
}
$("#cats").onclick=e=>{const b=e.target.closest("[data-go]"); if(!b) return; setFilter(b.dataset.go); $("#projects").scrollIntoView();};
$("#filters").onclick=e=>{const b=e.target.closest("[data-cat]"); if(b) setFilter(b.dataset.cat);};
function buildGallery(){
  $("#gallery").innerHTML = PHOTOS.map((p,i)=>`<button class="tile" data-i="${i}" aria-label="View ${p.cat} photo"><img src="${p.src}" alt="${esc(alt(p))}" loading="${i<6?"eager":"lazy"}"><span class="tag">${p.cat}</span><span class="zoom"><i data-lucide="maximize-2"></i></span></button>`).join("");
  icons();
}
$("#gallery").onclick=e=>{const t=e.target.closest(".tile"); if(t) openLb(PHOTOS[+t.dataset.i]);};
function setFilter(c){
  filter=c; shown=12;
  document.querySelectorAll(".chip").forEach(b=>b.classList.toggle("on",b.dataset.cat===c));
  applyFilter();
}
function applyFilter(){
  visible = PHOTOS.filter(p=>filter==="All"||p.cat===filter);
  const keep = new Set(visible.slice(0,shown));
  document.querySelectorAll(".tile").forEach(t=>t.classList.toggle("hide",!keep.has(PHOTOS[+t.dataset.i])));
  $("#moreBtn").parentElement.hidden = visible.length<=shown;
}
$("#moreBtn").onclick=()=>{ shown+=12; applyFilter(); };
async function loadRemote(){
  const [p,h]=await Promise.all([
    supabase.from("projects").select("category,storage_path,caption").is("deleted_at",null).order("created_at",{ascending:false}),
    supabase.from("hidden_photos").select("photo")
  ]);
  if(p.error||h.error){ console.warn("Couldn't load gallery changes",p.error||h.error); return; }
  const hidden=new Set(h.data.map(r=>r.photo));
  const up=p.data.filter(r=>CATS[r.category]).map(r=>({src:photoUrl(r.storage_path),cat:r.category,alt:r.caption}));
  PHOTOS=[...up,...BUNDLED.filter(b=>!hidden.has(b.n))];
}
// Wait briefly for admin changes so deleted photos don't flash in, then render regardless.
async function initGallery(){
  const render=()=>{ buildCats(); buildGallery(); setFilter(filter); };
  if(!supabase){ render(); return; }
  let drawn=false;
  const remote=loadRemote().catch(e=>console.warn(e)).then(()=>{ if(drawn) render(); });
  await Promise.race([remote,new Promise(r=>setTimeout(r,2500))]);
  drawn=true; render();
}

/* lightbox */
let li=0,lastF=null;
function openLb(p){ lastF=document.activeElement; li=visible.indexOf(p); $("#lb").hidden=false; document.body.style.overflow="hidden"; renderLb(); $("#lbX").focus(); }
function closeLb(){ $("#lb").hidden=true; document.body.style.overflow=""; lastF&&lastF.focus(); }
function renderLb(){
  const p=visible[li]; $("#lbImg").src=p.src; $("#lbImg").alt=alt(p);
  $("#lbCap").textContent=`${p.cat} · ${li+1} of ${visible.length}`;
  $("#lbStrip").innerHTML=visible.map((v,i)=>`<img src="${v.src}" alt="" data-k="${i}" class="${i===li?"on":""}">`).join("");
  $("#lbStrip").children[li]?.scrollIntoView({block:"nearest",inline:"center"});
}
$("#lbStrip").onclick=e=>{const k=e.target.dataset.k; if(k!=null){li=+k;renderLb();}};
const stepLb=d=>{li=(li+d+visible.length)%visible.length;renderLb();};
$("#lbPrev").onclick=()=>stepLb(-1); $("#lbNext").onclick=()=>stepLb(1); $("#lbX").onclick=closeLb;
let tx=0; $("#lb").addEventListener("touchstart",e=>tx=e.touches[0].clientX,{passive:true});
$("#lb").addEventListener("touchend",e=>{const d=e.changedTouches[0].clientX-tx; if(Math.abs(d)>50) stepLb(d<0?1:-1);});
document.addEventListener("keydown",e=>{
  if(!$("#lb").hidden){ if(e.key==="Escape")closeLb(); if(e.key==="ArrowLeft")stepLb(-1); if(e.key==="ArrowRight")stepLb(1); return; }
  if(e.key==="Escape") closeDrawer();
});

/* catalogue */
let quote={}; try{quote=JSON.parse(localStorage.getItem("ark-quote")||"{}")||{};}catch(e){}
const save=()=>{try{localStorage.setItem("ark-quote",JSON.stringify(quote));}catch(e){}};
const addBtn=it=>quote[it.id]?`<button class="btn btn-outline add in" data-add="${it.id}"><i data-lucide="check"></i>In quote list</button>`:`<button class="btn btn-outline add" data-add="${it.id}"><i data-lucide="plus"></i>Add to quote</button>`;
const li_=f=>f.map(x=>`<li><i data-lucide="check"></i><span>${x}</span></li>`).join("");
function plan(t){
  const W=2600,H=1800,ox=110,oy=170; let g="";
  for(let x=0;x<=W;x+=300) g+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="hsl(32 18% 82%)" stroke-width="4"/>`;
  for(let y=0;y<=H;y+=300) g+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="hsl(32 18% 82%)" stroke-width="4"/>`;
  const r=(x,y,w,h,f)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${f}" stroke="hsl(27 52% 30%)" stroke-width="12"/>`;
  let s=r(ox,oy,t.L,t.W,"hsl(30 45% 78%)");
  if(t.x?.ret) s+=r(ox+t.L-t.x.ret[0],oy+t.W,t.x.ret[0],t.x.ret[1],"hsl(30 45% 78%)");
  if(t.x?.side) s+=r(ox,oy+t.W+120,t.x.side[0],t.x.side[1],"hsl(0 0% 100%)");
  const d=`<line x1="${ox}" y1="100" x2="${ox+t.L}" y2="100" stroke="hsl(30 58% 50%)" stroke-width="10"/><line x1="${ox}" y1="70" x2="${ox}" y2="130" stroke="hsl(30 58% 50%)" stroke-width="10"/><line x1="${ox+t.L}" y1="70" x2="${ox+t.L}" y2="130" stroke="hsl(30 58% 50%)" stroke-width="10"/><text x="${ox+t.L/2}" y="72" text-anchor="middle">${t.L} mm</text><text x="${ox+t.L+30}" y="${oy+t.W/2+24}">${t.W}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Top view ${t.L} by ${t.W} mm">${g}${s}${d}</svg>`;
}
function renderCatalogue(){
  $("#pane-chairs").innerHTML=CHAIRS.map(c=>`<article class="card"><div class="ph"><span class="code">${c.id}</span><img src="${img(c.im)}" alt="${c.id} ergonomic office chair" loading="lazy"></div>
    <div class="body"><h3>${c.name}</h3><span class="price">${pt(c)}</span>
    <details><summary>Product features<i data-lucide="chevron-down"></i></summary><ul>${li_(c.f)}</ul></details>${addBtn(c)}</div></article>`).join("");
  $("#tgrid").innerHTML=TABLES.map(t=>`<article class="card"><div class="plan"><span class="code" style="position:absolute;left:12px;top:12px;font-size:.72rem;font-weight:800;padding:4px 10px;border-radius:999px;background:var(--card);color:var(--walnut)">${t.id}</span>${plan(t)}</div>
    <div class="body"><span class="dims">${t.L} × ${t.W} × 750 mm</span><h3>${t.name}</h3><span class="price">${pt(t)}</span><ul>${li_(t.f)}</ul>${addBtn(t)}</div></article>`).join("");
  icons();
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));
  $("#pane-chairs").hidden=b.dataset.tab!=="chairs"; $("#pane-tables").hidden=b.dataset.tab!=="tables";
});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-add]"); if(!b) return;
  const id=b.dataset.add; if(quote[id]) delete quote[id]; else {quote[id]=1; toast(id+" added to your quote list");}
  save(); renderCatalogue(); renderQuote();
});

/* quote */
function totals(){let a=0,z=0,n=0;for(const[id,q] of Object.entries(quote)){const it=ALL[id];if(!it)continue;a+=it.min*q;z+=it.max*q;n+=q;}return{a,z,n};}
function renderQuote(){
  const ids=Object.keys(quote).filter(id=>ALL[id]); const{a,z,n}=totals();
  $("#qc").textContent=n;
  $("#qitems").innerHTML=ids.length?ids.map(id=>{const it=ALL[id];return `<div class="qi"><div class="th">${it.im?`<img src="${img(it.im)}" alt="">`:`<i data-lucide="table-2"></i>`}</div>
    <div style="min-width:0"><div class="nm">${it.name}</div><div class="sub">${id} · ${pt({min:it.min*quote[id],max:it.max*quote[id]})}</div><button class="rm" data-rm="${id}">Remove</button></div>
    <div class="qty"><button data-q="${id}" data-d="-1" aria-label="Fewer">−</button><b>${quote[id]}</b><button data-q="${id}" data-d="1" aria-label="More">+</button></div></div>`}).join("")
    :`<div class="empty"><i data-lucide="clipboard-list"></i><p>No items yet. Tap "Add to quote" on any chair or table.</p></div>`;
  $("#qtotal").textContent=n?pt({min:a,max:z}):"₱0";
  $("#qsum").innerHTML=n?`<b style="color:var(--ink)">${n} item${n>1?"s":""} from your quote list will be included</b> · est. ${pt({min:a,max:z})}<br>${ids.map(id=>quote[id]+" × "+id).join(", ")}`:`Your quote list is empty. You can add chairs or tables from the <a href="#shop">shop</a>.`;
  icons();
}
$("#qitems").addEventListener("click",e=>{
  const q=e.target.closest("[data-q]"),r=e.target.closest("[data-rm]");
  if(q){const id=q.dataset.q;quote[id]=Math.max(1,Math.min(99,quote[id]+ +q.dataset.d));}
  if(r) delete quote[r.dataset.rm];
  if(q||r){save();renderQuote();renderCatalogue();}
});
function openDrawer(){$("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false");$("#scrim").hidden=false;$("#closeQ").focus();}
function closeDrawer(){$("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");$("#scrim").hidden=true;}
$("#openQ").onclick=openDrawer; $("#closeQ").onclick=closeDrawer; $("#scrim").onclick=closeDrawer;
$("#toForm").onclick=()=>{closeDrawer();$("#contact").scrollIntoView();setTimeout(()=>$("#f-name").focus({preventScroll:true}),450);};
$("#copyList").onclick=()=>{const ids=Object.keys(quote);if(!ids.length){toast("Your quote list is empty");return;}const{a,z}=totals();
  copy("Arkline quotation request\n"+ids.map(id=>`${quote[id]} x ${id} ${ALL[id].name} (${pt(ALL[id])})`).join("\n")+`\nEstimated total: ${pt({min:a,max:z})}`,"Quote list copied");};

/* misc */
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(m){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.innerHTML=`<i data-lucide="check-circle-2"></i>`;t.append(m);document.body.appendChild(t);icons();setTimeout(()=>t.remove(),2300);}
function copy(txt,m){try{navigator.clipboard.writeText(txt).then(()=>toast(m||"Copied"),()=>toast("Copy is blocked here. Select the text instead."));}catch(e){toast("Copy is blocked here. Select the text instead.");}}
document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.copy,"Copied "+b.dataset.copy));
$("#menu").onclick=()=>{const o=$("#links").classList.toggle("open");$("#menu").setAttribute("aria-expanded",o);};
$("#links").onclick=e=>{if(e.target.tagName==="A"){$("#links").classList.remove("open");$("#menu").setAttribute("aria-expanded","false");}};
const navs=[...document.querySelectorAll(".links a")];
const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting)navs.forEach(l=>l.classList.toggle("on",l.getAttribute("href")==="#"+en.target.id));}),{rootMargin:"-45% 0px -50% 0px"});
document.querySelectorAll("main section[id]").forEach(s=>io.observe(s));

/* chat buttons (shown only when CONTACT has values) */
(function chats(){
  const viber=CONTACT.viber.replace(/\D/g,"").replace(/^0/,"63");
  const links=[
    CONTACT.messenger&&`<a class="btn btn-glass" href="${CONTACT.messenger}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>Messenger</a>`,
    viber&&`<a class="btn btn-glass" href="viber://chat?number=%2B${viber}"><i data-lucide="phone"></i>Viber ${CONTACT.viber}</a>`
  ].filter(Boolean);
  if(!links.length) return;
  $("#chats").innerHTML=links.join(""); $("#msgrow").hidden=false;
  if(CONTACT.messenger){ $("#fab").href=CONTACT.messenger; $("#fab").hidden=false; }
})();

/* Cloudflare Turnstile spam check (only when a site key is configured) */
const TS_KEY=import.meta.env.VITE_TURNSTILE_SITE_KEY;
let tsWidget=null;
if(TS_KEY){
  window.onTurnstileLoad=()=>{ $("#ts").hidden=false; tsWidget=turnstile.render("#ts",{sitekey:TS_KEY,theme:"light"}); };
  const s=document.createElement("script");
  s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad"; s.async=true;
  document.head.appendChild(s);
}

/* quotation form → /api/quote */
const FALLBACK="Please call 0962 269 8229 or email arklinehomeandofficefurnitures@gmail.com instead.";
function formError(m){ $("#ferr").hidden=!m; $("#ferr").textContent=m; }
$("#qform").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("#f-name").value.trim(),phone=$("#f-phone").value.replace(/[\s-]/g,""),email=$("#f-email").value.trim(),file=$("#f-photo").files[0];
  let m="";
  if(!name) m="Add your name so we know who to address the quotation to.";
  else if(!/^(09|\+639)\d{9}$/.test(phone)&&!/^\S+@\S+\.\S+$/.test(email)) m="Add a mobile number (09XX XXX XXXX) or an email so we can send your quotation.";
  else if(file&&!file.type.startsWith("image/")) m="The reference photo must be an image.";
  else if(file&&file.size>25*1024*1024) m="The reference photo is over 25 MB. Try a smaller one.";
  formError(m); $("#fsent").hidden=true;
  if(m) return;

  const btn=$("#qsend"), label=btn.querySelector("span");
  btn.disabled=true; label.textContent="Sending…";
  try{
    const fd=new FormData($("#qform"));
    fd.delete("photo");
    if(file){
      try{ const w=await toWebp(file,1600,.82); fd.set("photo",w.blob,"reference."+w.ext); }
      catch(err){ if(file.size<=5*1024*1024) fd.set("photo",file); else throw new Error("We couldn't read that photo. Try a JPG or PNG under 5 MB."); }
    }
    fd.set("items",JSON.stringify(Object.keys(quote).filter(id=>ALL[id]).map(id=>({id,qty:quote[id]}))));
    const r=await fetch("/api/quote",{method:"POST",body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||"Something went wrong sending your request.");
    $("#qform").reset(); quote={}; save(); renderQuote(); renderCatalogue();
    $("#fsent").textContent=`Thanks, ${name.split(" ")[0]}! Your request${j.id?" #"+j.id:""} is in. We usually reply within one business day.${j.id?" Mention #"+j.id+" when you message us.":""}`;
    $("#fsent").hidden=false; $("#fsent").focus();
  }catch(err){
    formError(err instanceof TypeError?"We couldn't reach our server. "+FALLBACK:err.message);
  }finally{
    btn.disabled=false; label.textContent="Send request";
    if(tsWidget!=null) try{ turnstile.reset(tsWidget); }catch(e){}
  }
});

buildSlides(); restart(); renderCatalogue(); renderQuote(); icons();
initGallery();
