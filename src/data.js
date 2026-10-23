// Catalogue and bundled project photos. Shared by the site and /api/quote, so keep it free of DOM code.

export const CATS = {
  "Executive Table":[34,43,1,112,181,185,2,33,40],
  "Workstation":[72,10,80,124,141,183,103,165,166,175,195,203],
  "Conference Table":[164,17,19,67,94,100,157],
  "Cubicle Partition":[88,12,60,117,167,18,36,45,46,82,101,143],
  "Reception Counter":[32,0,66,70,121,136,159,172],
  "Toilet Partition":[21,22,38,120,169],
  "Kitchen Cabinet":[162,39,53,115,180],
  "Cabinet":[116,11,15,50,54,171],
  "Printer Table":[20,41,59,140,188]
};
export const ORDER = Object.keys(CATS);
export const img = n => "/img/p"+n+".jpg";

// Bundled gallery photos, interleaved by category. Admins can hide any of them (hidden_photos table).
export const BUNDLED = [];
for(let i=0;i<12;i++) for(const c of ORDER) if(CATS[c][i]!=null) BUNDLED.push({n:CATS[c][i],src:img(CATS[c][i]),cat:c});

export const CHAIRS=[["001",6730,145,["Mesh back, fabric seat","Black plastic + glass fiber frame","Fixed lumbar support","T-shape adjustable armrest","High density foam","Single lock, tension adjustable"]],
 ["002",4750,161,["Mesh back, fabric seat","Black plastic + glass fiber frame","Fixed lumbar support","Seat-back linked fixed armrest","Single lock, tension adjustable"]],
 ["003",3400,78,["PP back frame","Cutting foam seat","Fixed armrest","Center tilt (no locking)","100mm Class-3 gas lift"]],
 ["004",6750,27,["JYTW series mesh","OS-300 series seat fabric","Flip-up adjustable armrest","High density foam","Single lock, tension adjustable"]],
 ["005",5820,74,["Black PP+GF back frame","High-elastic moulded foam seat","PP+GF fixed armrest","Single lock, tension adjustable"]],
 ["006",5550,184,["Grey PP+GF back frame","High-elastic moulded foam seat","PP+GF fixed armrest","Single lock, tension adjustable"]],
 ["007",5350,8,["Mid-back mesh chair","Heavy-duty backrest","Adjustable lumbar support","Nylon black starbase"]],
 ["008",5600,154,["Mesh chair, heavy-duty black frame","High backrest","Wide chrome starbase"]],
 ["009",2800,204,["Clerical mesh chair","Spacious seat","Heavy-duty mesh"]],
 ["010",2900,149,["Clerical mesh chair","Spacious seat","Heavy-duty mesh, full back support"]],
 ["011",2900,197,["Clerical mesh chair","Spacious seat","Heavy-duty mesh, full back support"]],
 ["012",3450,13,["Mid-back chair","Black frame backrest with lumbar support","Chrome gas lift","Nylon black starbase"]],
 ["013",5250,148,["Clerical fabric chair","Spacious seat","Heavy-duty fabric","Wide chrome starbase"]]
].map(([c,p,im,f])=>({id:"AOC-"+c,name:"Ergonomic Office Chair",min:p,max:p,im,f}));

export const TABLES=[["001",42000,48000,"Executive desk with side pedestal",2400,1200,null,["Laminated woodgrain, scratch-resistant","Built-in 2-drawer side pedestal","Black accent base"]],
 ["002",11500,11500,"Steel-frame office table",1200,600,null,["Scratch- and moisture-resistant top","Powder-coated steel frame","Custom sizes on request"]],
 ["003",12500,12500,"Office table with drawer",1400,600,null,["Single storage drawer","Powder-coated steel frame","Various colors and finishes"]],
 ["004",35000,42000,"Executive desk, charcoal panel",1800,800,null,["Cable management grommet","Charcoal modesty panel, aluminum strip","Heavy-duty panel construction"]],
 ["005",35000,42000,"High-gloss desk with side storage",1600,700,{side:[1200,400]},["High-gloss white finish","Side cabinet with open shelves","Clean architectural lines"]],
 ["006",7890,7890,"Panel-leg office table",1200,600,null,["25mm laminated MFC top","18mm side and modesty panels","PVC edge banding"]],
 ["007",16500,16500,"L-shaped panel-leg desk",1600,700,{ret:[600,900]},["25mm MFC top, 18mm panel legs","L-shaped work surface","Overall 1600 × 1600 mm"]],
 ["008",9800,9800,"Matte black steel-frame table",1200,600,null,["Dual cable grommets","Matte black powder-coated frame","Floor protectors"]],
 ["009",11500,11500,"Table with 3-drawer pedestal",1200,600,null,["2 utility + 1 file drawer","Metal slides, aluminum handles","Wood-grain MFC top"]],
 ["010",12650,12650,"White steel-frame table",1200,600,null,["White powder-coated frame","Adjustable floor levelers","Various laminate colors"]],
 ["011",22500,22500,"L-shaped manager's desk",1800,700,{ret:[450,1200]},["450mm front modesty panel","Main 1800 × 700, return 1200 × 450","Powder-coated steel frame"]],
 ["012",11500,11500,"Wood-grain desk, white frame",1400,700,null,["Full front modesty panel","Dual cable grommets","Natural wood-grain MDF"]],
 ["013",6000,7500,"Wood-grain desk, white frame",1400,700,null,["Price depends on size and finish","Full front modesty panel","Dual cable grommets"]],
 ["014",10275,10275,"Table with locking pedestal",1200,600,null,["Fixed 3-drawer pedestal, central lock","A4 and legal filing drawer","Rust-resistant steel frame"]]
].map(([c,min,max,name,L,W,x,f])=>({id:"OFT-"+c,name,min,max,L,W,x,f}));

export const ALL=Object.fromEntries([...CHAIRS,...TABLES].map(i=>[i.id,i]));
export const PROJECT_TYPES=["Office fit-out","Home furniture","Commercial / institutional","Single items"];
export const peso=n=>"₱"+n.toLocaleString("en-PH");
export const pt=it=>it.min===it.max?peso(it.min):peso(it.min)+" – "+peso(it.max);
