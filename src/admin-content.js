// /admin "Prices" and "Website text" tabs: edit the products table and the site_content table.
import { fromRow, ORDER, messengerUrl, viberUrl } from "./data.js";
import { CONTENT_DEFAULTS, CONTENT_SECTIONS } from "./content.js";
import { supabase, photoUrl, PHOTO_BUCKET } from "./supabase.js";
import { toWebp } from "./image.js";
import { confirmDialog } from "./confirm.js";

const icons = () => { try{ window.lucide && lucide.createIcons(); }catch(e){} };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const show = (el,m) => { el.hidden=!m; el.textContent=m||""; };
const busy = (btn,on,txt) => { btn.disabled=on; btn.querySelector("span").textContent=txt; };
const plural = (n,w) => `${n} ${w}${n===1?"":"s"}`;
const empty = m => `<div class="empty"><i data-lucide="image-off"></i><p>${m}</p></div>`;
const MIGRATE = "This needs one database update: run supabase/003_prices_and_text.sql in the Supabase SQL Editor.";
const missingTable = e => /does not exist|schema cache|Could not find the table/i.test(e.message);
let toast = m => {};
const fail = (el,m) => { el.hidden=false; el.textContent=m; };

/* ---------- Prices ---------- */
let products=[], pfilter="chair";

export async function loadProducts(){
  const {data,error}=await supabase.from("products").select("*").order("sort").order("id");
  if(error){ show($("#perr"),missingTable(error)?MIGRATE:"Couldn't load products: "+error.message); return; }
  show($("#perr")); products=data.map(r=>({...fromRow(r),visible:r.visible,sort:r.sort})); renderProducts();
}
function renderProducts(){
  const n=k=>products.filter(p=>p.kind===k).length;
  $("#pcount").textContent=plural(products.length,"product");
  $("#pfilters").innerHTML=[["chair","Chairs"],["table","Tables"]].map(([k,l])=>`<button class="chip${k===pfilter?" on":""}" data-pf="${k}">${l}<small>${n(k)}</small></button>`).join("");
  const vis=products.filter(p=>p.kind===pfilter);
  $("#plist").innerHTML=vis.length?vis.map(pcard).join(""):empty("No products here yet.");
  icons();
}
function pcard(p){
  const fresh=!!p._new;
  return `<form class="pc${p.visible?"":" off"}" data-id="${esc(p.id)}" novalidate>
    <div class="pc-img">${p.image?`<img src="${esc(p.image)}" alt="">`:`<div class="noimg"><i data-lucide="${p.kind==="chair"?"armchair":"table-2"}"></i></div>`}
      <label><span>${p.image?"Change photo":"Add photo"}</span><input type="file" accept="image/*" data-pimg></label>
      ${p.image&&p.kind==="table"?`<button type="button" class="link" data-noimg>Show drawing instead</button>`:""}
    </div>
    <div class="pc-body">
      <div class="f2"><label>Code${fresh?` <span class="hint">e.g. ${p.kind==="chair"?"AOC":"OFT"}-015</span>`:""}<input name="code" value="${esc(p.id)}" ${fresh?"":"readonly"} maxlength="8"></label>
        <label>Name<input name="pname" value="${esc(p.name)}" maxlength="120"></label></div>
      <div class="f2"><label>Price from (₱)<input name="min" type="number" inputmode="numeric" min="1" step="1" value="${p.min??""}"></label>
        <label>Price to (₱) <span class="hint">leave empty for one fixed price</span><input name="max" type="number" inputmode="numeric" min="1" step="1" value="${p.max!=null&&p.max!==p.min?p.max:""}"></label></div>
      ${p.kind==="table"?`<div class="f2"><label>Length (mm)<input name="L" type="number" inputmode="numeric" min="300" max="6000" value="${p.L??""}"></label><label>Width (mm)<input name="W" type="number" inputmode="numeric" min="300" max="3000" value="${p.W??""}"></label></div>`:""}
      <label>Features <span class="hint">one per line</span><textarea name="feat" maxlength="2000">${esc((p.f||[]).join("\n"))}</textarea></label>
      <p class="err" hidden></p>
      <div class="pc-foot"><label class="sw"><input type="checkbox" name="vis" ${p.visible?"checked":""}>Show on website</label>
        <div class="acts2">${fresh?`<button type="button" class="btn btn-outline" data-cancel>Cancel</button>`:`<button type="button" class="btn btn-outline pc-del" data-pdel><i data-lucide="trash-2"></i>Delete</button>`}<button class="btn btn-primary" type="submit"><i data-lucide="save"></i><span>${fresh?"Add to shop":"Save"}</span></button></div></div>
    </div></form>`;
}
const pform = id => $("#plist").querySelector(`form[data-id="${CSS.escape(id)}"]`);
const redraw = (p,oldId=p.id) => { const f=pform(oldId); if(f){ f.outerHTML=pcard(p); icons(); } };

function bindPrices(){
  $("#pfilters").onclick=e=>{const b=e.target.closest("[data-pf]"); if(b){pfilter=b.dataset.pf; renderProducts();}};
  document.querySelectorAll("[data-add-kind]").forEach(b=>b.onclick=()=>{
    if(!products.length&&!$("#perr").hidden) return;
    const kind=b.dataset.addKind, pre=kind==="chair"?"AOC-":"OFT-";
    const next=Math.max(0,...products.filter(p=>p.id.startsWith(pre)).map(p=>+p.id.slice(4)||0))+1;
    const p={_new:true,id:pre+String(next).padStart(3,"0"),kind,name:kind==="chair"?"Ergonomic Office Chair":"",min:null,max:null,f:[],visible:true,image:null,sort:Math.max(0,...products.map(x=>x.sort))+1};
    products.push(p); pfilter=kind; renderProducts();
    const f=pform(p.id); f.scrollIntoView({behavior:"smooth",block:"center"}); f.pname.focus({preventScroll:true});
  });
  $("#plist").addEventListener("input",e=>e.target.closest(".pc")?.classList.add("dirty"));
  $("#plist").addEventListener("click",async e=>{
    const f=e.target.closest(".pc"); if(!f) return;
    const p=products.find(x=>x.id===f.dataset.id);
    if(e.target.closest("[data-cancel]")){ products=products.filter(x=>x!==p); renderProducts(); }
    const del=e.target.closest("[data-pdel]");
    if(del){
      const ok=await confirmDialog({title:`Delete ${p.id} ${p.name}?`,message:"It's removed from the shop and from this list for good. Past price requests keep their copy. To take it off the website for now, untick \"Show on website\" instead.",confirmLabel:"Delete product",danger:true});
      if(!ok) return;
      del.disabled=true;
      const {error}=await supabase.from("products").delete().eq("id",p.id);
      if(error){ del.disabled=false; return show($("#perr"),"Couldn't delete: "+error.message); }
      const own=p.image?.split(`/object/public/${PHOTO_BUCKET}/`)[1]; // photo uploaded for this product
      if(own?.startsWith("products/")) await supabase.storage.from(PHOTO_BUCKET).remove([own]);
      products=products.filter(x=>x!==p); renderProducts(); toast(`${p.id} deleted`);
    }
    if(e.target.closest("[data-noimg]")){
      if(!p._new){ const {error}=await supabase.from("products").update({image:null}).eq("id",p.id); if(error) return show($("#perr"),"Couldn't update: "+error.message); }
      p.image=null; redraw(p);
    }
  });
  $("#plist").addEventListener("change",async e=>{
    const inp=e.target.closest("[data-pimg]"); if(!inp||!inp.files[0]) return;
    const f=inp.closest(".pc"), p=products.find(x=>x.id===f.dataset.id), lab=inp.previousElementSibling;
    lab.textContent="Uploading…";
    try{
      const w=await toWebp(inp.files[0],900,.82);
      const path=`products/${p.id.toLowerCase()}-${crypto.randomUUID().slice(0,8)}.${w.ext}`;
      const up=await supabase.storage.from(PHOTO_BUCKET).upload(path,w.blob,{contentType:w.blob.type,cacheControl:"31536000"});
      if(up.error) throw up.error;
      const url=photoUrl(path);
      if(!p._new){ const {error}=await supabase.from("products").update({image:url,updated_at:new Date().toISOString()}).eq("id",p.id); if(error) throw error; toast("Photo updated"); }
      // erase the photo this one replaces, if it was uploaded for this product (built-in photos stay)
      const old=p.image?.split(`/object/public/${PHOTO_BUCKET}/`)[1];
      if(old?.startsWith("products/")) await supabase.storage.from(PHOTO_BUCKET).remove([old]);
      p.image=url; redraw(p);
    }catch(err){ show($("#perr"),"Couldn't upload the photo: "+(err.message||err)); lab.textContent=p.image?"Change photo":"Add photo"; }
  });
  $("#plist").addEventListener("submit",async e=>{
    e.preventDefault();
    const f=e.target, p=products.find(x=>x.id===f.dataset.id), err=f.querySelector(".err");
    const id=f.code.value.trim().toUpperCase(), name=f.pname.value.trim(), min=+f.min.value, max=f.max.value?+f.max.value:min;
    const L=f.L?.value?+f.L.value:null, W=f.W?.value?+f.W.value:null;
    let m="";
    if(!/^[A-Z]{2,4}-\d{3}$/.test(id)) m="Code must look like AOC-015 or OFT-015.";
    else if(p._new&&products.some(x=>x!==p&&x.id===id)) m=`${id} is already used. Pick another code.`;
    else if(!name) m="Add a name.";
    else if(!Number.isInteger(min)||min<1) m="Add a price in whole pesos.";
    else if(!Number.isInteger(max)||max<min) m="\"Price to\" must be the same as or higher than \"Price from\".";
    else if(p.kind==="table"&&!p.image&&!(L&&W)) m="Add the length and width (used for the drawing), or add a photo.";
    if(m) return fail(err,m);
    err.hidden=true;
    const row={name,price_min:min,price_max:max,features:f.feat.value.split("\n").map(x=>x.trim()).filter(Boolean),visible:f.vis.checked,length_mm:L,width_mm:W,image:p.image,updated_at:new Date().toISOString()};
    const btn=f.querySelector("[type=submit]"), label=p._new?"Add to shop":"Save"; busy(btn,true,"Saving…");
    const {error}=p._new
      ?await supabase.from("products").insert({...row,id,kind:p.kind,sort:p.sort})
      :await supabase.from("products").update(row).eq("id",p.id);
    busy(btn,false,label);
    if(error) return fail(err,missingTable(error)?MIGRATE:"Couldn't save: "+error.message);
    const oldId=p.id, added=!!p._new; delete p._new;
    Object.assign(p,{id,name,min,max,L,W,f:row.features,visible:row.visible});
    redraw(p,oldId); $("#pcount").textContent=plural(products.length,"product");
    toast(added?`${id} added to the shop`:`${id} saved`);
  });
}

/* ---------- Website text (only edited keys are stored) ---------- */
let saved={};
const val = k => k in saved?saved[k]:CONTENT_DEFAULTS[k];
const keysOf = s => s.list?[s.list]:s.fields.map(f=>f[0]);

export async function loadText(){
  const {data,error}=await supabase.from("site_content").select("key,value");
  if(error){ show($("#terr"),missingTable(error)?MIGRATE:"Couldn't load the text: "+error.message); return; }
  show($("#terr")); saved=Object.fromEntries(data.map(r=>[r.key,r.value])); renderText(); renderFrom();
}

/* "Starts at" prices per gallery category (site_content key gallery.from) */
function renderFrom(){
  const g=saved["gallery.from"]||{};
  $("#gfrom").innerHTML=`<div class="gfrom">${ORDER.map(c=>`<div class="gfrow"><b>${c}</b>
      <label class="sr" style="gap:4px;font-size:.78rem">From (₱)<input type="number" inputmode="numeric" min="1" step="1" data-gp="${c}" value="${g[c]?.price??""}" placeholder="e.g. 18000"></label>
      <label class="sr" style="gap:4px;font-size:.78rem">Unit <span class="hint">optional</span><input data-gu="${c}" maxlength="30" value="${esc(g[c]?.unit??"")}" placeholder="per seat"></label></div>`).join("")}</div>
    <p class="err" hidden></p>
    <div class="tf-foot"><button class="btn btn-primary" type="submit"><i data-lucide="save"></i><span>Save starting prices</span></button></div>`;
  icons();
}
function bindFrom(){
  $("#gfrom").addEventListener("submit",async e=>{
    e.preventDefault();
    const f=e.target, err=f.querySelector(".err"), g={};
    for(const c of ORDER){
      const v=f.querySelector(`[data-gp="${CSS.escape(c)}"]`).value, u=f.querySelector(`[data-gu="${CSS.escape(c)}"]`).value.trim();
      if(!v) continue;
      if(!Number.isInteger(+v)||+v<1) return fail(err,`${c}: use a whole peso amount, or leave it empty.`);
      g[c]={price:+v,...(u&&{unit:u})};
    }
    err.hidden=true;
    const btn=f.querySelector("[type=submit]"); busy(btn,true,"Saving…");
    const {error}=Object.keys(g).length
      ?await supabase.from("site_content").upsert({key:"gallery.from",value:g,updated_at:new Date().toISOString()})
      :await supabase.from("site_content").delete().eq("key","gallery.from");
    busy(btn,false,"Save starting prices");
    if(error) return fail(err,/check constraint|violates/i.test(error.message)?"This needs one database update: run supabase/004_orders_and_liked_photos.sql in the Supabase SQL Editor.":"Couldn't save: "+error.message);
    if(Object.keys(g).length) saved["gallery.from"]=g; else delete saved["gallery.from"];
    toast("Starting prices saved. They show on the website within 30 seconds.");
  });
}
const TOOLS=`<div class="rep-tools"><button type="button" class="mini" data-mv="-1" title="Move up" aria-label="Move up"><i data-lucide="arrow-up"></i></button><button type="button" class="mini" data-mv="1" title="Move down" aria-label="Move down"><i data-lucide="arrow-down"></i></button><button type="button" class="mini" data-rm-row title="Remove" aria-label="Remove"><i data-lucide="x"></i></button></div>`;
function rowHtml(s,r){
  return s.list==="services"
    ?`<div class="rep-row"><div class="rep-f"><input data-t value="${esc(r.t)}" placeholder="Service name" maxlength="80" aria-label="Service name"><textarea data-items placeholder="One item per line" maxlength="1000" aria-label="Items">${esc((r.items||[]).join("\n"))}</textarea></div>${TOOLS}</div>`
    :`<div class="rep-row"><div class="rep-f"><input data-t value="${esc(r.t)}" placeholder="${s.a}" maxlength="160" aria-label="${s.a}"><textarea data-d placeholder="${s.b}" maxlength="1000" aria-label="${s.b}">${esc(r.d)}</textarea></div>${TOOLS}</div>`;
}
function fieldHtml([k,label,type,hint]){
  const v=val(k), h=hint?` <span class="hint">${hint}</span>`:"";
  if(type==="textarea") return `<label>${label}${h}<textarea name="${k}" maxlength="2000">${esc(v)}</textarea></label>`;
  if(type==="lines") return `<label>${label}${h}<textarea name="${k}" data-lines maxlength="500" style="min-height:70px">${esc(v.join("\n"))}</textarea></label>`;
  return `<label>${label}${h}<input name="${k}" value="${esc(v)}" maxlength="300"></label>`;
}
function renderText(){
  $("#tforms").innerHTML=CONTENT_SECTIONS.map((s,i)=>{
    const edited=keysOf(s).some(k=>k in saved);
    return `<form class="q auth" data-sec="${i}" novalidate>
      <div class="tf-foot" style="justify-content:space-between"><h3>${s.title}</h3>${edited?`<span class="edited">Edited</span>`:""}</div>
      ${s.list?`<div class="rep">${val(s.list).map(r=>rowHtml(s,r)).join("")}</div><button type="button" class="btn btn-outline" data-add-row style="justify-self:start"><i data-lucide="plus"></i>Add ${s.list==="services"?"service":s.a.toLowerCase()}</button>`:s.fields.map(fieldHtml).join("")}
      <p class="err" hidden></p>
      <div class="tf-foot"><button class="btn btn-primary" type="submit"><i data-lucide="save"></i><span>Save</span></button>${edited?`<button type="button" class="btn btn-outline" data-restore-sec>Restore original</button>`:""}</div>
    </form>`;
  }).join("");
  icons();
}
function bindText(){
  $("#tforms").addEventListener("click",async e=>{
    const f=e.target.closest("form"); if(!f) return;
    const s=CONTENT_SECTIONS[+f.dataset.sec], row=e.target.closest(".rep-row"), mv=e.target.closest("[data-mv]");
    if(mv&&row){ const up=+mv.dataset.mv<0, sib=up?row.previousElementSibling:row.nextElementSibling; if(sib) up?sib.before(row):sib.after(row); }
    if(e.target.closest("[data-rm-row]")&&row) row.remove();
    if(e.target.closest("[data-add-row]")){
      f.querySelector(".rep").insertAdjacentHTML("beforeend",rowHtml(s,s.list==="services"?{t:"",items:[]}:{t:"",d:""}));
      icons(); f.querySelector(".rep-row:last-child [data-t]").focus();
    }
    if(e.target.closest("[data-restore-sec]")){
      if(!await confirmDialog({title:`Restore the original "${s.title}" text?`,message:"Your edits to this section are replaced with the text the website launched with. It shows on the website within 30 seconds.",confirmLabel:"Restore original",danger:true,icon:"rotate-ccw"})) return;
      const {error}=await supabase.from("site_content").delete().in("key",keysOf(s));
      if(error) return show($("#terr"),"Couldn't restore: "+error.message);
      keysOf(s).forEach(k=>delete saved[k]); renderText(); toast(`${s.title}: original text restored`);
    }
  });
  $("#tforms").addEventListener("submit",async e=>{
    e.preventDefault();
    const f=e.target, s=CONTENT_SECTIONS[+f.dataset.sec], err=f.querySelector(".err"), vals={};
    if(s.list){
      vals[s.list]=[...f.querySelectorAll(".rep-row")].map(r=>s.list==="services"
        ?{t:r.querySelector("[data-t]").value.trim(),items:r.querySelector("[data-items]").value.split("\n").map(x=>x.trim()).filter(Boolean)}
        :{t:r.querySelector("[data-t]").value.trim(),d:r.querySelector("[data-d]").value.trim()}).filter(r=>r.t);
      if(!vals[s.list].length) return fail(err,"Keep at least one entry.");
    } else for(const [k,label,type,,optional] of s.fields){
      const el=f.elements[k], v=type==="lines"?el.value.split("\n").map(x=>x.trim()).filter(Boolean):el.value.trim();
      if(!v.length&&!optional) return fail(err,"Fill in every box, or use Restore original.");
      if(k==="contact.messenger"&&v&&!messengerUrl(v)) return fail(err,`${label}: paste the page link, e.g. facebook.com/ArklineFurniture`);
      if(k==="contact.viber"&&v&&!viberUrl(v)) return fail(err,`${label}: use a mobile number like 0962 269 8229.`);
      vals[k]=v;
    }
    err.hidden=true;
    const same=k=>JSON.stringify(vals[k])===JSON.stringify(CONTENT_DEFAULTS[k]);
    const up=Object.keys(vals).filter(k=>!same(k)), back=Object.keys(vals).filter(same);
    const btn=f.querySelector("[type=submit]"); busy(btn,true,"Saving…");
    const r1=up.length?await supabase.from("site_content").upsert(up.map(k=>({key:k,value:vals[k],updated_at:new Date().toISOString()}))):{};
    const r2=back.length?await supabase.from("site_content").delete().in("key",back):{};
    busy(btn,false,"Save");
    const error=r1.error||r2.error;
    if(error) return fail(err,missingTable(error)?MIGRATE:"Couldn't save: "+error.message);
    up.forEach(k=>saved[k]=vals[k]); back.forEach(k=>delete saved[k]);
    renderText(); toast(`${s.title} saved. It shows on the website within 30 seconds.`);
  });
}

export function initContentTabs(showToast){ toast=showToast; bindPrices(); bindText(); bindFrom(); }
