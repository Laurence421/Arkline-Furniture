import "./icons.js";
import { CATS, ORDER, img, BUNDLED, CHAIRS as CHAIRS0, TABLES as TABLES0, ALL as ALL0, KINDS, isChair, cents, fromRow, messengerUrl, viberUrl, pt } from "./data.js";
import { CONTENT_DEFAULTS } from "./content.js";
import { toWebp } from "./image.js";

// Catalogue and text start from the built-in copies and are replaced by the admin's saved versions (loadSiteData).
let ITEMS=[...CHAIRS0,...TABLES0], ALL=ALL0, TEXT={...CONTENT_DEFAULTS};

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const $ = s => document.querySelector(s);

// Uploads from /admin come first, then bundled photos minus the ones an admin deleted (loadRemote).
let PHOTOS = BUNDLED;
const count = c => c==="All" ? PHOTOS.length : PHOTOS.filter(p=>p.cat===c).length;
const cover = c => PHOTOS.find(p=>p.cat===c)?.src || (CATS[c] ? img(CATS[c][0]) : "");
// Category order: the admin's list from the database (built-in ones first until it loads). Only categories with photos show.
let CATEGORIES = [...ORDER];
const shownCats = () => CATEGORIES.filter(c => count(c) > 0);
const alt = p => p.alt || p.cat+" completed by Arkline";

/* hero slideshow */
// Banner slides: clean (no watermark), enhanced 1920x1080 copies of large originals (public/img/hero-N.webp).
const SLIDES=[["/img/hero-1.webp?v=3","Workstation"],["/img/hero-2.webp","Cubicle Partition"],["/img/hero-3.webp","Conference Table"],["/img/hero-4.webp","Kitchen Cabinet"],["/img/hero-5.webp","Executive Table"]];
let si=0, timer;
function buildSlides(){
  // Only the first slide downloads with the page; each next one loads just before it's shown (go).
  $("#slides").innerHTML = SLIDES.map((s,i)=>`<img ${i?"data-src":"src"}="${s[0]}" alt="${s[1]} project by Arkline" class="${i?"":"on"}" ${i?"":'fetchpriority="high"'}>`).join("");
  $("#dots").innerHTML = SLIDES.map((s,i)=>`<button aria-label="Show slide ${i+1}" class="${i?"":"on"}"></button>`).join("");
  [...$("#dots").children].forEach((b,i)=>b.onclick=()=>{go(i);restart();});
  go(0);
}
const warm=k=>{ const im=$("#slides").children[k%SLIDES.length]; if(im?.dataset.src){ im.src=im.dataset.src; im.removeAttribute("data-src"); } };
function go(i){ si=i; warm(i); if(document.readyState==="complete") warm(i+1); else addEventListener("load",()=>warm(i+1),{once:true}); [...$("#slides").children].forEach((im,k)=>im.classList.toggle("on",k===i)); [...$("#dots").children].forEach((d,k)=>d.classList.toggle("on",k===i)); $("#slideCap").textContent=SLIDES[i][1]; }
function restart(){ clearInterval(timer); if(!matchMedia("(prefers-reduced-motion: reduce)").matches) timer=setInterval(()=>go((si+1)%SLIDES.length),5500); }

/* categories + gallery */
let filter="All", shown=12, visible=[];
let likes=[]; try{likes=JSON.parse(localStorage.getItem("ark-likes")||"[]")||[];}catch(e){}
const saveLikes=()=>{try{localStorage.setItem("ark-likes",JSON.stringify(likes));}catch(e){}};
const isLiked=p=>likes.some(l=>l.src===p.src);
const fromLabel=c=>{const f=(TEXT["gallery.from"]||{})[c]; return f&&f.price?`from ${pt({min:f.price,max:f.price})}${f.unit?" "+f.unit:""}`:"";};
function buildCats(){
  $("#statTypes").textContent = shownCats().length; // project types shown on the site
  $("#cats").innerHTML = shownCats().map(c=>`<button class="cat" data-go="${esc(c)}"><img src="${cover(c)}" alt="${esc(c)} project" loading="lazy"><span class="lbl"><b>${esc(c)}${fromLabel(c)?`<small class="from">${esc(fromLabel(c))}</small>`:""}</b><span>${count(c)} photos</span></span></button>`).join("");
  $("#filters").innerHTML = ["All",...shownCats()].map(c=>`<button class="chip" data-cat="${esc(c)}">${esc(c)}<small>${count(c)}</small></button>`).join("");
}
$("#cats").onclick=e=>{const b=e.target.closest("[data-go]"); if(!b) return; setFilter(b.dataset.go); $("#projects").scrollIntoView();};
$("#filters").onclick=e=>{const b=e.target.closest("[data-cat]"); if(b) setFilter(b.dataset.cat);};
// Each photo: tap it to view it big; its own "Ask price" button (kept apart from the photo) adds it to the price request.
const askLabel=on=>`<i data-lucide="heart"></i>${on?"Added":"Ask price"}`;
function buildGallery(){
  $("#gallery").innerHTML = PHOTOS.map((p,i)=>`<div class="tile${isLiked(p)?" liked":""}" data-i="${i}"><button class="tview" aria-label="View ${esc(p.cat)} photo"><img src="${p.src}" alt="${esc(alt(p))}" loading="lazy"><span class="tag">${esc(p.cat)}</span><span class="zoom"><i data-lucide="maximize-2"></i></span></button><button class="task" aria-pressed="${isLiked(p)}" aria-label="Ask for a price on one like this ${esc(p.cat)}">${askLabel(isLiked(p))}</button></div>`).join("");
  icons();
}
$("#gallery").onclick=e=>{const t=e.target.closest(".tile"); if(!t) return; const p=PHOTOS[+t.dataset.i]; if(e.target.closest(".task")) toggleLike(p); else openLb(p);};
// Adds a project photo to the price request, or takes it out; Undo puts it back as it was.
function toggleLike(p,quiet){
  const on=!isLiked(p);
  if(on) likes.push({src:p.src,cat:p.cat}); else likes=likes.filter(l=>l.src!==p.src);
  saveLikes(); syncLike(p.src); renderQuote();
  if(!quiet) toast(on?`${p.cat} photo added to your price request`:`${p.cat} photo removed`,
    [["Undo",()=>toggleLike(p,true)],...(on?[["See form",()=>{ setMode("ask"); $("#qform").scrollIntoView(); }]]:[])]);
}
function syncLike(src){
  const on=likes.some(l=>l.src===src);
  document.querySelectorAll("#gallery .tile").forEach(t=>{ if(PHOTOS[+t.dataset.i]?.src!==src) return;
    t.classList.toggle("liked",on); const b=t.querySelector(".task"); b.setAttribute("aria-pressed",on); b.innerHTML=askLabel(on); });
  if(!$("#lb").hidden) renderLb();
  icons();
}
function setFilter(c){
  filter=c; shown=12;
  document.querySelectorAll("#filters .chip").forEach(b=>b.classList.toggle("on",b.dataset.cat===c));
  applyFilter();
}
function applyFilter(){
  visible = PHOTOS.filter(p=>filter==="All"||p.cat===filter);
  const keep = new Set(visible.slice(0,shown));
  document.querySelectorAll(".tile").forEach(t=>t.classList.toggle("hide",!keep.has(PHOTOS[+t.dataset.i])));
  $("#moreBtn").parentElement.hidden = visible.length<=shown;
}
$("#moreBtn").onclick=()=>{ shown+=12; applyFilter(); };
// The admin's changes (gallery, prices, text) come in one cached request: /api/site-data.
const siteData=fetch("/api/site-data").then(r=>r.ok?r.json():null).catch(()=>null);
function applyGallery(d){
  if(!d?.projects||!d?.hidden) return;
  const hidden=new Set(d.hidden);
  if(d.categories) CATEGORIES=d.categories; // a built-in category the admin removed disappears with its photos
  PHOTOS=[...d.projects,...BUNDLED.filter(b=>!hidden.has(b.n)&&CATEGORIES.includes(b.cat))];
}
// Wait briefly for admin changes so deleted photos don't flash in, then render regardless.
async function initGallery(){
  const render=()=>{ buildCats(); buildGallery(); setFilter(filter); };
  let drawn=false;
  const remote=siteData.then(d=>{ applyGallery(d); if(drawn) render(); });
  await Promise.race([remote,new Promise(r=>setTimeout(r,1500))]);
  drawn=true; render();
}

/* lightbox */
let li=0,lastF=null;
function openLb(p){ lastF=document.activeElement; li=visible.indexOf(p); $("#lb").hidden=false; document.body.style.overflow="hidden"; renderLb(); $("#lbX").focus(); }
function closeLb(){ $("#lb").hidden=true; document.body.style.overflow=""; lastF&&lastF.focus(); if(lbPending) refreshGallery(); }
function renderLb(){
  const p=visible[li]; $("#lbImg").src=p.src; $("#lbImg").alt=alt(p);
  $("#lbCap").textContent=`${p.cat}${fromLabel(p.cat)?" · "+fromLabel(p.cat):""} · ${li+1} of ${visible.length}`;
  const on=isLiked(p); $("#lbLike").classList.toggle("on",on);
  $("#lbLike").querySelector("span").textContent=on?"Added":"Ask price";
  $("#lbStrip").innerHTML=visible.map((v,i)=>`<img src="${v.src}" alt="" data-k="${i}" class="${i===li?"on":""}">`).join("");
  $("#lbStrip").children[li]?.scrollIntoView({block:"nearest",inline:"center"});
}
$("#lbStrip").onclick=e=>{const k=e.target.dataset.k; if(k!=null){li=+k;renderLb();}};
const stepLb=d=>{li=(li+d+visible.length)%visible.length;renderLb();};
$("#lbLike").onclick=()=>toggleLike(visible[li]);

/* "Pick from our projects" in the Ask for a price form */
let pcat="All";
function renderPicked(){
  $("#picked").innerHTML=likes.map((l,i)=>`<figure><img src="${esc(l.src)}" alt="${esc(l.cat)}"><figcaption>${esc(l.cat)}</figcaption><button type="button" class="unpick" data-unpick="${i}" aria-label="Remove ${esc(l.cat)} photo"><i data-lucide="x"></i></button></figure>`).join("")
    +`<button type="button" class="pickadd" id="pickOpen"><i data-lucide="plus"></i><span>${likes.length?"Pick more":"Pick from our projects"}</span></button>`;
}
function renderPicker(){
  $("#pickcats").innerHTML=["All",...shownCats()].map(c=>`<button type="button" class="chip${c===pcat?" on":""}" data-pc="${esc(c)}">${esc(c)}</button>`).join("");
  $("#pickgrid").innerHTML=PHOTOS.filter(p=>pcat==="All"||p.cat===pcat).map(p=>`<button type="button" class="pk${isLiked(p)?" on":""}" data-src="${esc(p.src)}" aria-pressed="${isLiked(p)}" aria-label="${esc(p.cat)} photo"><img src="${p.src}" alt="" loading="lazy"><span class="ck"><i data-lucide="check"></i></span></button>`).join("");
  pickCount(); icons();
}
const pickCount=()=>{ $("#pickDone span").textContent=likes.length?`Done · ${likes.length} picked`:"Done"; };
$("#picked").onclick=e=>{
  if(e.target.closest("#pickOpen")){ renderPicker(); $("#picker").showModal(); return; }
  const u=e.target.closest("[data-unpick]"); if(u) toggleLike(likes[+u.dataset.unpick]);
};
$("#pickcats").onclick=e=>{ const c=e.target.closest("[data-pc]"); if(c){ pcat=c.dataset.pc; renderPicker(); $("#pickgrid").scrollTop=0; } };
$("#pickgrid").onclick=e=>{
  const b=e.target.closest(".pk"); if(!b) return;
  const p=PHOTOS.find(x=>x.src===b.dataset.src); toggleLike(p,true);
  b.classList.toggle("on",isLiked(p)); b.setAttribute("aria-pressed",isLiked(p)); pickCount();
};
$("#pickDone").onclick=$("#pickX").onclick=()=>$("#picker").close();
$("#picker").addEventListener("click",e=>{ if(e.target===$("#picker")) $("#picker").close(); }); // tap outside closes
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
const addBtn=it=>quote[it.id]?`<button class="btn btn-outline add in" data-add="${it.id}"><i data-lucide="check"></i>In your order</button>`:`<button class="btn btn-outline add" data-add="${it.id}"><i data-lucide="plus"></i>Add to order</button>`;
const li_=f=>f.map(x=>`<li><i data-lucide="check"></i><span>${esc(x)}</span></li>`).join("");
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
// Shop: one button per category that has products, then that category's cards.
let skind="chair";
const card=it=>{ const drawing=!it.image&&it.L&&it.W;
  return `<article class="card"><div class="${drawing?"plan":"ph"}"><span class="code">${it.id}</span>${it.image?`<img src="${esc(it.image)}" alt="${it.id} ${esc(it.name)}" loading="lazy">`:drawing?plan(it):`<i data-lucide="${isChair(it.kind)?"armchair":"table-2"}"></i>`}</div>
    <div class="body">${it.L&&it.W?`<span class="dims">${it.L} × ${it.W} × 750 mm</span>`:""}<h3>${esc(it.name)}</h3><span class="price">${pt(it)}</span>
    ${!it.f.length?"":it.kind==="table"?`<ul>${li_(it.f)}</ul>`:`<details><summary>Product features<i data-lucide="chevron-down"></i></summary><ul>${li_(it.f)}</ul></details>`}${addBtn(it)}</div></article>`; };
function renderCatalogue(){
  const kinds=KINDS.filter(([k])=>ITEMS.some(i=>i.kind===k));
  if(kinds.length&&!kinds.some(([k])=>k===skind)) skind=kinds[0][0];
  $("#shopcats").innerHTML=kinds.map(([k,l])=>`<button class="chip${k===skind?" on":""}" data-kind="${k}" aria-pressed="${k===skind}">${l}<small>${ITEMS.filter(i=>i.kind===k).length}</small></button>`).join("");
  const list=ITEMS.filter(i=>i.kind===skind);
  $("#plannote").hidden=!list.some(t=>!t.image&&t.L&&t.W);
  $("#pgrid").innerHTML=list.map(card).join("");
  icons();
}
$("#shopcats").onclick=e=>{ const b=e.target.closest("[data-kind]"); if(b){ skind=b.dataset.kind; renderCatalogue(); } };
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-add]"); if(!b) return;
  const id=b.dataset.add; if(quote[id]) delete quote[id]; else {quote[id]=1; toast(id+" added to your order");}
  save(); renderCatalogue(); renderQuote();
});

/* quote */
function totals(){let a=0,z=0,n=0;for(const[id,q] of Object.entries(quote)){const it=ALL[id];if(!it)continue;a+=it.min*q;z+=it.max*q;n+=q;}return{a:cents(a),z:cents(z),n};}
function renderQuote(){
  const ids=Object.keys(quote).filter(id=>ALL[id]); const{a,z,n}=totals();
  $("#qc").textContent=n+likes.length;
  $("#qitems").innerHTML=ids.length?ids.map(id=>{const it=ALL[id];return `<div class="qi"><div class="th">${it.image?`<img src="${esc(it.image)}" alt="">`:`<i data-lucide="table-2"></i>`}</div>
    <div style="min-width:0"><div class="nm">${esc(it.name)}</div><div class="sub">${id} · ${pt({min:it.min*quote[id],max:it.max*quote[id]})}</div><button class="rm" data-rm="${id}">Remove</button></div>
    <div class="qty"><button data-q="${id}" data-d="-1" aria-label="Fewer">−</button><b>${quote[id]}</b><button data-q="${id}" data-d="1" aria-label="More">+</button></div></div>`}).join("")
    :(likes.length?"":`<div class="empty"><i data-lucide="clipboard-list"></i><p>Nothing here yet. Tap "Add to order" on a chair or table, or "Ask price" on a project photo.</p></div>`);
  if(likes.length) $("#qitems").insertAdjacentHTML("beforeend",`<div class="likes"><div class="k">Want one like these <span>· priced for you</span></div><div class="lgrid">${likes.map((l,i)=>`<figure><img src="${esc(l.src)}" alt="${esc(l.cat)}"><figcaption>${esc(l.cat)}</figcaption><button class="rm" data-unlike="${i}">Remove</button></figure>`).join("")}</div></div>`);
  $("#qtotal").textContent=n?pt({min:a,max:z}):"₱0";
  updateMode(n);
  icons();
}
$("#qitems").addEventListener("click",e=>{
  const q=e.target.closest("[data-q]"),r=e.target.closest("[data-rm]");
  if(q){const id=q.dataset.q;quote[id]=Math.max(1,Math.min(99,quote[id]+ +q.dataset.d));}
  if(r) delete quote[r.dataset.rm];
  const u=e.target.closest("[data-unlike]");
  if(u){ likes.splice(+u.dataset.unlike,1); saveLikes(); buildGallery(); applyFilter(); }
  if(q||r||u){save();renderQuote();renderCatalogue();}
});
function openDrawer(){$("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false");$("#scrim").hidden=false;$("#closeQ").focus();}
function closeDrawer(){$("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");$("#scrim").hidden=true;}
$("#openQ").onclick=openDrawer; $("#closeQ").onclick=closeDrawer; $("#scrim").onclick=closeDrawer;
// Continue to order / See form go to the form itself: on phones the contact details come first.
$("#toForm").onclick=()=>{closeDrawer();setMode(totals().n>0?"order":"ask");$("#qform").scrollIntoView();setTimeout(()=>$("#f-name").focus({preventScroll:true}),450);};
$("#copyList").onclick=()=>{const ids=Object.keys(quote);if(!ids.length){toast("Add shop items to copy your order");return;}const{a,z}=totals();
  copy("Arkline order\n"+ids.map(id=>`${quote[id]} x ${id} ${ALL[id].name} (${pt(ALL[id])})`).join("\n")+`\nEstimated total: ${pt({min:a,max:z})}`,"List copied");};

/* two tabs: "Ask for a price" (custom work, liked photos) and "Place an order" (shop items + delivery).
   Until the customer picks a tab, it follows the order list: shop items = order. */
let formMode="ask", picked=false;
function setMode(m){ formMode=m; picked=true; updateMode(); }
document.addEventListener("click",e=>{ const t=e.target.closest("[data-mode]"); if(t) setMode(t.dataset.mode); });
function updateMode(n=totals().n){
  if(!picked) formMode=n>0?"order":"ask";
  const order=formMode==="order", liked=likes.length>0, ids=Object.keys(quote).filter(id=>ALL[id]), {a,z}=totals();
  document.querySelectorAll(".ftabs [data-mode]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.mode===formMode)));
  document.querySelectorAll("#qform .ask-only").forEach(el=>el.hidden=order);
  document.querySelectorAll("#qform .order-only").forEach(el=>el.hidden=!order);
  $("#fhead").textContent=order?"Place an order":"Ask for a price";
  $("#fsub").textContent=order
    ?`We'll confirm stock, delivery fee and the 70% down payment within one business day.${liked?" We'll also price the photos you liked.":""}`
    :liked?"Tell us your size or how many seats, and we'll price one like the photo for you."
    :"Tell us your space and what you need. We'll send you the full price and details.";
  $("#msglbl").innerHTML=order?`Delivery notes <span class="hint">Optional</span>`:"Tell us about your space";
  $("#f-msg").placeholder=order?"e.g. 3rd floor, no elevator, deliver after 5 pm":liked?"e.g. 8 seats like the photo, gray laminate, 60 sqm office":"e.g. 12-seat workstation for a 60 sqm office, gray laminate";
  $("#qsend span").textContent=order?"Send my order":"Ask for a price";
  $("#dhead").textContent=n>0?"Your order":"Your request";
  $("#toForm span").textContent=n>0?"Continue to order":"Continue to ask for a price";
  const sum=[], likeSum=liked&&`<b style="color:var(--ink)">Price one like ${likes.length>1?"these":"this"}:</b><span class="lthumbs">${likes.map(l=>`<img src="${esc(l.src)}" alt="${esc(l.cat)}" title="${esc(l.cat)}">`).join("")}</span>`;
  if(order){
    sum.push(n?`<b style="color:var(--ink)">Your order: ${n} item${n>1?"s":""}</b> · total ${pt({min:a,max:z})}<br>${ids.map(id=>quote[id]+" × "+id).join(", ")}`
      :`Nothing in your order yet. Add chairs or tables from the <a href="#shop">shop</a> first.`);
    if(likeSum) sum.push(likeSum);
  } else sum.push(`Buying chairs or tables from the <a href="#shop">shop</a>? Use <b>Place an order</b>.`);
  $("#qsum").innerHTML=sum.join("<hr>");
  renderPicked(); icons(); // the tabs can switch without a full redraw, so draw the new icons here
}

/* misc */
// "0962 269 8229" → tel:+639622698229 (other formats: digits as typed), so a tap on a phone starts the call
function telHref(n){const d=String(n).replace(/[^\d+]/g,"");return "tel:"+(/^09\d{9}$/.test(d)?"+63"+d.slice(1):d);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// toast(message, [[label, action], …]): with actions (like Undo) it stays 5 s and replaces an older one.
function toast(m,acts=[]){
  if(acts.length) document.querySelectorAll(".toast.act").forEach(t=>t.remove());
  const t=document.createElement("div");t.className="toast"+(acts.length?" act":"");t.setAttribute("role","status");t.innerHTML=`<i data-lucide="check-circle-2"></i>`;t.append(m);
  for(const [l,fn] of acts){ const b=document.createElement("button"); b.type="button"; b.className="tact"; b.textContent=l; b.onclick=()=>{ t.remove(); fn(); }; t.append(b); }
  document.body.appendChild(t);icons();setTimeout(()=>t.remove(),acts.length?5000:2300);
}
function copy(txt,m){try{navigator.clipboard.writeText(txt).then(()=>toast(m||"Copied"),()=>toast("Copy is blocked here. Select the text instead."));}catch(e){toast("Copy is blocked here. Select the text instead.");}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-copy]"); if(b) copy(b.dataset.copy,"Copied "+b.dataset.copy);});
$("#menu").onclick=()=>{const o=$("#links").classList.toggle("open");$("#menu").setAttribute("aria-expanded",o);};
$("#links").onclick=e=>{if(e.target.tagName==="A"){$("#links").classList.remove("open");$("#menu").setAttribute("aria-expanded","false");}};
const navs=[...document.querySelectorAll(".links a")];
const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting)navs.forEach(l=>l.classList.toggle("on",l.getAttribute("href")==="#"+en.target.id));}),{rootMargin:"-45% 0px -50% 0px"});
document.querySelectorAll("main section[id]").forEach(s=>io.observe(s));

/* Arkline's Messenger / Viber buttons: set by the admin in Website text → Contact details */
function renderChats(){
  const fb=messengerUrl(TEXT["contact.messenger"]), vb=viberUrl(TEXT["contact.viber"]);
  $("#chats").innerHTML=[
    fb&&`<a class="btn btn-glass" href="${esc(fb)}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>Messenger</a>`,
    vb&&`<a class="btn btn-glass" href="${esc(vb)}"><i data-lucide="phone"></i>Viber ${esc(TEXT["contact.viber"])}</a>`
  ].filter(Boolean).join("");
  $("#msgrow").hidden=!(fb||vb);
  $("#fab").hidden=!fb; if(fb) $("#fab").href=fb;
  icons();
}
renderChats();

/* customer's preferred contact: Messenger needs their Facebook */
$("#f-pref").onchange=()=>{ const m=$("#f-pref").value==="Messenger"; $("#fbwrap").hidden=!m; if(m) $("#f-fb").focus(); };

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
const FALLBACK=()=>`Please call ${TEXT["contact.mobiles"][0]||""} or email ${TEXT["contact.email"]} instead.`;
function formError(m){ $("#ferr").hidden=!m; $("#ferr").textContent=m; }
$("#qform").addEventListener("submit",async e=>{
  e.preventDefault();
  const order=formMode==="order";
  const name=$("#f-name").value.trim(),phone=$("#f-phone").value.replace(/[\s-]/g,""),email=$("#f-email").value.trim(),file=order?null:$("#f-photo").files[0];
  let m="";
  if(order&&!totals().n) m="Your order is empty. Add chairs or tables from the shop first, or use Ask for a price.";
  else if(!name) m=order?"Add your name so we know who the order is for.":"Add your name so we know who to send the price to.";
  else if(!/^(09|\+639)\d{9}$/.test(phone)&&!/^\S+@\S+\.\S+$/.test(email)) m=$("#f-pref").value==="Messenger"
    ?"Add a mobile number (09XX XXX XXXX) or an email too, in case we can't find you on Messenger."
    :"Add a mobile number (09XX XXX XXXX) or an email so we can send you the price.";
  else if(["Call or text","Viber"].includes($("#f-pref").value)&&!/^(09|\+639)\d{9}$/.test(phone)) m=`Add your mobile number so we can reach you by ${$("#f-pref").value==="Viber"?"Viber":"call or text"}.`;
  else if($("#f-pref").value==="Email"&&!/^\S+@\S+\.\S+$/.test(email)) m="Add your email so we can reply by email.";
  else if($("#f-pref").value==="Messenger"&&!$("#f-fb").value.trim()) m="Add your Facebook name or link so we can message you.";
  else if(order&&$("#f-addr").value.trim().length<5) m="Add your delivery address so we can tell you the delivery fee.";
  else if(file&&!file.type.startsWith("image/")) m="The reference photo must be an image.";
  else if(file&&file.size>25*1024*1024) m="The reference photo is over 25 MB. Try a smaller one.";
  formError(m); $("#fsent").hidden=true;
  if(m) return;

  const btn=$("#qsend"), label=btn.querySelector("span");
  btn.disabled=true; label.textContent="Sending…";
  try{
    const fd=new FormData($("#qform"));
    fd.delete("photo"); fd.set("mode",formMode);
    if(order) fd.delete("type"); else fd.delete("address");
    if(file){
      try{ const w=await toWebp(file,1600,.82); fd.set("photo",w.blob,"reference."+w.ext); }
      catch(err){ if(file.size<=5*1024*1024) fd.set("photo",file); else throw new Error("We couldn't read that photo. Try a JPG or PNG under 5 MB."); }
    }
    fd.set("items",JSON.stringify(order?Object.keys(quote).filter(id=>ALL[id]).map(id=>({id,qty:quote[id]})):[]));
    fd.set("liked",JSON.stringify(likes));
    const wasOrder=order;
    const r=await fetch("/api/quote",{method:"POST",body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||"Something went wrong sending your request.");
    // a price request leaves the shop items in the order list for later
    $("#qform").reset(); $("#fbwrap").hidden=true; if(order){ quote={}; save(); } likes=[]; saveLikes(); renderQuote(); renderCatalogue(); buildGallery(); applyFilter();
    $("#fsent").textContent=`Thanks, ${name.split(" ")[0]}! Your ${wasOrder?"order":"request"}${j.id?" #"+j.id:""} is in. ${wasOrder?"We'll confirm delivery and payment":"We'll send you the full price and details"} within one business day.${j.id?" Mention #"+j.id+" when you message us.":""}`;
    $("#fsent").hidden=false; $("#fsent").focus();
  }catch(err){
    formError(err instanceof TypeError?"We couldn't reach our server. "+FALLBACK():err.message);
  }finally{
    btn.disabled=false; updateMode();
    if(tsWidget!=null) try{ turnstile.reset(tsWidget); }catch(e){}
  }
});

/* admin-edited prices and text */
const fmt=s=>esc(s).replace(/\*([^*]+)\*/g,'<span class="grad">$1</span>'); // *word* → gold highlight
const SVC_ICONS=["briefcase","sofa","building-2","pencil-ruler"];
function applyText(){
  document.querySelectorAll("[data-c]").forEach(el=>{ const v=TEXT[el.dataset.c]; if(typeof v!=="string") return; if(el.hasAttribute("data-fmt")) el.innerHTML=fmt(v); else el.textContent=v; });
  $("#svc").innerHTML=TEXT.services.map((s,i)=>`<div class="card"><div class="ico"><i data-lucide="${SVC_ICONS[i%SVC_ICONS.length]}"></i></div><h3>${esc(s.t)}</h3><ul>${li_(s.items)}</ul></div>`).join("");
  $("#steps").innerHTML=TEXT.steps.map(s=>`<div class="step"><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></div>`).join("");
  $("#faqs").innerHTML=TEXT.faq.map((f,i)=>`<details${i?"":" open"}><summary>${esc(f.t)}<i data-lucide="plus"></i></summary><p>${esc(f.d)}</p></details>`).join("");
  renderChats();
  $("#mobiles").innerHTML=TEXT["contact.mobiles"].map(m=>`<div class="v"><a class="tap" href="${telHref(m)}">${esc(m)}</a> <button class="copy" data-copy="${esc(m)}">Copy</button></div>`).join("");
  const em=TEXT["contact.email"]; $("#emailv").innerHTML=`<a class="tap" href="mailto:${esc(em)}">${esc(em)}</a> <button class="copy" data-copy="${esc(em)}">Copy</button>`;
  icons();
}
async function loadSiteData(){
  const d=await siteData;
  if(!d?.products?.length){ // database unreachable: the built-in copy of the old website's shop, loaded only now
    const { EXTRA }=await import("./catalog-extra.js");
    ITEMS=[...ITEMS,...EXTRA]; ALL=Object.fromEntries(ITEMS.map(i=>[i.id,i]));
    $("#statItems").textContent=ITEMS.length; renderCatalogue(); renderQuote();
  }
  if(!d) return;
  if(d.products?.length){
    const items=d.products.map(fromRow);
    ITEMS=items;
    ALL=Object.fromEntries(items.map(i=>[i.id,i]));
    $("#statItems").textContent=items.length; renderCatalogue(); renderQuote();
  }
  if(d.content?.length){ for(const r of d.content) if(r.key in CONTENT_DEFAULTS) TEXT[r.key]=r.value; applyText(); buildCats(); setFilter(filter); }
}

buildSlides(); restart(); renderCatalogue(); renderQuote(); icons();
initGallery(); loadSiteData().catch(e=>console.warn("Couldn't load prices/text",e));

/* live updates: pick up the admin's changes (photos, categories, prices, text) without a reload.
   Re-checks every 20 s while someone is using the page (pauses after 15 min with no activity, and
   resumes on any scroll, click, key or return to the tab); only redraws what changed, and never
   changes the gallery under an open photo viewer. */
let lastSig="", lbPending=false;
siteData.then(d=>{ if(d) lastSig=JSON.stringify(d); });
function refreshGallery(){
  if(!$("#lb").hidden){ lbPending=true; return; }
  lbPending=false;
  if(filter!=="All"&&!CATEGORIES.includes(filter)) filter="All"; // the category being viewed was removed
  buildCats(); buildGallery();
  document.querySelectorAll("#filters .chip").forEach(b=>b.classList.toggle("on",b.dataset.cat===filter));
  applyFilter();
}
function applyLive(d,prev){
  if(JSON.stringify(d.products)!==JSON.stringify(prev.products)&&d.products?.length){
    const items=d.products.map(fromRow);
    ITEMS=items;
    ALL=Object.fromEntries(items.map(i=>[i.id,i]));
    $("#statItems").textContent=items.length; renderCatalogue(); renderQuote();
  }
  if(JSON.stringify(d.content)!==JSON.stringify(prev.content)){
    TEXT={...CONTENT_DEFAULTS}; // so a section put back to its original wording updates too
    for(const r of d.content||[]) if(r.key in CONTENT_DEFAULTS) TEXT[r.key]=r.value;
    applyText();
  }
  applyGallery(d); refreshGallery();
}
let lastActive=Date.now();
const IDLE=15*60*1000;
async function checkForChanges(){
  if(document.hidden||Date.now()-lastActive>IDLE) return;
  const d=await fetch("/api/site-data",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!d) return;
  const sig=JSON.stringify(d); if(sig===lastSig) return;
  const prev=lastSig?JSON.parse(lastSig):{}; lastSig=sig; applyLive(d,prev);
}
setInterval(checkForChanges,20000);
const wake=()=>{ const was=Date.now()-lastActive>IDLE; lastActive=Date.now(); if(was) checkForChanges(); }; // catch up after an idle pause
for(const ev of ["scroll","pointerdown","keydown","touchstart"]) addEventListener(ev,wake,{passive:true});
document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ lastActive=Date.now(); checkForChanges(); } });
