// Editable website text: the original wording, used until an admin saves a change (site_content table).
// Headlines may wrap a word in *stars* to colour it. Lists are arrays: {t: title, d: text} or {t, items}.
export const CONTENT_DEFAULTS = {
  "hero.location": "Novaliches, Quezon City",
  "hero.title": "Building spaces that inspire *productivity.*",
  "hero.lede": "Custom and ready-made furniture for offices, homes, commercial and institutional projects. We design, fabricate, deliver and install.",
  "shop.lede": "Add items to your order and send it to us. Final prices depend on size, laminate finish and customization.",
  "services": [
    { t: "Office furniture", items: ["Executive tables & workstations", "Cubicle and glass partitions", "Conference tables", "Reception counters", "Cabinets & mobile pedestals"] },
    { t: "Home furniture", items: ["Kitchen cabinets", "Wardrobes and closets", "TV cabinets", "Bedroom, living & dining", "Custom home storage"] },
    { t: "Commercial & institutional", items: ["Toilet partitions", "School & library furniture", "Training tables", "Retail display fixtures", "Custom commercial interiors"] },
    { t: "Custom solutions", items: ["Design consultation", "Space planning", "Furniture fabrication", "Installation services", "Project management"] }
  ],
  "about.title": "Furniture that works as hard as *you do*.",
  "about.lead": "Arkline Home and Office Furniture Shop is a trusted provider of high-quality, customized and ready-made furniture for homes, offices, commercial establishments and institutional projects. We design, manufacture and supply functional, durable and modern furniture that improves productivity, comfort and aesthetics.",
  "steps": [
    { t: "Order or ask for a price", d: "Order from the shop, or send your layout and sizes for custom work. We reply with the full price and details." },
    { t: "Confirm with 70% down", d: "The balance is paid before delivery unless otherwise agreed." },
    { t: "Production", d: "Lead time starts once the down payment and final specs are approved." },
    { t: "Delivery & setup", d: "Schedules depend on weather, site access and unforeseen circumstances." },
    { t: "Inspect within 24h", d: "Check items on delivery and report any concern within 24 hours." }
  ],
  "faq": [
    { t: "How do I request the updated furniture pricelist?", d: "Message us by email or on our Facebook page, or use the form below. Tell us what furniture you need and we'll send the current pricelist." },
    { t: "How do I make an order?", d: "Ask for a price, approve the specifications, then pay the 70% down payment to confirm. Production starts after that." },
    { t: "How do I make a payment?", d: "A 70% down payment confirms all orders. The remaining balance is paid before delivery unless otherwise agreed. Payment details come with your price." },
    { t: "Can I change my order after confirming?", d: "Yes, but changes after confirmation may affect the price and delivery schedule." },
    { t: "Can I cancel a customized order?", d: "Customized and made-to-order items are non-refundable and non-cancellable once production has started." },
    { t: "What does the warranty cover?", d: "Manufacturing defects only. It doesn't cover damage from misuse, accidents or improper handling." }
  ],
  "contact.address": "101 Lydia St., Brgy. Sta. Monica, Novaliches, Quezon City",
  "contact.mobiles": ["0962 269 8229", "0927 343 6747", "0964 823 2183"],
  "contact.email": "arklinehomeandofficefurnitures@gmail.com",
  "contact.reply": "We usually reply within one business day.",
  "footer.tagline": "Creating functional spaces, delivering quality furniture solutions.",
  // "Starts at" price per gallery category, set in /admin → Prices. { "Workstation": { price: 18000, unit: "per seat" } }
  "gallery.from": {}
};

// What the admin "Website text" tab shows, in page order.
export const CONTENT_SECTIONS = [
  { title: "Top of the page", fields: [
    ["hero.location", "Location badge", "input"],
    ["hero.title", "Headline", "input", "Put *stars* around a word to colour it."],
    ["hero.lede", "Intro text", "textarea"] ] },
  { title: "Shop", fields: [["shop.lede", "Shop intro", "textarea"]] },
  { title: "Services", list: "services" },
  { title: "About us", fields: [
    ["about.title", "Headline", "input", "Put *stars* around a word to colour it."],
    ["about.lead", "About text", "textarea"] ] },
  { title: "How to order", list: "steps", a: "Step", b: "Explanation" },
  { title: "FAQs", list: "faq", a: "Question", b: "Answer" },
  { title: "Contact details", fields: [
    ["contact.address", "Office address", "input"],
    ["contact.mobiles", "Mobile numbers", "lines", "One number per line."],
    ["contact.email", "Email", "input"],
    ["contact.reply", "Reply promise under the Send button", "input"] ] },
  { title: "Footer", fields: [["footer.tagline", "Tagline", "input"]] }
];
