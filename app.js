// Home App — Phase 1: pantry, shopping list, dashboard.
// Shared cloud mode: Supabase (config.js). No config = local demo mode only.
// Phone + password login: Supabase Auth does not do password-only phone
// login on the free tier without SMS, so the phone is used as the login
// name and mapped to an internal auth email (p<digits>@homeapp.local).
// No SMS is sent, no real email is needed, and "Confirm email" must be OFF
// in Supabase Auth settings. The phone itself is stored in profiles.

let sb = null, demoMode = true, user = null, pantry = [], shopping = [];
let receiptRows = [];
let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  $("tabLogin").classList.toggle("active", mode === "login");
  $("tabSignup").classList.toggle("active", mode === "signup");
  $("nameField").classList.toggle("hidden", mode !== "signup");
  $("authSubmit").textContent = mode === "signup" ? "Create account" : "Log in";
  $("authHint").innerHTML = mode === "signup"
    ? "First time? Enter your name, 10-digit number, and password."
    : "Returning? Just enter your number and password.";
}

const $ = (id) => document.getElementById(id);
const digits = (p) => (p || "").replace(/\D/g, "");
const phoneEmail = (p) => `p${digits(p)}@homeapp.local`;
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d) => d ? Math.round((new Date(d) - new Date(today())) / 86400000) : null;

function showLogin() {
  if ($("tabLogin")) setAuthMode("login");
  $("view-login").classList.remove("hidden");
  $("appPages").classList.add("hidden");
  $("appHeader").classList.add("hidden");
  $("mainNav").classList.add("hidden");
  pantry = []; shopping = [];
}
function showApp() {
  $("view-login").classList.add("hidden");
  $("appPages").classList.remove("hidden");
  $("appHeader").classList.remove("hidden");
  $("mainNav").classList.remove("hidden");
}
function show(view) {
  if (!user) return showLogin();
  showApp();
  ["dashboard", "pantry", "add", "shopping"].forEach(v => $(`view-${v}`).classList.toggle("hidden", v !== view));
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  if (view === "pantry") renderPantry();
  if (view === "shopping") renderShopping();
}

function loadLocal() {
  pantry = JSON.parse(localStorage.getItem("ha_pantry") || "[]");
  shopping = JSON.parse(localStorage.getItem("ha_shopping") || "[]");
}
function saveLocal() {
  localStorage.setItem("ha_pantry", JSON.stringify(pantry));
  localStorage.setItem("ha_shopping", JSON.stringify(shopping));
}

async function init() {
  const cfg = window.HOME_APP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    demoMode = false;
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    if (user) {
      await loadCloud();
      $("who").textContent = "Shared household";
      showApp(); show("dashboard");
    } else {
      showLogin();
    }
    sb.channel("ha-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_items" }, () => { if (user) loadCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, () => { if (user) loadCloud(); })
      .subscribe();
    return;
  } else {
    demoMode = true; loadLocal();
    $("demoBanner").classList.remove("hidden");
    showLogin();
    return;
  }
}

async function loadCloud() {
  const p = await sb.from("pantry_items").select("*").order("name");
  const s = await sb.from("shopping_items").select("*").order("created_at");
  pantry = p.data || []; shopping = s.data || [];
  renderDashboard(); renderPantry(); renderShopping();
}

async function doAuth(mode) {
  const phone = $("phone").value.trim(), pass = $("pass").value, name = $("displayName").value.trim();
  if (!/^\d{10}$/.test(phone)) return alert("Phone number must be exactly 10 digits — no spaces, hyphens, or +1.");
  if (mode === "signup" && !name) return alert("Please enter your name to create an account.");
  if (pass.length < 6) return alert("Password must be at least 6 characters.");
  if (demoMode) {
    user = { phone, name: name || phone };
    $("who").textContent = `Demo as ${user.name}`;
    showApp(); return show("dashboard");
  }
  let res = mode === "signup"
    ? await sb.auth.signUp({ email: phoneEmail(phone), password: pass })
    : await sb.auth.signInWithPassword({ email: phoneEmail(phone), password: pass });
  if (res.error) return alert(res.error.message);
  user = res.data.user;
  if (mode === "signup") await sb.from("profiles").upsert({ id: user.id, phone, display_name: name || phone });
  $("who").textContent = "Shared household";
  await loadCloud(); showApp(); show("dashboard");
}
async function doLogout() {
  if (sb) await sb.auth.signOut();
  user = null; location.reload();
}

// ---- Pantry ----
async function addPantryItem(it) {
  if (!user) return showLogin();
  const row = { ...it, added_by: user?.phone || user?.name || "family" };
  if (demoMode) { row.id = Date.now().toString(); row.created_at = new Date().toISOString(); pantry.push(row); saveLocal(); }
  else {
    const { data, error } = await sb.from("pantry_items").insert(row).select().single();
    if (error) return alert(error.message);
    if (it.total_price || it.unit_price) await sb.from("purchase_lots").insert({
      pantry_item_id: data.id, item_name: it.name, quantity: it.quantity, unit: it.unit,
      unit_price: it.unit_price || null, total_price: it.total_price || null,
      purchase_date: it.purchase_date || null, store: it.store || null,
      added_by: row.added_by, paid_by: row.added_by
    });
  }
  renderPantry(); renderDashboard();
}

function renderPantry() {
  const q = ($("pantrySearch").value || "").toLowerCase();
  const list = pantry.filter(i => i.name.toLowerCase().includes(q));
  $("pantryList").innerHTML = list.length ? list.map(i => `
    <div class="item"><div><b>${i.name}</b> <span class="badge">${i.category}</span> <span class="badge">${i.storage}</span><br>
    <span class="muted">${i.level ? "Level: " + i.level : i.quantity + " " + i.unit}${i.expiry_date ? " • Expires " + i.expiry_date : ""}</span></div>
    <div><button class="small" onclick="markUsed('${i.id}')">Used</button>
    <button class="small" onclick="delPantry('${i.id}')">Remove</button></div></div>`).join("")
    : "<p class='muted'>No pantry items yet. Add your first item.</p>";
}
async function markUsed(id) {
  if (demoMode) { const i = pantry.find(x => x.id === id); if (i) i.last_used_at = new Date().toISOString(); saveLocal(); }
  else await sb.from("pantry_items").update({ last_used_at: new Date().toISOString() }).eq("id", id);
  await (demoMode ? Promise.resolve() : loadCloud()); renderDashboard(); renderPantry();
}
async function delPantry(id) {
  if (!confirm("Remove this pantry item?")) return;
  if (demoMode) { pantry = pantry.filter(x => x.id !== id); saveLocal(); }
  else await sb.from("pantry_items").delete().eq("id", id);
  await (demoMode ? Promise.resolve() : loadCloud()); renderPantry(); renderDashboard();
}

function renderDashboard() {
  const low = pantry.filter(i => i.level === "low" || i.level === "empty" || (!i.level && Number(i.quantity) <= 1));
  const exp = pantry.filter(i => { const d = daysUntil(i.expiry_date); return d !== null && d <= 7; });
  const unused = pantry.filter(i => {
    const ref = i.last_used_at || i.created_at; if (!ref) return false;
    return (Date.now() - new Date(ref)) / 86400000 > 10;
  });
  const flag = (title, arr, note) => arr.length ? `<div class="card flag"><h3>${title} (${arr.length})</h3>${arr.map(i => `<div>${i.name} — ${i.level || (i.quantity + " " + i.unit)}${i.expiry_date ? " • exp " + i.expiry_date : ""}</div>`).join("")}<p class="muted">${note}</p></div>` : "";
  $("dashFlags").innerHTML =
    flag("Low stock", low, "Restock these, or add them to the shopping list.") +
    flag("Expiring soon / expired", exp, "Use these first.") +
    flag("Not used in 10 days", unused, "Check if this is still good to use or expired. Nothing is deleted automatically.") ||
    "<div class='card'><p>Nothing flagged right now. Pantry looks good.</p></div>";
  $("dashCounts").innerHTML = `<div class="card"><b>${pantry.length}</b> pantry items • <b>${shopping.filter(s => !s.checked).length}</b> items to buy • <b>${shopping.length}</b> shopping items total</div>`;
}

// ---- Shopping ----
async function renderShopping() {
  $("shopList").innerHTML = shopping.length ? shopping.map(s => `
    <div class="item"><div><input type="checkbox" ${s.checked ? "checked" : ""} onchange="toggleShop('${s.id}', this.checked)"> <b>${s.name}</b> — ${s.quantity} ${s.unit} <span class="muted">(${s.category}${s.added_by ? " • " + s.added_by : ""})</span></div>
    <button class="small" onclick="delShop('${s.id}')">Remove</button></div>`).join("")
    : "<p class='muted'>Shopping list is empty.</p>";
}
async function toggleShop(id, checked) {
  if (demoMode) { const s = shopping.find(x => x.id === id); if (s) s.checked = checked; saveLocal(); }
  else await sb.from("shopping_items").update({ checked }).eq("id", id);
  if (!demoMode) await loadCloud();
}
async function delShop(id) {
  if (demoMode) { shopping = shopping.filter(x => x.id !== id); saveLocal(); }
  else await sb.from("shopping_items").delete().eq("id", id);
  if (!demoMode) await loadCloud(); renderShopping();
}

// ---- Receipt review ----
async function handleReceipt(file) {
  $("receiptStatus").textContent = "Reading receipt… please wait.";
  let text = "";
  try {
    if (file.type === "application/pdf") {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const c = await page.getTextContent();
        text += c.items.map(x => x.str).join(" ") + "\n";
      }
    } else {
      const r = await Tesseract.recognize(file, "eng");
      text = r.data.text;
    }
  } catch (e) { return $("receiptStatus").textContent = "Could not read this file automatically. Use manual or bulk add, or try a clearer photo."; }
  // Best-effort parse: lines like "Tomatoes 2.49" or "2 x Milk 3.99"
  receiptRows = text.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s+(\d+\.?\d*)\s*$/); return m ? { name: m[1], qty: 1, price: m[2], include: true } : { name: l, qty: 1, price: "", include: false };
  }).filter(r => r.name.length > 2).slice(0, 60);
  $("receiptStatus").textContent = `Found ${receiptRows.length} possible lines. Fix them below, then save the ones you tick.`;
  $("receiptTable").innerHTML = "<table><tr><th>Use</th><th>Item</th><th>Qty</th><th>Price ($)</th></tr>" +
    receiptRows.map((r, i) => `<tr><td><input type="checkbox" ${r.include ? "checked" : ""} onchange="receiptRows[${i}].include=this.checked"></td><td><input value="${r.name.replace(/"/g, "")}" onchange="receiptRows[${i}].name=this.value"></td><td><input type="number" value="${r.qty}" onchange="receiptRows[${i}].qty=this.value"></td><td><input value="${r.price}" onchange="receiptRows[${i}].price=this.value"></td></tr>`).join("") + "</table>";
  $("saveReceiptBtn").classList.remove("hidden");
}
async function saveReceipt() {
  for (const r of receiptRows.filter(x => x.include && x.name)) {
    await addPantryItem({ name: r.name, category: "Other", quantity: Number(r.qty) || 1, unit: "pcs", storage: "Pantry", total_price: r.price ? Number(r.price) : null, purchase_date: today() });
  }
  alert("Saved checked receipt items to pantry."); show("pantry");
}

// ---- Forms (wired in index.html) ----
document.addEventListener("DOMContentLoaded", init);
