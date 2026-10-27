// Home App — Phase 1: pantry, shopping list, dashboard.
// Phase 2: kitchen log + recipe book (seeded Jain library, Gujarati names).
// Phase 3: What To Cook from pantry, expiring-first, tithi-filtered.
// All recipes are Jain-friendly: no onion, no garlic, no eggs/meat/honey,
// no root vegetables except ginger (ginger is allowed). Green vegetables
// are flagged per recipe and filtered out when tithi mode is on.
// Shared cloud mode: Supabase (config.js). No config = local demo mode only.
// Phone + password login: Supabase Auth does not do password-only phone
// login on the free tier without SMS, so the phone is used as the login
// name and mapped to an internal auth email (p<digits>@homeapp.local).
// No SMS is sent, no real email is needed, and "Confirm email" must be OFF
// in Supabase Auth settings. The phone itself is stored in profiles.

let sb = null, demoMode = true, user = null, pantry = [], shopping = [];
let recipes = [], kitchenLog = [], tithiToday = false;
let loginMethod = "phone", currentHousehold = null, householdMembers = [];
let inventoryItems = [], editingInvId = null;
const INV_CATEGORIES = ["Dal and Pulses", "Atta and Flour", "Rice", "Masala", "Dry Fruits", "Oil and Ghee", "Dairy", "Vegetables", "Fruits", "Snacks", "Frozen", "Household", "Other"];
const UNIT_BASE = { g: 1, kg: 1000, lb: 453.592, oz: 28.3495, ml: 1, L: 1000, cup: 240, tbsp: 15, tsp: 5, pcs: 1 };
function convertQuantity(q, from, to) {
  if (from === to) return q;
  const w = ["g", "kg", "lb", "oz"], v = ["ml", "L", "cup", "tbsp", "tsp"];
  const fam = (u) => w.includes(u) ? "w" : v.includes(u) ? "v" : "p";
  if (fam(from) !== fam(to)) return null;
  if (fam(from) === "p") return null;
  return q * UNIT_BASE[from] / UNIT_BASE[to];
}
let receiptRows = [];
// Seeded Jain library — assistant-seeded, family can add more.
// ingredients use pantry-style names so What To Cook can match them.
const SEED_RECIPES = [
  { name: "Moong Dal Khichdi", gujarati: "મગની ખીચડી", category: "Main", minutes: 30, green_veg: false, ingredients: ["Rice", "Moong Dal", "Ginger", "Turmeric", "Cumin", "Ghee", "Salt"], steps: "Wash rice and moong dal. Cook with water, ginger and turmeric until soft. Temper with cumin in ghee, add salt, and serve warm." },
  { name: "Dal Dhokli", gujarati: "દાળ ઢોકલી", category: "Main", minutes: 40, green_veg: false, ingredients: ["Toor Dal", "Wheat Flour", "Tomato", "Ginger", "Turmeric", "Cumin", "Ghee", "Salt"], steps: "Cook toor dal with tomato, ginger and turmeric. Knead wheat flour into small diamonds, simmer them in the dal, temper with cumin in ghee." },
  { name: "Gujarati Kadhi", gujarati: "ગુજરાતી કઢી", category: "Main", minutes: 25, green_veg: false, ingredients: ["Yogurt", "Besan", "Ginger", "Turmeric", "Cumin", "Ghee", "Salt"], steps: "Whisk yogurt with besan and water. Simmer gently with ginger and turmeric. Temper with cumin in ghee. Do not boil hard." },
  { name: "Jeera Rice", gujarati: "જીરા રાઇસ", category: "Rice", minutes: 25, green_veg: false, ingredients: ["Rice", "Cumin", "Ghee", "Ginger", "Salt"], steps: "Cook rice. Temper cumin and ginger in ghee, toss with rice and salt." },
  { name: "Moong Dal", gujarati: "મગની દાળ", category: "Main", minutes: 25, green_veg: false, ingredients: ["Moong Dal", "Ginger", "Turmeric", "Cumin", "Ghee", "Salt"], steps: "Cook moong dal until soft, mash lightly, temper with cumin and ginger in ghee." },
  { name: "Paneer Butter Masala (no onion, no garlic)", gujarati: "પનીર બટર મસાલા", category: "Main", minutes: 30, green_veg: false, ingredients: ["Paneer", "Tomato", "Ginger", "Cream", "Butter", "Turmeric", "Salt"], steps: "Cook tomato with ginger into a smooth base. Add paneer, cream and butter, simmer gently, season with salt." },
  { name: "Sev Tameta nu Shaak", gujarati: "સેવ ટામેટાનું શાક", category: "Shaak", minutes: 20, green_veg: false, ingredients: ["Sev", "Tomato", "Ginger", "Turmeric", "Cumin", "Oil", "Salt"], steps: "Cook tomato with ginger, turmeric and cumin. Add water to make a light gravy, top with sev just before serving so it stays crisp." },
  { name: "Thepla", gujarati: "થેપલા", category: "Bread", minutes: 30, green_veg: true, ingredients: ["Wheat Flour", "Fenugreek Leaves", "Yogurt", "Turmeric", "Ginger", "Oil", "Salt"], steps: "Knead wheat flour with fenugreek leaves, yogurt and spices. Roll thin and roast on a pan with a little oil." },
  { name: "Dudhi nu Shaak", gujarati: "દૂધીનું શાક", category: "Shaak", minutes: 25, green_veg: true, ingredients: ["Bottle Gourd", "Tomato", "Ginger", "Turmeric", "Cumin", "Oil", "Salt"], steps: "Cook bottle gourd with tomato, ginger and turmeric until soft. Temper with cumin." },
  { name: "Tindora nu Shaak", gujarati: "ટીંડોળાનું શાક", category: "Shaak", minutes: 25, green_veg: true, ingredients: ["Ivy Gourd", "Tomato", "Ginger", "Turmeric", "Cumin", "Oil", "Salt"], steps: "Slice ivy gourd, cook with tomato and spices until tender." },
  { name: "Palak Paneer (no onion, no garlic)", gujarati: "પાલક પનીર", category: "Main", minutes: 30, green_veg: true, ingredients: ["Spinach", "Paneer", "Tomato", "Ginger", "Cream", "Turmeric", "Salt"], steps: "Blanch spinach, blend with tomato and ginger. Simmer, add paneer and a little cream." },
  { name: "Green Beans Shaak", gujarati: "ફણસીનું શાક", category: "Shaak", minutes: 20, green_veg: true, ingredients: ["Green Beans", "Tomato", "Ginger", "Turmeric", "Cumin", "Oil", "Salt"], steps: "Cook green beans with tomato, ginger and turmeric until just tender." },
  { name: "Matar Pulao", gujarati: "વટાણા પુલાવ", category: "Rice", minutes: 30, green_veg: true, ingredients: ["Rice", "Green Peas", "Cumin", "Ginger", "Ghee", "Salt"], steps: "Cook rice with green peas, tempered cumin and ginger in ghee." }
];
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
  ["dashboard", "pantry", "add", "shopping", "recipes", "kitchen", "cook", "household", "receipts", "budget"].forEach(v => { const el = $(`view-${v}`); if (el) el.classList.toggle("hidden", v !== view); });
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  if (view === "pantry") renderInventory();
  if (view === "shopping") renderShopping();
  if (view === "recipes") renderRecipes();
  if (view === "kitchen") { renderKitchen(); loadMeals(); renderMealIngTable(); }
  if (view === "cook") { renderCook(); }
  if (view === "cook") renderCook();
  if (view === "household") renderHousehold();
  if (view === "receipts") renderReceiptReview();
  if (view === "budget") loadBudget();
}

function loadLocal() {
  pantry = JSON.parse(localStorage.getItem("ha_pantry") || "[]");
  shopping = JSON.parse(localStorage.getItem("ha_shopping") || "[]");
  recipes = JSON.parse(localStorage.getItem("ha_recipes") || "null") || SEED_RECIPES.map((r, i) => ({ ...r, id: "seed-" + i, seeded: true }));
  kitchenLog = JSON.parse(localStorage.getItem("ha_kitchen") || "[]");
  tithiToday = localStorage.getItem("ha_tithi_" + today()) === "1";
}
function saveLocal() {
  localStorage.setItem("ha_pantry", JSON.stringify(pantry));
  localStorage.setItem("ha_shopping", JSON.stringify(shopping));
  localStorage.setItem("ha_recipes", JSON.stringify(recipes));
  localStorage.setItem("ha_kitchen", JSON.stringify(kitchenLog));
}

async function init() {
  const cfg = window.HOME_APP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    demoMode = false;
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    if (user) {
      await loadCloud(); await loadHousehold(); await loadInventory();
      $("who").textContent = currentHousehold ? currentHousehold.name : "Shared household";
      showApp(); show(currentHousehold ? "dashboard" : "household");
    } else {
      showLogin();
    }
    sb.channel("ha-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_items" }, () => { if (user) loadCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, () => { if (user) loadCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => { if (user) loadInventory(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_list" }, () => { if (user) loadCloud(); })
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
  if (p.error) { alert(p.error.message); return; }
  if (s.error) { alert(s.error.message); return; }
  pantry = p.data || []; shopping = s.data || [];
  // Phase 2/3 tables are optional until the phase-23 schema is run.
  // A missing table must NOT wipe pantry/shopping or block the app.
  try {
    const r = await sb.from("recipes").select("*").order("name");
    if (!r.error) {
      recipes = r.data || [];
      if (!recipes.length) {
        const seed = await sb.from("recipes").insert(SEED_RECIPES.map(r => ({ name: r.name, gujarati: r.gujarati, category: r.category, minutes: r.minutes, green_veg: r.green_veg, ingredients: r.ingredients, steps: r.steps, seeded: true }))).select();
        if (!seed.error) recipes = seed.data || [];
        else recipes = SEED_RECIPES.map((r, i) => ({ ...r, id: "seed-" + i, seeded: true }));
      }
    } else recipes = SEED_RECIPES.map((r, i) => ({ ...r, id: "seed-" + i, seeded: true }));
  } catch (e) { recipes = SEED_RECIPES.map((r, i) => ({ ...r, id: "seed-" + i, seeded: true })); }
  try {
    const k = await sb.from("kitchen_log").select("*").order("meal_date", { ascending: false }).limit(50);
    if (!k.error) kitchenLog = k.data || [];
  } catch (e) { /* kitchen log unavailable until schema is run */ }
  // v22 quirk fix: loadCloud overwrote recipes with raw household rows
  // (no ingredients column, no _ings) and kitchenLog with the old table,
  // so after any Save/Add action the Cook/Recipe screens showed blank
  // ingredients and seeded recipes vanished until re-login. Re-apply
  // the household merges here so every loadCloud leaves correct state.
  if (currentHousehold) { await loadHouseholdRecipes(); await loadMeals(); }
  try {
    const t = await sb.from("tithi_days").select("*").eq("day", today()).single();
    tithiToday = !t.error && !!t.data?.is_tithi;
  } catch (e) { tithiToday = localStorage.getItem("ha_tithi_" + today()) === "1"; }
  renderDashboard(); renderPantry(); renderShopping();
  const vr = $("view-recipes"), vk = $("view-kitchen"), vc = $("view-cook");
  if (vr && !vr.classList.contains("hidden")) renderRecipes();
  if (vk && !vk.classList.contains("hidden")) renderKitchen();
  if (vc && !vc.classList.contains("hidden")) renderCook();
}

function setLoginMethod(m) {
  loginMethod = m;
  $("methodPhone").classList.toggle("active", m === "phone");
  $("methodEmail").classList.toggle("active", m === "email");
  $("phoneField").classList.toggle("hidden", m !== "phone");
  $("emailField").classList.toggle("hidden", m !== "email");
}
async function doGoogle() {
  if (demoMode) return alert("Google sign-in needs Supabase (live mode), not demo mode.");
  const res = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
  if (res.error) alert("Google sign-in is not enabled yet in Supabase Auth (provider not enabled). Use phone or email for now: " + res.error.message);
}
async function doAuth(mode) {
  const phone = $("phone").value.trim(), email = $("email").value.trim(), pass = $("pass").value, name = $("displayName").value.trim();
  let authEmail = null;
  if (loginMethod === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Enter a valid email address.");
    authEmail = email;
  } else {
    if (!/^\d{10}$/.test(phone)) return alert("Phone number must be exactly 10 digits — no spaces, hyphens, or +1.");
    authEmail = phoneEmail(phone);
  }
  if (mode === "signup" && !name) return alert("Please enter your name to create an account.");
  if (pass.length < 6) return alert("Password must be at least 6 characters.");
  if (demoMode) {
    user = { phone: phone || email, name: name || phone || email };
    $("who").textContent = `Demo as ${user.name}`;
    showApp(); return show("dashboard");
  }
  let res = mode === "signup"
    ? await sb.auth.signUp({ email: authEmail, password: pass })
    : await sb.auth.signInWithPassword({ email: authEmail, password: pass });
  if (res.error) return alert(res.error.message);
  user = res.data.user;
  if (mode === "signup") await sb.from("profiles").upsert({ id: user.id, phone: loginMethod === "phone" ? phone : null, email: loginMethod === "email" ? email : null, display_name: name || phone || email });
  $("who").textContent = "Shared household";
  try { await loadCloud(); } catch (e) { /* a render/load error must not block login */ }
  await loadHousehold(); await loadInventory(); await loadHouseholdRecipes(); await loadMeals(); await loadJainSettings(); await loadTithiToday(); showApp(); show(currentHousehold ? "dashboard" : "household");
}
async function loadHousehold() {
  currentHousehold = null; householdMembers = [];
  if (demoMode || !sb || !user) return;
  try {
    const m = await sb.from("members").select("*, households(*)").eq("user_id", user.id).order("joined_at").limit(1);
    if (!m.error && m.data && m.data.length) {
      currentHousehold = m.data[0].households;
      const mem = await sb.from("members").select("*").eq("household_id", currentHousehold.id);
      if (!mem.error) householdMembers = mem.data || [];
    }
  } catch (e) { /* households table not yet applied — old app keeps working */ }
  const params = new URLSearchParams(window.location.search);
  if (params.get("invite") && $("hhJoinCode")) $("hhJoinCode").value = params.get("invite").toUpperCase();
}
function renderHousehold() {
  if (!$("householdInfo")) return;
  if (currentHousehold) {
    $("householdInfo").innerHTML = `<p><b>${esc(currentHousehold.name)}</b> • Invite code: <b>${esc(currentHousehold.invite_code)}</b></p><p class="muted">Share this link: ${esc(window.location.origin + window.location.pathname)}?invite=${esc(currentHousehold.invite_code)}</p>`;
    $("memberList").innerHTML = householdMembers.length ? `<h3>Members (${householdMembers.length})</h3>` + householdMembers.map(m => `<div>${esc(m.display_name || m.user_id)} — ${esc(m.role)}</div>`).join("") : "<p class='muted'>No members listed yet.</p>";
  } else {
    $("householdInfo").innerHTML = "<p class='muted'>You are not in a household yet. Create one, or join with a code.</p>";
    $("memberList").innerHTML = "";
  }
}
async function createHousehold() {
  if (!user) return showLogin();
  const name = $("hhName").value.trim(); if (!name) return alert("Enter a household name.");
  if (demoMode) { currentHousehold = { id: "demo-hh", name, invite_code: "DEMO1234" }; householdMembers = [{ user_id: "demo", role: "admin", display_name: user.name }]; renderHousehold(); return show("household"); }
  const h = await sb.from("households").insert({ name, created_by: user.id }).select().single();
  if (h.error) return alert("Household could not be created: " + h.error.message);
  const mem = await sb.from("members").insert({ household_id: h.data.id, user_id: user.id, role: "admin", display_name: user.user_metadata?.display_name || null });
  if (mem.error) return alert("Household created, but admin membership failed: " + mem.error.message);
  await loadHousehold(); renderHousehold(); show("household");
}
async function joinHousehold() {
  if (!user) return showLogin();
  const code = $("hhJoinCode").value.trim().toUpperCase(); if (!code) return alert("Enter an invite code.");
  if (demoMode) { currentHousehold = { id: "demo-hh", name: "Joined household", invite_code: code }; renderHousehold(); return show("household"); }
  // Join must NOT select households directly: a non-member cannot read
  // a household under RLS. Use the invite-code function instead — it
  // returns only the household whose code matches exactly.
  const h = await sb.rpc("get_household_by_code", { p_code: code });
  if (h.error || !h.data || !h.data.length) return alert("No household found for that invite code.");
  const mem = await sb.from("members").insert({ household_id: h.data[0].id, user_id: user.id, role: "member" });
  if (mem.error) return alert("Could not join household: " + mem.error.message);
  await loadHousehold(); renderHousehold(); show("household");
}
async function doLogout() {
  if (sb) await sb.auth.signOut();
  user = null; location.reload();
}

// ---- Pantry ----
async function addPantryItem(it) {
  if (!user) return showLogin();
  // pantry_items has NO store, total_price or unit_price columns — those
  // live in purchase_lots. Sending them to pantry_items caused Supabase's
  // "Could not find the 'store' column" schema-cache error. So whitelist
  // pantry fields here, and put price/store only in the lot below.
  const row = {
    name: it.name, category: it.category || "Other", quantity: it.quantity || 0,
    unit: it.unit || "pcs", storage: it.storage || "Pantry",
    level: it.level || null, expiry_date: it.expiry_date || null,
    purchase_date: it.purchase_date || null,
    added_by: user?.phone || user?.name || "family"
  };
  if (demoMode) { row.id = Date.now().toString(); row.created_at = new Date().toISOString(); pantry.push(row); saveLocal(); return true; }
  else {
    const { data, error } = await sb.from("pantry_items").insert(row).select().single();
    if (error) { alert(error.message); return false; }
    if (it.total_price || it.unit_price || it.store) {
      const lot = await sb.from("purchase_lots").insert({
        pantry_item_id: data.id, item_name: it.name, quantity: it.quantity, unit: it.unit,
        unit_price: it.unit_price || null, total_price: it.total_price || null,
        purchase_date: it.purchase_date || null, store: it.store || null,
        added_by: row.added_by, paid_by: row.added_by
      });
      if (lot.error) alert("Pantry item saved, but price/store lot failed: " + lot.error.message);
    }
    // Refresh from the database — do NOT just re-render the old local list.
    // Realtime was not reliably enabled, so without this the new item
    // would not appear until a manual reload.
    await loadCloud(); return true;
  }
  renderPantry(); renderDashboard(); return true;
}

function renderPantry() {
  // Phase 2 replaced the old pantry screen with the inventory screen,
  // so pantrySearch/pantryList no longer exist in the HTML. Guard here
  // so a missing old element can never abort login (v13 bug: loadCloud
  // called renderPantry before showApp, threw, and login stayed stuck).
  if (!$("pantryList")) return;
  const q = ($("pantrySearch")?.value || "").toLowerCase();
  const list = pantry.filter(i => i.name.toLowerCase().includes(q));
  $("pantryList").innerHTML = list.length ? list.map(i => `
    <div class="item"><div><b>${i.name}</b> <span class="badge">${i.category}</span> <span class="badge">${i.storage}</span><br>
    <span class="muted">${i.level ? "Level: " + i.level : i.quantity + " " + i.unit}${i.expiry_date ? " • Expires " + i.expiry_date : ""}</span></div>
    <div><button class="small" onclick="markUsed('${i.id}')">Used</button>
    <button class="small" onclick="delPantry('${i.id}')">Remove</button></div></div>`).join("")
    : "<p class='muted'>No pantry items yet. Add your first item.</p>";
}
async function markUsed(id) {
  // "Used" must visibly consume something. Real-world case that looked
  // broken: a 1-unit item went 1 -> 0 but stayed listed at 0, so it looked
  // like nothing happened. Now: using the last unit REMOVES the item,
  // with a visible message. Level items step down full -> half -> low -> empty.
  let item = pantry.find(x => String(x.id) === String(id));
  if (!item) { await loadCloud(); item = pantry.find(x => String(x.id) === String(id)); }
  if (!item) return alert("That item was not found — please reload the Pantry and try again.");
  const msgEl = $("pantryMsg");
  const setMsg = (t) => { if (msgEl) msgEl.textContent = t; };
  try {
    if (item.level) {
      const steps = ["full", "half", "low", "empty"];
      const idx = steps.indexOf(item.level);
      const nextLevel = idx >= 0 ? steps[Math.min(idx + 1, 3)] : item.level;
      if (demoMode) { item.level = nextLevel; item.last_used_at = new Date().toISOString(); saveLocal(); }
      else {
        const res = await sb.from("pantry_items").update({ level: nextLevel, last_used_at: new Date().toISOString() }).eq("id", id);
        if (res.error) throw new Error(res.error.message);
        await loadCloud();
      }
      setMsg(`Used 1 × ${item.name} — level now: ${nextLevel}.`);
    } else {
      const newQty = Number(item.quantity || 0) - 1;
      if (newQty <= 0) {
        if (demoMode) { pantry = pantry.filter(x => String(x.id) !== String(id)); saveLocal(); }
        else {
          const res = await sb.from("pantry_items").delete().eq("id", id);
          if (res.error) throw new Error(res.error.message);
          await loadCloud();
        }
        setMsg(`Used up ${item.name} — removed from pantry (it was the last one).`);
      } else {
        if (demoMode) { item.quantity = newQty; item.last_used_at = new Date().toISOString(); saveLocal(); }
        else {
          const res = await sb.from("pantry_items").update({ quantity: newQty, last_used_at: new Date().toISOString() }).eq("id", id);
          if (res.error) throw new Error(res.error.message);
          await loadCloud();
        }
        setMsg(`Used 1 × ${item.name} — now ${newQty} ${item.unit} left.`);
      }
    }
  } catch (e) {
    alert("Used failed: " + (e.message || e));
    return;
  }
  renderDashboard(); renderPantry();
  // Re-apply the message after re-render (renderPantry does not clear it).
  if (msgEl && msgEl.textContent) { /* kept */ }
}
async function delPantry(id) {
  // No confirm() dialog: it blocks deletion in some browsers/automation
  // and silently leaves the item in place with no error. Remove is direct,
  // like shopping Remove, and the item is gone immediately on refresh.
  if (demoMode) { pantry = pantry.filter(x => x.id !== id); saveLocal(); }
  else {
    const res = await sb.from("pantry_items").delete().eq("id", id);
    if (res.error) return alert(res.error.message);
    await loadCloud();
  }
  renderPantry(); renderDashboard();
}

function renderDashboard() {
  if (!$("dashCounts") || !$("dashFlags")) return;
  const src = (currentHousehold && inventoryItems.length) ? inventoryItems : pantry;
  const low = src.filter(i => i.level === "low" || i.level === "empty" || (!i.level && Number(i.quantity) <= Number(i.low_threshold ?? 1)));
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
  const invCount = (currentHousehold && inventoryItems.length) ? inventoryItems.length : pantry.length;
  $("dashCounts").innerHTML = `<div class="card"><b>${invCount}</b> pantry items • <b>${shopping.filter(s => !s.checked).length}</b> items to buy • <b>${shopping.length}</b> shopping items total • <b>${kitchenLog.length}</b> meals logged</div>`;
  if ($("dashRecent")) {
    const recent = kitchenLog.slice(0, 5);
    $("dashRecent").innerHTML = recent.length ? recent.map(k => `<div>${esc(k.dish_name)}${k.gujarati ? " (" + esc(k.gujarati) + ")" : ""} — ${esc(k.meal_date)}</div>`).join("") : "<p class='muted'>No meals logged yet.</p>";
  }
  if ($("dashTithi")) $("dashTithi").textContent = tithiToday ? "Tithi mode is ON today — green-vegetable recipes are hidden in What To Cook." : "Tithi mode is OFF today.";
  if ($("dashTithiToggle")) $("dashTithiToggle").checked = tithiToday;
}

// ---- Shopping ----
async function renderShopping() {
  if (!$("shopList")) return;
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

// ---- Smart receipt parser (fix for wrapped order screenshots) ----
// Old parser treated EVERY OCR line as one item, so a Costco order
// screenshot broke: item names wrap over 2-3 lines, the price sits on
// its own line ("$10.01"), and the leading "2 x" was kept in the name.
// Result was 26 broken rows with blank prices for an 11-item order.
// This parser instead: skips store/header lines, joins wrapped lines
// until a price line is found, takes a price-only line as the total
// for the lines above it, parses a leading "N x" as quantity, and
// parses an embedded "NAME 2 KG 4.99" as qty/unit/total.
// Price ambiguity: the price shown under an item is taken as the
// LINE TOTAL for that quantity, and the review screen lets the user
// fix it if the store meant per-unit instead. Nothing is saved until
// the user presses Save.
function parseSmartReceipt(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items = [];
  let buf = "";
  const flush = (price) => {
    if (!buf) return;
    let name = buf.replace(/\s+/g, " ").trim();
    let qty = 1, unit = "pcs", total = price;
    const mx = name.match(/^(\d+)\s*x\s+(.+)$/i);
    if (mx) { qty = Number(mx[1]); name = mx[2].trim(); }
    const mq = name.match(/^(.*?)\s+(\d+\.?\d*)\s*(kg|g|lb|oz|l|ml|pcs)\s*$/i);
    if (mq && total != null) { name = mq[1].trim(); qty = Number(mq[2]); unit = mq[3].toLowerCase(); }
    if (name.length > 2) items.push({ name, qty, unit, total, unit_price: (total != null && qty) ? total / qty : null, include: total != null });
    buf = "";
  };
  for (const line of lines) {
    if (/^\d+\s+items?$/i.test(line)) continue;
    if (/^(costco|cosco|cosrco|walmart|target)$/i.test(line.replace(/[^a-z]/gi, ""))) continue;
    if (/^(subtotal|tax|delivery|tip|total\s+due)$/i.test(line)) continue;
    const priceOnly = line.match(/^\$?\s*(\d+\.\d{2})$/);
    if (priceOnly) { flush(Number(priceOnly[1])); continue; }
    const trailing = line.match(/^(.*?)\s+\$?\s*(\d+\.\d{2})\s*$/);
    if (trailing && buf === "") { buf = trailing[1]; flush(Number(trailing[2])); continue; }
    if (trailing && buf !== "") { buf = (buf + " " + trailing[1]).trim(); flush(Number(trailing[2])); continue; }
    buf = buf ? buf + " " + line : line;
  }
  flush(null);
  return items;
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
  // Smart parse: joins wrapped lines, price on its own line, "N x" qty.
  receiptRows = parseSmartReceipt(text).map(r => ({ name: r.name, qty: r.qty, price: r.total != null ? String(r.total) : "", include: r.include })).slice(0, 60);
  $("receiptStatus").textContent = `Found ${receiptRows.length} possible lines. Fix them below, then save the ones you tick.`;
  $("receiptTable").innerHTML = "<table><tr><th>Use</th><th>Item</th><th>Qty</th><th>Price ($)</th></tr>" +
    receiptRows.map((r, i) => `<tr><td><input type="checkbox" ${r.include ? "checked" : ""} onchange="receiptRows[${i}].include=this.checked"></td><td><input value="${r.name.replace(/"/g, "")}" onchange="receiptRows[${i}].name=this.value"></td><td><input type="number" value="${r.qty}" onchange="receiptRows[${i}].qty=this.value"></td><td><input value="${r.price}" onchange="receiptRows[${i}].price=this.value"></td></tr>`).join("") + "</table>";
  $("saveReceiptBtn").classList.remove("hidden");
}
async function saveReceipt() {
  // Fix for the "Save does nothing" report: previously this alerted
  // "Saved" even if every insert failed, and when there was no
  // household the items went to the old pantry table, which the new
  // Pantry screen never showed. Now it counts real outcomes and
  // says where the items went.
  let saved = 0, failed = 0;
  for (const r of receiptRows.filter(x => x.include && x.name)) {
    try {
      const ok = await addPhase2Item({ name: r.name, category: guessCategory(r.name), quantity: Number(r.qty) || 1, unit: "pcs", storage: "Pantry", cost_per_unit: r.price && Number(r.qty) ? Number(r.price) / Number(r.qty) : null, purchase_date: today() });
      if (ok === false) failed++; else saved++;
    } catch (e) { failed++; }
  }
  if (!demoMode) { await loadCloud(); await loadInventory(); }
  if (!saved) { alert("Nothing was saved — every item failed. Check any error message above and try again."); return; }
  alert(`Saved ${saved} item(s) to pantry${!currentHousehold ? " (personal pantry — create a household to share them, then use Migrate on the Pantry screen)" : ""}.${failed ? ` ${failed} item(s) failed.` : ""}`);
  show("pantry");
}

// ---- Ghar Pantry Phase 2: Inventory pantry ----
async function loadInventory() {
  inventoryItems = [];
  if (demoMode || !sb || !currentHousehold) return;
  try {
    const r = await sb.from("inventory").select("*").eq("household_id", currentHousehold.id).order("name");
    if (!r.error) inventoryItems = r.data || [];
  } catch (e) { /* inventory unavailable until household exists */ }
  renderInventory(); renderDashboard();
}
async function logInvEvent(invId, type, qtyChange, note) {
  if (demoMode || !sb || !currentHousehold) return;
  await sb.from("inventory_events").insert({ household_id: currentHousehold.id, inventory_id: invId, event_type: type, quantity_change: qtyChange, user_id: user?.id || null, note: note || null });
}
function invDisplay(item) { return item.tracking_type === "level" ? "Level: " + (item.level || "full") : item.quantity + " " + item.unit; }
function renderInventory() {
  if (!$("invList")) return;
  if (!currentHousehold) {
    // Fix for the "Save does nothing" report: when there is no
    // household, receipt/manual saves go to the old pantry table,
    // so the Pantry screen must SHOW that old pantry instead of
    // only saying "create a household". Otherwise saved items look
    // lost. The Migrate button below moves them once a household
    // exists.
    const q = ($("invSearch")?.value || "").toLowerCase();
    const list = pantry.filter(i => !q || i.name.toLowerCase().includes(q));
    if ($("invExpiring")) $("invExpiring").innerHTML = "<p class='muted'>You are not in a household yet. Below are your personal pantry items. Create a household to share them, then use Migrate below to move them into the shared pantry.</p>";
    $("invList").innerHTML = list.length ? list.map(i => `<div class="item"><div><b>${esc(i.name)}</b> <span class="badge">${esc(i.category || "Other")}</span> <span class="badge">${esc(i.storage || "Pantry")}</span><br><span class="muted">${i.level ? "Level: " + i.level : i.quantity + " " + (i.unit || "pcs")}${i.expiry_date ? " • Expires " + i.expiry_date : ""}</span></div><div><button class="small" onclick="markUsed('${i.id}')">Used</button><button class="small" onclick="delPantry('${i.id}')">Remove</button></div></div>`).join("") : "<p class='muted'>No pantry items yet. Add your first item.</p>";
    return;
  }
  const q = ($("invSearch")?.value || "").toLowerCase();
  const cat = $("invCatFilter")?.value || "", loc = $("invLocFilter")?.value || "";
  const list = inventoryItems.filter(i => (!q || i.name.toLowerCase().includes(q)) && (!cat || i.category === cat) && (!loc || i.storage === loc));
  const expiring = inventoryItems.filter(i => { const d = daysUntil(i.expiry_date); return d !== null && d <= 7; });
  if ($("invExpiring")) $("invExpiring").innerHTML = expiring.length ? `<h3>Expiring soon (${expiring.length})</h3>` + expiring.map(i => `<div>${esc(i.name)} — ${invDisplay(i)}${i.expiry_date ? " • Expires " + i.expiry_date : ""}</div>`).join("") : "<p class='muted'>Nothing expiring in the next 7 days.</p>";
  if ($("invCatFilter")) {
    const cats = [...new Set(inventoryItems.map(i => i.category))];
    const cur = $("invCatFilter").value;
    $("invCatFilter").innerHTML = `<option value="">All categories</option>` + INV_CATEGORIES.map(c => `<option>${c}</option>`).join("") + cats.filter(c => !INV_CATEGORIES.includes(c)).map(c => `<option>${c}</option>`).join("");
    $("invCatFilter").value = cur;
  }
  $("invList").innerHTML = list.length ? list.map(i => {
    const low = i.tracking_type === "level" ? (i.level === "low" || i.level === "empty") : Number(i.quantity) <= Number(i.low_threshold ?? 1);
    return `<div class="item"><div><b>${esc(i.name)}</b> <span class="badge">${esc(i.category)}</span> <span class="badge">${esc(i.storage)}</span> ${low ? `<span class="badge warn">Low stock</span>` : ""}<br><span class="muted">${invDisplay(i)}${i.brand ? " • " + esc(i.brand) : ""}${i.expiry_date ? " • Expires " + i.expiry_date : ""}${i.cost_per_unit ? " • $" + i.cost_per_unit + "/" + i.unit : ""} • Low at ${i.low_threshold ?? 1} ${i.unit}</span></div>
    <div><button class="small" onclick="invUsed('${i.id}')">Used some</button><button class="small" onclick="invFinished('${i.id}')">Finished</button><button class="small" onclick="invWasted('${i.id}')">Thrown away</button><button class="small" onclick="editInventory('${i.id}')">Edit</button></div></div>`;
  }).join("") : "<p class='muted'>No pantry items in this household yet. Add your first item.</p>";
}
async function addInventoryItem(it) {
  if (!currentHousehold) return alert("Create or join a household first.");
  const row = { household_id: currentHousehold.id, name: it.name, category: it.category || "Other", quantity: it.quantity ?? 0, unit: it.unit || "pcs", storage: it.storage || "Pantry", brand: it.brand || null, tracking_type: it.level ? "level" : "exact", level: it.level || null, cost_per_unit: it.cost_per_unit || null, low_threshold: it.low_threshold ?? 1, purchase_date: it.purchase_date || null, expiry_date: it.expiry_date || null, added_by: user?.phone || "family" };
  if (demoMode) { row.id = Date.now().toString(); inventoryItems.push(row); renderInventory(); return true; }
  const res = await sb.from("inventory").insert(row).select().single();
  if (res.error) { alert(res.error.message); return false; }
  await logInvEvent(res.data.id, "bought", row.quantity, "Added to pantry");
  await loadInventory();
  return true;
}
async function addPhase2Item(it) {
  if (currentHousehold) return await addInventoryItem(it);
  return await addPantryItem(it);
}
async function invUsed(id) {
  const item = inventoryItems.find(i => String(i.id) === String(id)); if (!item) return;
  if (demoMode) { if (item.tracking_type === "level") { const steps = ["full", "half", "low", "empty"]; item.level = steps[Math.min(steps.indexOf(item.level) + 1, 3)]; } else item.quantity = Math.max(0, Number(item.quantity) - 1); renderInventory(); return; }
  let update = {};
  if (item.tracking_type === "level") { const steps = ["full", "half", "low", "empty"]; update.level = steps[Math.min(steps.indexOf(item.level) + 1, 3)]; }
  else update.quantity = Math.max(0, Number(item.quantity) - 1);
  const res = await sb.from("inventory").update(update).eq("id", id);
  if (res.error) return alert(res.error.message);
  await logInvEvent(id, "used", -1, "Used some");
  await loadInventory();
}
async function invFinished(id) {
  const item = inventoryItems.find(i => String(i.id) === String(id)); if (!item) return;
  if (demoMode) { if (item.tracking_type === "level") item.level = "empty"; else item.quantity = 0; renderInventory(); return; }
  const update = item.tracking_type === "level" ? { level: "empty" } : { quantity: 0 };
  const res = await sb.from("inventory").update(update).eq("id", id);
  if (res.error) return alert(res.error.message);
  await logInvEvent(id, "used", null, "Finished");
  await loadInventory();
}
async function invWasted(id) {
  const item = inventoryItems.find(i => String(i.id) === String(id)); if (!item) return;
  if (demoMode) { inventoryItems = inventoryItems.filter(i => String(i.id) !== String(id)); renderInventory(); return; }
  await logInvEvent(id, "wasted", null, "Thrown away");
  const res = await sb.from("inventory").delete().eq("id", id);
  if (res.error) return alert(res.error.message);
  await loadInventory();
}
function editInventory(id) {
  const item = inventoryItems.find(i => String(i.id) === String(id)); if (!item) return;
  editingInvId = id;
  $("eName").value = item.name; $("eCat").value = item.category || "Other"; $("eQty").value = item.quantity; $("eUnit").value = item.unit || "pcs"; $("eStorage").value = item.storage || "Pantry"; $("eLevel").value = item.level || ""; $("eLow").value = item.low_threshold ?? 1; $("eExp").value = item.expiry_date || ""; $("eCost").value = item.cost_per_unit || ""; $("eBrand").value = item.brand || "";
  $("editCard").classList.remove("hidden"); $("editCard").scrollIntoView();
}
function onEditUnitChange() {
  const item = inventoryItems.find(i => String(i.id) === String(editingInvId)); if (!item) return;
  const from = item.unit, to = $("eUnit").value, q = Number($("eQty").value);
  const conv = convertQuantity(q, from, to);
  if (conv !== null && from !== to) { $("eQty").value = Math.round(conv * 100) / 100; $("eConvertMsg").textContent = `Converted ${q} ${from} → ${$("eQty").value} ${to}.`; }
  else if (from !== to) $("eConvertMsg").textContent = "No conversion between those units — quantity left as entered.";
  else $("eConvertMsg").textContent = "";
}
async function saveInventoryEdit() {
  const item = inventoryItems.find(i => String(i.id) === String(editingInvId)); if (!item) return;
  const update = { name: $("eName").value.trim(), category: $("eCat").value, quantity: Number($("eQty").value) || 0, unit: $("eUnit").value, storage: $("eStorage").value, level: $("eLevel").value || null, tracking_type: $("eLevel").value ? "level" : "exact", low_threshold: Number($("eLow").value) || 1, expiry_date: $("eExp").value || null, cost_per_unit: $("eCost").value ? Number($("eCost").value) : null, brand: $("eBrand").value || null };
  if (demoMode) { Object.assign(item, update); renderInventory(); $("editCard").classList.add("hidden"); return; }
  const res = await sb.from("inventory").update(update).eq("id", editingInvId);
  if (res.error) return alert(res.error.message);
  await logInvEvent(editingInvId, "adjusted", null, "Edited item");
  $("editCard").classList.add("hidden"); await loadInventory();
}
async function migrateOldPantry() {
  if (!currentHousehold) return alert("Create or join a household first.");
  if (!pantry.length) return alert("No old pantry items to migrate.");
  let count = 0;
  const seen = new Set(inventoryItems.map(i => i.name.toLowerCase()));
  for (const p of pantry) {
    if (seen.has(p.name.toLowerCase())) continue;
    seen.add(p.name.toLowerCase());
    const row = { household_id: currentHousehold.id, name: p.name, category: p.category || "Other", quantity: Number(p.quantity) || 0, unit: p.unit || "pcs", storage: p.storage || "Pantry", tracking_type: p.level ? "level" : "exact", level: p.level || null, low_threshold: 1, expiry_date: p.expiry_date || null, purchase_date: p.purchase_date || null, added_by: "migrated" };
    if (demoMode) { row.id = Date.now().toString() + count; inventoryItems.push(row); }
    else { const res = await sb.from("inventory").insert(row).select().single(); if (!res.error) await logInvEvent(res.data.id, "bought", row.quantity, "Migrated from old pantry"); }
    count++;
  }
  if (!demoMode) await loadInventory(); else renderInventory();
  alert(`Migrated ${count} old pantry item(s) to this household pantry.`);
}

// ---- Phase 2: Recipe book ----
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, ""); }
function renderRecipes() {
  if (!$("recipeList")) return;
  const q = ($("recipeSearch")?.value || "").toLowerCase();
  const list = recipes.filter(r => (r.name + " " + (r.gujarati || "") + " " + (r.category || "")).toLowerCase().includes(q));
  $("recipeList").innerHTML = list.length ? list.map(r => `
    <div class="item"><div><b>${esc(r.name)}</b> ${r.gujarati ? `<span class="badge">${esc(r.gujarati)}</span>` : ""} <span class="badge">${esc(r.category || "Main")}</span> ${r.green_veg ? `<span class="badge">Green veg — not for tithi</span>` : `<span class="badge">Tithi-friendly</span>`}<br>
    <span class="muted">${r.minutes ? r.minutes + " min • " : ""}Ingredients: ${(Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients || "").split(",")).join(", ")}</span><br>
    <span class="muted">${esc(r.steps || "")}</span></div>
    <div><button class="small" onclick="logMealFromRecipe('${r.id}')">I cooked this</button>
    ${r.seeded ? "" : `<button class="small" onclick="delRecipe('${r.id}')">Remove</button>`}</div></div>`).join("")
    : "<p class='muted'>No recipes yet. Add your first family recipe below.</p>";
}
function parseIngAmounts(text) {
  // "Rice:2:kg, Moong Dal:0.5:kg" or "Rice, Moong Dal" (amount null)
  return text.split(",").map(s => s.trim()).filter(Boolean).map(s => {
    const p = s.split(":").map(x => x.trim());
    if (p.length >= 2 && !isNaN(Number(p[1]))) return { name: p[0], amount: Number(p[1]), unit: p[2] || "pcs" };
    return { name: s, amount: null, unit: "pcs" };
  });
}
async function addRecipe() {
  const name = $("rName").value.trim(); if (!name) return alert("Enter a dish name.");
  const ings = parseIngAmounts($("rIng").value);
  const row = { name, gujarati: $("rGuj").value.trim() || null, category: $("rCat").value || "Main", minutes: Number($("rMin").value) || null, green_veg: $("rGreen").checked, ingredients: ings.map(i => i.name), steps: $("rSteps").value.trim() || null, seeded: false };
  if (demoMode) { row.id = "custom-" + Date.now(); row._ings = ings; recipes.push(row); saveLocal(); }
  else if (currentHousehold) {
    const res = await sb.from("recipes").insert({ household_id: currentHousehold.id, name, gujarati: row.gujarati, cuisine: $("rCuisine")?.value || null, meal_type: $("rMealType")?.value || "Main", cooking_time_minutes: row.minutes, favorite: $("rFav")?.checked || false, steps: row.steps, seeded: false, created_by: (await sb.auth.getUser()).data.user?.id }).select().single();
    if (res.error) return alert("Recipe could not be saved: " + res.error.message);
    const withAmt = ings.filter(i => i.amount != null);
    if (withAmt.length) {
      const ir = await sb.from("recipe_ingredients").insert(withAmt.map(i => ({ recipe_id: res.data.id, ingredient_name: i.name, amount: i.amount, unit: i.unit })));
      if (ir.error) alert("Recipe saved, but ingredient amounts failed: " + ir.error.message);
    }
    await loadHouseholdRecipes();
  } else {
    const res = await sb.from("recipes").insert(row).select().single();
    if (res.error) return alert("Recipe could not be saved yet (create or join a household first for the shared recipe book): " + res.error.message);
    await loadCloud();
  }
  renderRecipes(); show("recipes");
  ["rName", "rGuj", "rIng", "rSteps", "rCuisine"].forEach(id => { if ($(id)) $(id).value = ""; }); $("rGreen").checked = false; if ($("rFav")) $("rFav").checked = false;
}
async function loadHouseholdRecipes() {
  if (!currentHousehold) return;
  const { data, error } = await sb.from("recipes").select("*").eq("household_id", currentHousehold.id).order("name");
  if (!error && data) {
    const ids = data.map(r => r.id);
    let ingMap = {}, ingAmtMap = {};
    if (ids.length) {
      const { data: ings } = await sb.from("recipe_ingredients").select("*").in("recipe_id", ids);
      (ings || []).forEach(x => { (ingMap[x.recipe_id] = ingMap[x.recipe_id] || []).push(x.ingredient_name); (ingAmtMap[x.recipe_id] = ingAmtMap[x.recipe_id] || []).push({ name: x.ingredient_name, amount: x.amount, unit: x.unit }); });
    }
    const seeded = recipes.filter(r => r.seeded);
    recipes = [...seeded, ...data.map(r => ({ ...r, category: r.meal_type || "Main", minutes: r.cooking_time_minutes, ingredients: ingMap[r.id] || [], _ings: ingAmtMap[r.id] || [] }))];
    renderRecipes(); renderKitchen();
  }
}
async function delRecipe(id) {
  if (demoMode) { recipes = recipes.filter(r => String(r.id) !== String(id)); saveLocal(); }
  else { const res = await sb.from("recipes").delete().eq("id", id); if (res.error) return alert(res.error.message); await loadCloud(); }
  renderRecipes();
}

// ---- Phase 2: Kitchen log ----
function renderKitchen() {
  if (!$("kitchenList")) return;
  if ($("kitchenDate")) $("kitchenDate").value = $("kitchenDate").value || today();
  const sel = $("kitchenRecipe");
  if (sel) sel.innerHTML = `<option value="">— pick a recipe —</option>` + recipes.map(r => `<option value="${r.id}">${esc(r.name)}${r.gujarati ? " (" + esc(r.gujarati) + ")" : ""}</option>`).join("");
  $("kitchenList").innerHTML = kitchenLog.length ? kitchenLog.map(k => `
    <div class="item"><div><b>${esc(k.dish_name)}</b> ${k.gujarati ? `<span class="badge">${esc(k.gujarati)}</span>` : ""} <span class="badge">${esc(k.meal_date)}</span><br>
    <span class="muted">${k.servings ? k.servings + " servings • " : ""}${k.total_cost != null ? "$" + Number(k.total_cost).toFixed(2) + " total • $" + Number(k.cost_per_serving || 0).toFixed(2) + "/serving" + (k.cost_estimated ? " (estimated)" : "") + " • " : ""}${k.leftover_note ? "Leftovers: " + esc(k.leftover_note) + " • " : ""}${esc(k.notes || "")}</span></div>
    <div><button class="small" onclick="delKitchen('${k.id}')">Remove</button></div></div>`).join("")
    : "<p class='muted'>No meals logged yet. Log what you cook, and it will show here and on Home.</p>";
}
async function logMeal(dish, gujarati, servings, notes) {
  const row = { meal_date: $("kitchenDate")?.value || today(), dish_name: dish, gujarati: gujarati || null, servings: servings || null, cooked_by: user?.phone || user?.name || "family", notes: notes || null };
  if (demoMode) { row.id = "log-" + Date.now(); kitchenLog.unshift(row); saveLocal(); }
  else {
    const res = await sb.from("kitchen_log").insert(row).select().single();
    if (res.error) return alert("Meal could not be logged yet (kitchen log table may not be created in Supabase yet): " + res.error.message);
    await loadCloud();
  }
  renderKitchen();
}
function logMealFromRecipe(id) {
  const r = recipes.find(x => String(x.id) === String(id)); if (!r) return;
  show("kitchen");
  if ($("kitchenRecipe")) $("kitchenRecipe").value = String(id);
  prefillMealFromRecipe();
}
async function delKitchen(id) {
  if (demoMode) { kitchenLog = kitchenLog.filter(k => String(k.id) !== String(id)); saveLocal(); }
  else if (currentHousehold) { const res = await sb.from("meals_cooked").delete().eq("id", id); if (res.error) return alert(res.error.message); await loadMeals(); }
  else { const res = await sb.from("kitchen_log").delete().eq("id", id); if (res.error) return alert(res.error.message); await loadCloud(); }
  renderKitchen();
}

// ---- Ghar Pantry Phase 5: Kitchen Log + cost per meal ----
let mealIngs = [], mealBaseServings = 4;
function findInvByName(name) {
  const n = name.toLowerCase().trim();
  return inventoryItems.find(i => i.name.toLowerCase() === n) || inventoryItems.find(i => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase())) || null;
}
function renderMealIngTable() {
  if (!$("mealIngTable")) return;
  if (!mealIngs.length) { $("mealIngTable").innerHTML = "<p class='muted'>No ingredients yet. Pick a recipe, or add a row.</p>"; return; }
  let total = 0, estimated = false;
  const rows = mealIngs.map((r, i) => {
    const inv = findInvByName(r.name);
    const costPer = inv && inv.cost_per_unit != null ? Number(inv.cost_per_unit) : (r.costPer != null ? Number(r.costPer) : null);
    const cost = costPer != null ? Number(r.amount) * costPer : null;
    if (cost == null) estimated = true; else total += cost;
    return `<tr><td><input value="${esc(r.name)}" onchange="mealIngs[${i}].name=this.value; renderMealIngTable()"></td><td><input type="number" step="0.01" value="${r.amount}" onchange="mealIngs[${i}].amount=this.value; renderMealIngTable()"></td><td>${esc(r.unit || "pcs")}</td><td>${inv ? esc(inv.name) + " — stock " + invDisplay(inv) + (inv.cost_per_unit != null ? " • $" + inv.cost_per_unit + "/" + inv.unit : " • no price") : "Not in pantry"}</td><td>${cost != null ? "$" + cost.toFixed(2) : "estimated"}</td><td><button class="small" onclick="mealIngs.splice(${i},1); renderMealIngTable()">Remove</button></td></tr>`;
  }).join("");
  $("mealIngTable").innerHTML = `<table><tr><th>Ingredient</th><th>Amount</th><th>Unit</th><th>Pantry match</th><th>Cost</th><th></th></tr>${rows}</table><p class="muted">Meal cost: $${total.toFixed(2)}${estimated ? " (estimated — some items have no price)" : ""} • Per serving: $${(Number($("kServings")?.value) || 1) ? (total / (Number($("kServings")?.value) || 1)).toFixed(2) : "0.00"}</p>`;
}
function addMealIngRow() { mealIngs.push({ name: "", amount: 1, unit: "pcs", costPer: null }); renderMealIngTable(); }
async function prefillMealFromRecipe() {
  const id = $("kitchenRecipe")?.value; if (!id) return;
  const r = recipes.find(x => String(x.id) === String(id)); if (!r) return;
  if ($("kDish")) $("kDish").value = r.name;
  if ($("kMealType")) $("kMealType").value = r.meal_type || r.category || "Main";
  mealBaseServings = 4;
  let ings = [];
  if (r._ings) ings = r._ings;
  else if (currentHousehold && !r.seeded) {
    const { data } = await sb.from("recipe_ingredients").select("*").eq("recipe_id", id);
    ings = (data || []).map(x => ({ name: x.ingredient_name, amount: x.amount, unit: x.unit }));
    if (!ings.length && r.ingredients) ings = (Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients).split(",")).map(s => ({ name: s.trim(), amount: null, unit: "pcs" }));
  } else if (r.ingredients) {
    ings = (Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients).split(",")).map(s => ({ name: String(s).trim(), amount: null, unit: "pcs" }));
  }
  const servings = Number($("kServings")?.value) || 4;
  mealIngs = ings.map(i => ({ name: i.name, amount: i.amount != null ? i.amount * servings / mealBaseServings : 1, unit: i.unit || "pcs", costPer: null }));
  renderMealIngTable();
}
function rescaleMealIngredients() {
  // Scaling is applied at prefill; if the user changes servings after
  // editing amounts, leave their edited amounts alone (safer than
  // silently rescaling) and just refresh the per-serving cost.
  renderMealIngTable();
}
async function loadMeals() {
  if (!currentHousehold) return;
  const { data, error } = await sb.from("meals_cooked").select("*").eq("household_id", currentHousehold.id).order("meal_date", { ascending: false }).limit(50);
  if (!error && data) {
    kitchenLog = data;
    renderKitchen();
  }
}
let mealLogging = false;
async function logMealWithDeductions() {
  if (mealLogging) return;
  if (!currentHousehold) return alert("Create or join a household first — pantry deductions and meal costs need a household pantry.");
  mealLogging = true;
  try { await logMealWithDeductionsInner(); } catch (e) { alert("Meal could not be logged: " + (e.message || e)); } finally { mealLogging = false; }
}
async function logMealWithDeductionsInner() {
  const dish = $("kDish")?.value.trim() || $("kitchenRecipe")?.selectedOptions[0]?.textContent || "Custom dish";
  const servings = Number($("kServings")?.value) || 1;
  const recipeId = $("kitchenRecipe")?.value || null;
  let total = 0, estimated = false;
  const used = [];
  for (const r of mealIngs) {
    if (!r.name || !Number(r.amount)) continue;
    const inv = findInvByName(r.name);
    let cost = null;
    if (inv && inv.cost_per_unit != null) cost = Number(r.amount) * Number(inv.cost_per_unit);
    else if (r.costPer != null) cost = Number(r.amount) * Number(r.costPer);
    else estimated = true;
    if (cost != null) total += cost;
    used.push({ name: r.name, amount: Number(r.amount), unit: r.unit || "pcs", inv, cost });
  }
  const perServing = servings ? total / servings : total;
  const userId = (await sb.auth.getUser()).data.user?.id || null;
  // v20 bug fix: without .select() Supabase returns res.data = null,
  // so reading res.data.id threw and deductions never ran, while the
  // meal row was already inserted (so repeat clicks duplicated meals).
  const res = await sb.from("meals_cooked").insert({ household_id: currentHousehold.id, recipe_id: recipeId && !String(recipeId).startsWith("seed-") ? recipeId : null, dish_name: dish, gujarati: null, meal_type: $("kMealType")?.value || "Main", servings, cooked_by: userId, meal_date: $("kitchenDate")?.value || today(), total_cost: total, cost_per_serving: perServing, cost_estimated: estimated, leftover_note: $("kLeftovers")?.value || null }).select().single();
  if (res.error) return alert("Meal could not be logged: " + res.error.message);
  const mealId = res.data.id;
  for (const u of used) {
    await sb.from("meal_ingredients_used").insert({ meal_id: mealId, inventory_id: u.inv?.id || null, ingredient_name: u.name, amount: u.amount, unit: u.unit, cost: u.cost });
    if (u.inv) {
      if (u.inv.tracking_type === "level") {
        const steps = ["full", "half", "low", "empty"]; const idx = steps.indexOf(u.inv.level || "full");
        const next = steps[Math.min(idx + Math.max(1, Math.floor(u.amount)), 3)];
        await sb.from("inventory").update({ level: next }).eq("id", u.inv.id);
        await logInvEvent(u.inv.id, "used", -1, "Meal: " + dish);
      } else {
        const newQty = Math.max(0, Number(u.inv.quantity) - u.amount);
        await sb.from("inventory").update({ quantity: newQty }).eq("id", u.inv.id);
        await logInvEvent(u.inv.id, "used", -u.amount, "Meal: " + dish);
      }
    }
  }
  await loadInventory(); await loadMeals();
  alert(`Meal logged: ${dish} — $${total.toFixed(2)} total, $${perServing.toFixed(2)} per serving${estimated ? " (estimated)" : ""}. Pantry deducted.`);
  mealIngs = []; renderMealIngTable(); show("kitchen");
}

// ---- Phase 3: What To Cook ----
function pantryStockList() { return currentHousehold ? inventoryItems : pantry; }
function pantryFind(ingredient) {
  const needle = ingredient.toLowerCase().trim();
  return pantryStockList().find(p => {
    const n = p.name.toLowerCase();
    return n === needle || n.includes(needle) || needle.includes(n);
  }) || null;
}
function pantryHas(ingredient) {
  const item = pantryFind(ingredient);
  if (!item) return false;
  if (item.level) return item.level !== "empty";
  return Number(item.quantity || 0) > 0;
}
function pantryExpiringSoon(ingredient) {
  const item = pantryFind(ingredient);
  if (!item || !item.expiry_date) return false;
  const d = daysUntil(item.expiry_date); return d !== null && d <= 7;
}
// ---- Ghar Pantry Phase 6: What to Cook ----
let jainSettings = { no_root: true, fresh_ginger_allowed: false, dry_ginger_allowed: false, no_honey: true, no_eggs_meat: true, exclude_brinjal: false, exclude_mushrooms: false, exclude_fermented: false, paryushan_mode: false };
const ROOT_WORDS = ["onion", "garlic", "potato", "carrot", "beetroot", "radish", "turnip", "sweet potato"];
const GREEN_WORDS = ["spinach", "palak", "fenugreek", "methi", "green bean", "green pea", "broccoli", "kale", "lettuce", "cabbage", "bottle gourd", "ivy gourd", "okra"];
const FERMENTED_WORDS = ["yogurt", "curd", "vinegar", "soy sauce"];
async function loadJainSettings() {
  if (!currentHousehold) return;
  const { data } = await sb.from("dietary_settings").select("*").eq("household_id", currentHousehold.id).is("user_id", null).limit(1);
  if (data && data.length) jainSettings = { ...jainSettings, ...data[0] };
  renderJainSettings();
}
function renderJainSettings() {
  const ids = { jNoRoot: "no_root", jFreshGinger: "fresh_ginger_allowed", jDryGinger: "dry_ginger_allowed", jNoHoney: "no_honey", jNoEggs: "no_eggs_meat", jBrinjal: "exclude_brinjal", jMushroom: "exclude_mushrooms", jFermented: "exclude_fermented", jParyushan: "paryushan_mode" };
  for (const [id, key] of Object.entries(ids)) if ($(id)) $(id).checked = !!jainSettings[key];
}
async function saveJainSettings() {
  if (!currentHousehold) { alert("Create or join a household first — Jain settings are saved per household."); return; }
  const s = { household_id: currentHousehold.id, user_id: null, no_root: $("jNoRoot")?.checked || false, fresh_ginger_allowed: $("jFreshGinger")?.checked || false, dry_ginger_allowed: $("jDryGinger")?.checked || false, no_honey: $("jNoHoney")?.checked || false, no_eggs_meat: $("jNoEggs")?.checked || false, exclude_brinjal: $("jBrinjal")?.checked || false, exclude_mushrooms: $("jMushroom")?.checked || false, exclude_fermented: $("jFermented")?.checked || false, paryushan_mode: $("jParyushan")?.checked || false };
  const res = await sb.from("dietary_settings").upsert(s, { onConflict: "household_id,user_id" });
  if (res.error) return alert("Settings could not be saved: " + res.error.message);
  jainSettings = { ...jainSettings, ...s }; renderCook(); alert("Jain settings saved — suggestions below follow them.");
}
function jainViolation(ingredient) {
  const n = ingredient.toLowerCase();
  const s = jainSettings;
  if (s.no_root && ROOT_WORDS.some(w => n.includes(w))) return "root vegetable";
  if (n.includes("ginger")) {
    if (n.includes("dry")) { if (!s.dry_ginger_allowed) return "dry ginger (not allowed in settings)"; }
    else if (!s.fresh_ginger_allowed) return "fresh ginger (not allowed in settings)";
  }
  if (s.no_honey && n.includes("honey")) return "honey";
  if (s.no_eggs_meat && /(egg|chicken|meat|fish|mutton|pork|beef)/.test(n)) return "egg/meat";
  if (s.exclude_brinjal && /(brinjal|eggplant)/.test(n)) return "brinjal";
  if (s.exclude_mushrooms && n.includes("mushroom")) return "mushrooms";
  if ((s.exclude_fermented || s.paryushan_mode) && FERMENTED_WORDS.some(w => n.includes(w))) return "fermented food";
  return null;
}
function isGreenRecipe(r, ings) {
  if (r.green_veg) return true;
  return ings.some(i => GREEN_WORDS.some(w => String(i).toLowerCase().includes(w)));
}
function cookAnalysis() {
  const tithiOn = tithiToday || jainSettings.paryushan_mode;
  let pool = recipes, excluded = 0, excludedReasons = [];
  const filtered = [];
  for (const r of recipes) {
    const ings = Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients || "").split(",").map(s => s.trim()).filter(Boolean);
    const bad = ings.map(jainViolation).filter(Boolean);
    if (bad.length) { excluded++; excludedReasons.push(`${r.name} (${[...new Set(bad)].join(", ")})`); continue; }
    if (tithiOn && isGreenRecipe(r, ings)) { excluded++; excludedReasons.push(`${r.name} (green vegetables, tithi/Paryushan)`); continue; }
    filtered.push(r);
  }
  const onlyHave = $("cookOnlyHave")?.checked || false;
  const scored = filtered.map(r => {
    const ingsAmt = r._ings && r._ings.length ? r._ings : (Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients || "").split(",").map(s => s.trim()).filter(Boolean)).map(name => ({ name, amount: null, unit: "pcs" }));
    const have = [], needMore = [], needToBuy = [];
    for (const ing of ingsAmt) {
      const item = pantryFind(ing.name);
      const stock = item ? (item.level ? (item.level === "empty" ? 0 : 1) : Number(item.quantity || 0)) : 0;
      if (!item || stock <= 0) needToBuy.push(ing);
      else if (ing.amount != null && stock < Number(ing.amount)) needMore.push({ ...ing, shortfall: Number(ing.amount) - stock, stock });
      else have.push(ing);
    }
    const expiring = have.filter(h => pantryExpiringSoon(h.name)).length;
    return { r, have, needMore, needToBuy, missing: [...needMore.map(x => x.name), ...needToBuy.map(x => x.name)], expiring, score: needToBuy.length * 10 + needMore.length * 5 - expiring };
  }).filter(a => !onlyHave || (a.needToBuy.length === 0 && a.needMore.length === 0))
    .sort((a, b) => a.score - b.score || a.needToBuy.length - b.needToBuy.length || a.r.name.localeCompare(b.r.name));
  return { scored, excluded, excludedReasons };
}
function renderCook() {
  if (!$("cookList")) return;
  if ($("tithiToggle")) $("tithiToggle").checked = tithiToday;
  const { scored, excluded, excludedReasons } = cookAnalysis();
  const fmt = (list) => list.length ? list.map(x => typeof x === "string" ? esc(x) : `${esc(x.name)}${x.amount != null ? ` (${x.amount} ${esc(x.unit || "pcs")}${x.shortfall != null ? `, short ${x.shortfall} ${esc(x.unit || "pcs")}` : ""})` : ""}`).join(", ") : "—";
  const card = (a) => `
    <div class="item"><div><b>${esc(a.r.name)}</b> ${a.r.gujarati ? `<span class="badge">${esc(a.r.gujarati)}</span>` : ""} ${a.needToBuy.length === 0 && a.needMore.length === 0 ? `<span class="badge">Can make now</span>` : `<span class="badge">${a.needToBuy.length + a.needMore.length} to get</span>`}<br>
    <span class="muted">Have: ${fmt(a.have)}</span><br>
    <span class="muted">Need more: ${fmt(a.needMore)}</span><br>
    <span class="muted">Need to buy: ${fmt(a.needToBuy)}</span>${a.expiring ? `<br><span class="muted">Uses expiring-soon pantry items first.</span>` : ""}</div>
    <div><button class="small" onclick="addMissingToShopping('${a.r.id}')">Add missing to shopping</button>
    <button class="small" onclick="logMealFromRecipe('${a.r.id}')">Cook this</button></div></div>`;
  $("cookList").innerHTML = `<p class="muted">Suggestions are double-checked against your Jain settings above${tithiToday || jainSettings.paryushan_mode ? " and tithi/Paryushan mode" : ""} — ${excluded} recipe(s) hidden${excluded ? ": " + esc(excludedReasons.slice(0, 5).join("; ")) + (excludedReasons.length > 5 ? "…" : "") : ""}.</p>` +
    (scored.length ? scored.map(card).join("") : "<p class='muted'>No recipes match right now. Try turning off 'Cook with what I have', or add pantry items and recipes first.</p>");
  renderPlanner(); renderTithiList();
}
async function setTithi(on) {
  tithiToday = !!on;
  if (demoMode) { localStorage.setItem("ha_tithi_" + today(), tithiToday ? "1" : "0"); }
  else if (currentHousehold) {
    const res = await sb.from("tithi_days").upsert({ household_id: currentHousehold.id, day: today(), is_tithi: tithiToday }, { onConflict: "household_id,day" });
    if (res.error) localStorage.setItem("ha_tithi_" + today(), tithiToday ? "1" : "0");
  } else localStorage.setItem("ha_tithi_" + today(), tithiToday ? "1" : "0");
  renderCook(); renderDashboard();
}
async function loadTithiToday() {
  if (!currentHousehold) { tithiToday = localStorage.getItem("ha_tithi_" + today()) === "1"; return; }
  const { data } = await sb.from("tithi_days").select("*").eq("household_id", currentHousehold.id).eq("day", today()).limit(1);
  tithiToday = !!(data && data.length && data[0].is_tithi);
}
async function addTithiDay() {
  const d = $("tithiDate")?.value; if (!d) return alert("Pick a date first.");
  if (!currentHousehold) { localStorage.setItem("ha_tithi_" + d, "1"); renderTithiList(); return; }
  const res = await sb.from("tithi_days").upsert({ household_id: currentHousehold.id, day: d, is_tithi: true, note: $("tithiNote")?.value || null }, { onConflict: "household_id,day" });
  if (res.error) return alert(res.error.message);
  renderTithiList(); alert("Tithi day added: " + d);
}
async function renderTithiList() {
  if (!$("tithiList")) return;
  if (!currentHousehold) { $("tithiList").innerHTML = "<p class='muted'>Tithi days for a household are shown here once you create or join one. Today's toggle above still works locally.</p>"; return; }
  const { data } = await sb.from("tithi_days").select("*").eq("household_id", currentHousehold.id).eq("is_tithi", true).order("day");
  const list = (data || []).filter(x => x.day >= today()).slice(0, 10);
  $("tithiList").innerHTML = list.length ? list.map(x => `<div class="item"><div><b>${esc(x.day)}</b> ${x.note ? esc(x.note) : ""}</div><div><button class="small" onclick="removeTithiDay('${x.day}')">Remove</button></div></div>`).join("") : "<p class='muted'>No upcoming tithi days saved yet.</p>";
}
async function removeTithiDay(d) {
  if (!currentHousehold) { localStorage.removeItem("ha_tithi_" + d); renderTithiList(); return; }
  await sb.from("tithi_days").delete().eq("household_id", currentHousehold.id).eq("day", d);
  renderTithiList();
}
function plannerKey() { return "ha_planner_" + (currentHousehold ? currentHousehold.id : "local"); }
function plannerWeekStart() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); }
function renderPlanner() {
  if (!$("plannerTable")) return;
  const start = plannerWeekStart();
  const plan = JSON.parse(localStorage.getItem(plannerKey()) || "{}");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  $("plannerTable").innerHTML = `<p class="muted">Week starting ${start}. Pick a dish per day, then "Cook this" opens it in Kitchen Log with its deductions.</p>` + days.map((dn, i) => {
    const dt = new Date(start); dt.setDate(dt.getDate() + i); const ds = dt.toISOString().slice(0, 10);
    const sel = plan[ds] || "";
    const opts = `<option value="">— pick —</option>` + recipes.map(r => `<option value="${r.id}" ${String(sel) === String(r.id) ? "selected" : ""}>${esc(r.name)}</option>`).join("");
    return `<div class="item"><div><b>${dn} ${ds}</b></div><div><select onchange="savePlannerDay('${ds}', this.value)">${opts}</select> ${sel ? `<button class="small" onclick="logMealFromRecipe('${sel}')">Cook this</button>` : ""}</div></div>`;
  }).join("");
}
function savePlannerDay(date, recipeId) {
  const plan = JSON.parse(localStorage.getItem(plannerKey()) || "{}");
  if (recipeId) plan[date] = recipeId; else delete plan[date];
  localStorage.setItem(plannerKey(), JSON.stringify(plan)); renderPlanner();
}
async function addPlannerMissingToShopping() {
  const plan = JSON.parse(localStorage.getItem(plannerKey()) || "{}");
  const ids = Object.values(plan);
  if (!ids.length) return alert("Planner is empty — pick dishes first.");
  let added = 0;
  for (const id of ids) {
    const a = cookAnalysis().scored.find(x => String(x.r.id) === String(id));
    if (!a) continue;
    for (const ing of [...a.needMore, ...a.needToBuy]) {
      const qty = ing.shortfall != null ? Math.ceil(ing.shortfall) : 1;
      if (shopping.some(s => s.name.toLowerCase() === ing.name.toLowerCase() && !s.checked)) continue;
      const row = { name: ing.name, quantity: qty, unit: ing.unit || "pcs", category: "Other", added_by: user?.phone || "family" };
      if (demoMode) { row.id = Date.now().toString() + Math.random(); shopping.push(row); added++; }
      else { const res = await sb.from("shopping_items").insert(row); if (!res.error) added++; }
    }
  }
  if (demoMode) saveLocal(); else await loadCloud();
  alert(added ? `Added ${added} missing item(s) from the weekly planner to shopping.` : "Planner missing items were already on your shopping list.");
}
async function addMissingToShopping(recipeId) {
  const a = cookAnalysis().scored.find(x => String(x.r.id) === String(recipeId));
  if (!a || (a.needMore.length === 0 && a.needToBuy.length === 0)) { alert(a ? "Nothing missing for this recipe." : "Recipe not found."); return; }
  let added = 0;
  for (const ing of [...a.needMore, ...a.needToBuy]) {
    const qty = ing.shortfall != null ? Math.ceil(ing.shortfall) : 1;
    if (shopping.some(s => s.name.toLowerCase() === ing.name.toLowerCase() && !s.checked)) continue;
    const row = { name: ing.name, quantity: qty, unit: ing.unit || "pcs", category: "Other", added_by: user?.phone || "family" };
    if (demoMode) { row.id = Date.now().toString() + Math.random(); shopping.push(row); added++; }
    else { const res = await sb.from("shopping_items").insert(row); if (!res.error) added++; else { alert(res.error.message); return; } }
  }
  if (demoMode) saveLocal(); else await loadCloud();
  renderCook();
  alert(added ? `Added ${added} missing item(s) to shopping.` : "Missing items were already on your shopping list.");
}

// ---- Ghar Pantry Phase 3: Receipts ----
// AI API note: a true AI API needs a key stored server-side (Supabase
// Edge Function), which is NOT configured yet. Phase 3 therefore uses
// on-device OCR (Tesseract/PDF.js, already in the app) + a local
// abbreviation/alias parser as the free interim reader. The review,
// alias-matching, and one-transaction save below are the same either
// way, and the OCR step can be swapped for an AI endpoint later
// without changing the review/save flow. Do NOT claim AI reading
// until that endpoint is configured.
let receiptReview = [], receiptStoragePath = null, receiptStore = "", receiptDate = "";
const ABBR = { ORG: "Organic", BNNA: "Bananas", GV: "Great Value", WHL: "Whole", MLK: "Milk", BRD: "Bread", EGGS: "Eggs", CHKN: "Chicken", TOM: "Tomato", POT: "Potato", ONN: "Onion" };
function guessCategory(name) {
  const n = name.toLowerCase();
  if (/milk|yogurt|paneer|cheese|cream|butter|ghee/.test(n)) return "Dairy";
  if (/dal|lentil|chickpea|bean/.test(n)) return "Dal and Pulses";
  if (/rice/.test(n)) return "Rice";
  if (/flour|atta|besan/.test(n)) return "Atta and Flour";
  if (/banana|apple|mango|fruit/.test(n)) return "Fruits";
  if (/tomato|spinach|potato|vegetable|gourd/.test(n)) return "Vegetables";
  if (/oil/.test(n)) return "Oil and Ghee";
  return "Other";
}
function parseReceiptText(text) {
  // Same smart parser as the old receipt screen: wrapped lines joined,
  // price-only lines attached to the item above, "N x" as quantity.
  return parseSmartReceipt(text).filter(r => r.total != null && r.total > 0).map(r => {
    const clean = r.name.split(/\s+/).map(w => ABBR[w.toUpperCase()] || w).join(" ").replace(/\b\w/g, c => c.toUpperCase());
    return { raw_text: r.name, clean_name: clean, quantity: r.qty, unit: r.unit, unit_price: r.unit_price != null ? r.unit_price : r.total, total: r.total, category: guessCategory(clean), include: true };
  });
}
function updateReceiptTotals() {
  receiptReview.forEach((r, i) => { const el = $(`rt-${i}`); if (el) el.textContent = (Number(r.quantity) * Number(r.unit_price)).toFixed(2); });
  const el = $("receiptCheckedTotal"); if (el) el.textContent = receiptReview.filter(r => r.include).reduce((s, r) => s + Number(r.quantity) * Number(r.unit_price), 0).toFixed(2);
}
function loadSampleReceipt() {
  receiptReview = parseReceiptText("ORG BNNA 1.29\nGV WHL MLK 3.49\nTOOR DAL 2 KG 4.99\nTOTAL 9.77");
  receiptStore = "Sample Store"; receiptDate = today();
  if ($("rStore")) $("rStore").value = receiptStore;
  if ($("rDate")) $("rDate").value = receiptDate;
  renderReceiptReview();
}
async function handlePhase3Receipt(file) {
  if (!file) return;
  if (!currentHousehold) return alert("Create or join a household first.");
  $("receipt3Status").textContent = "Uploading and reading receipt…";
  try {
    const path = `${currentHousehold.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await sb.storage.from("receipts").upload(path, file);
    if (up.error) { $("receipt3Status").textContent = "Storage upload failed (receipts bucket may not exist yet): " + up.error.message + " — you can still use the sample receipt or OCR below."; }
    else { receiptStoragePath = path; $("receipt3Status").textContent = "Saved to Storage: " + path + ". Reading…"; }
  } catch (e) { $("receipt3Status").textContent = "Storage upload failed: " + e.message; }
  let text = "";
  try {
    if (file.type === "application/pdf") {
      const buf = await file.arrayBuffer(); const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      for (let p = 1; p <= pdf.numPages; p++) { const page = await pdf.getPage(p); const c = await page.getTextContent(); text += c.items.map(x => x.str).join(" ") + "\n"; }
    } else {
      const r = await Tesseract.recognize(file, "eng"); text = r.data.text;
    }
  } catch (e) { $("receipt3Status").textContent = "Could not read this file automatically. Fix the sample below, or try a clearer photo."; return; }
  receiptReview = parseReceiptText(text);
  receiptStore = $("rStore")?.value || ""; receiptDate = $("rDate")?.value || today();
  $("receipt3Status").textContent = `Found ${receiptReview.length} possible items. Fix them below, then save. Nothing is saved until you press Save receipt.`;
  renderReceiptReview();
}
function renderReceiptReview() {
  if (!$("receipt3Table")) return;
  $("receipt3Table").innerHTML = receiptReview.length ? "<table><tr><th>Use</th><th>Raw</th><th>Clean name</th><th>Qty</th><th>Unit</th><th>Unit price ($)</th><th>Total ($)</th></tr>" +
    receiptReview.map((r, i) => `<tr><td><input type="checkbox" ${r.include ? "checked" : ""} onchange="receiptReview[${i}].include=this.checked; updateReceiptTotals()"></td><td>${esc(r.raw_text)}</td><td><input value="${esc(r.clean_name)}" onchange="receiptReview[${i}].clean_name=this.value"></td><td><input type="number" step="0.01" value="${r.quantity}" onchange="receiptReview[${i}].quantity=this.value; updateReceiptTotals()"></td><td>${esc(r.unit || "pcs")}</td><td><input type="number" step="0.01" value="${r.unit_price}" onchange="receiptReview[${i}].unit_price=this.value; updateReceiptTotals()"></td><td id="rt-${i}">${(Number(r.quantity) * Number(r.unit_price)).toFixed(2)}</td></tr>`).join("") + "</table>" +
    `<p class="muted">Total of checked items: $<span id="receiptCheckedTotal">${receiptReview.filter(r => r.include).reduce((s, r) => s + Number(r.quantity) * Number(r.unit_price), 0).toFixed(2)}</span></p>` : "<p class='muted'>No receipt items yet. Upload a receipt, or load the sample messy receipt.</p>";
}
async function savePhase3Receipt() {
  if (!currentHousehold) return alert("Create or join a household first.");
  const items = receiptReview.filter(r => r.include && r.clean_name).map(r => ({ raw_text: r.raw_text, clean_name: r.clean_name, quantity: Number(r.quantity) || 1, unit: r.unit || "pcs", unit_price: Number(r.unit_price) || 0, total: (Number(r.quantity) || 1) * (Number(r.unit_price) || 0), category: guessCategory(r.clean_name) }));
  if (!items.length) return alert("No items checked to save.");
  const total = items.reduce((s, i) => s + i.total, 0);
  const store = $("rStore")?.value || receiptStore || "Store";
  const date = $("rDate")?.value || today();
  if (demoMode) { alert("Demo mode: receipt would be saved via process_receipt in live mode."); return; }
  const res = await sb.rpc("process_receipt", { p_household_id: currentHousehold.id, p_store_name: store, p_receipt_date: date, p_total: total, p_tax: null, p_discount: null, p_storage_path: receiptStoragePath, p_items: items });
  if (res.error) return alert("Receipt save failed (transaction rolled back, nothing saved): " + res.error.message);
  alert(`Receipt saved. Receipt ID: ${res.data}. Inventory, expense, and aliases updated in one transaction.`);
  receiptReview = []; receiptStoragePath = null; renderReceiptReview(); await loadInventory();
}

// ---- Ghar Pantry Phase 4: Budget ----
function weekBounds(d) { const dt = new Date(d); const day = (dt.getDay() + 6) % 7; const s = new Date(dt); s.setDate(dt.getDate() - day); const e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; }
function iso(d) { return d.toISOString().slice(0, 10); }
async function saveBudget() {
  if (!currentHousehold) return alert("Create or join a household first.");
  const period = $("bPeriod").value, category = $("bCat").value || null, limit = Number($("bLimit").value);
  if (!limit || limit <= 0) return alert("Enter a limit amount.");
  if (demoMode) return alert("Demo mode: budget would be saved live in the app.");
  const { data: old } = await sb.from("budgets").select("id,category").eq("household_id", currentHousehold.id).eq("period", period);
  for (const o of (old || [])) if ((o.category || null) === category) await sb.from("budgets").delete().eq("id", o.id);
  const res = await sb.from("budgets").insert({ household_id: currentHousehold.id, period, category, limit_amount: limit, week_start_day: $("bWeek").value, rollover: $("bRollover").checked });
  if (res.error) return alert("Budget save failed: " + res.error.message);
  alert("Budget saved."); await loadBudget();
}
async function saveExpense() {
  if (!currentHousehold) return alert("Create or join a household first.");
  const amt = Number($("eAmt").value);
  if (!amt || amt <= 0) return alert("Enter an amount.");
  if (demoMode) return alert("Demo mode: expense would be saved live in the app.");
  const res = await sb.from("expenses").insert({ household_id: currentHousehold.id, amount: amt, category: $("exCat").value, store_name: $("eStore").value || null, expense_date: $("eDate").value || today(), note: $("eNote").value || null, paid_by: (await sb.auth.getUser()).data.user?.id });
  if (res.error) return alert("Expense save failed: " + res.error.message);
  alert("Expense saved. Budget alerts are checked automatically on save."); await loadBudget();
}
async function loadBudget() {
  if (!$("budgetDash") || !currentHousehold) return;
  const { data: budgets } = await sb.from("budgets").select("*").eq("household_id", currentHousehold.id);
  const { data: expenses } = await sb.from("expenses").select("*").eq("household_id", currentHousehold.id).order("expense_date", { ascending: false });
  const { data: notes } = await sb.from("notifications").select("*").eq("household_id", currentHousehold.id).order("created_at", { ascending: false }).limit(20);
  const [ws, we] = weekBounds(new Date()); const [lws, lwe] = weekBounds(new Date(Date.now() - 7 * 86400000));
  const inRange = (e, s, e2) => e.expense_date >= iso(s) && e.expense_date <= iso(e2);
  const sum = arr => arr.reduce((s, e) => s + Number(e.amount), 0);
  const thisW = sum(expenses.filter(e => inRange(e, ws, we))), lastW = sum(expenses.filter(e => inRange(e, lws, lwe)));
  const byCat = {}, byStore = {}, byPerson = {};
  expenses.filter(e => inRange(e, ws, we)).forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); byStore[e.store_name || "No store"] = (byStore[e.store_name || "No store"] || 0) + Number(e.amount); byPerson[(e.paid_by || "unknown").slice(0, 8)] = (byPerson[(e.paid_by || "unknown").slice(0, 8)] || 0) + Number(e.amount); });
  const bars = (budgets || []).map(b => {
    const total = b.period === "weekly" ? sum(expenses.filter(e => inRange(e, ws, we) && (!b.category || e.category === b.category))) : sum(expenses.filter(e => e.expense_date.slice(0, 7) === today().slice(0, 7) && (!b.category || e.category === b.category)));
    const pct = Math.min(100, Math.round(total / Number(b.limit_amount) * 100));
    return `<div class="card"><b>${b.period} ${b.category || "overall"}</b>: $${total.toFixed(2)} / $${Number(b.limit_amount).toFixed(2)} (${pct}%)<div style="background:#e5e5ea;border-radius:8px;height:16px"><div style="background:${pct >= 100 ? "#ff3b30" : pct >= 80 ? "#ff9500" : "#0071e3"};width:${pct}%;height:16px;border-radius:8px"></div></div>${pct >= 100 ? "<p>Over budget.</p>" : pct >= 80 ? "<p>80% reached.</p>" : pct >= 50 ? "<p>50% reached.</p>" : ""}</div>`;
  }).join("");
  const under = (new Date().getDay() === 0 && (budgets || []).some(b => b.period === "weekly" && thisW < Number(b.limit_amount))) ? "<div class='card'><p>Under budget this week — well done.</p></div>" : "";
  $("budgetDash").innerHTML = `<div class="card"><b>This week (${iso(ws)} to ${iso(we)}): $${thisW.toFixed(2)}</b> • Last week: $${lastW.toFixed(2)}</div>${bars}${under}<div class="card"><h3>This week by category</h3>${Object.entries(byCat).map(([k, v]) => `<div>${esc(k)}: $${v.toFixed(2)}</div>`).join("") || "<p class='muted'>No expenses this week yet.</p>"}<h3>By store</h3>${Object.entries(byStore).map(([k, v]) => `<div>${esc(k)}: $${v.toFixed(2)}</div>`).join("")}<h3>By person (ID prefix)</h3>${Object.entries(byPerson).map(([k, v]) => `<div>${esc(k)}: $${v.toFixed(2)}</div>`).join("")}</div>`;
  if (currentHousehold) {
    const { data: meals } = await sb.from("meals_cooked").select("*").eq("household_id", currentHousehold.id);
    const weekMeals = (meals || []).filter(m => m.meal_date >= iso(ws) && m.meal_date <= iso(we));
    const avg = weekMeals.length ? weekMeals.reduce((s, m) => s + Number(m.total_cost || 0), 0) / weekMeals.length : 0;
    const counts = {}; (meals || []).forEach(m => counts[m.dish_name] = (counts[m.dish_name] || 0) + 1);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(k)} (${v}x)`).join(", ") || "None yet";
    $("budgetDash").innerHTML += `<div class="card"><h3>Meals this week</h3><div>Average meal cost: $${avg.toFixed(2)} (${weekMeals.length} meal(s))</div><div>Most cooked dishes: ${top}</div></div>`;
  }
  $("budgetAlerts").innerHTML = `<div class="card"><h3>Budget alerts (in-app)</h3>${(notes || []).length ? notes.map(n => `<div>${esc(n.type || "")}: ${esc(n.message)} ${n.is_read ? "" : `<button class="small" onclick="markNoteRead('${n.id}')">Mark read</button>`}</div>`).join("") : "<p class='muted'>No alerts yet. Alerts appear here when a budget crosses 50%, 80%, or 100%, or a pace warning fires.</p>"}</div>`;
}
async function markNoteRead(id) { await sb.from("notifications").update({ is_read: true }).eq("id", id); await loadBudget(); }

// ---- Forms (wired in index.html) ----
document.addEventListener("DOMContentLoaded", init);
