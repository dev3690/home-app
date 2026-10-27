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
  ["dashboard", "pantry", "add", "shopping", "recipes", "kitchen", "cook", "household"].forEach(v => { const el = $(`view-${v}`); if (el) el.classList.toggle("hidden", v !== view); });
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  if (view === "pantry") renderPantry();
  if (view === "shopping") renderShopping();
  if (view === "recipes") renderRecipes();
  if (view === "kitchen") renderKitchen();
  if (view === "cook") renderCook();
  if (view === "household") renderHousehold();
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
      await loadCloud(); await loadHousehold();
      $("who").textContent = currentHousehold ? currentHousehold.name : "Shared household";
      showApp(); show(currentHousehold ? "dashboard" : "household");
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
  await loadCloud(); await loadHousehold(); showApp(); show(currentHousehold ? "dashboard" : "household");
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
  if (demoMode) { row.id = Date.now().toString(); row.created_at = new Date().toISOString(); pantry.push(row); saveLocal(); }
  else {
    const { data, error } = await sb.from("pantry_items").insert(row).select().single();
    if (error) return alert(error.message);
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
    await loadCloud(); return;
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
  $("dashCounts").innerHTML = `<div class="card"><b>${pantry.length}</b> pantry items • <b>${shopping.filter(s => !s.checked).length}</b> items to buy • <b>${shopping.length}</b> shopping items total • <b>${kitchenLog.length}</b> meals logged</div>`;
  if ($("dashRecent")) {
    const recent = kitchenLog.slice(0, 5);
    $("dashRecent").innerHTML = recent.length ? recent.map(k => `<div>${esc(k.dish_name)}${k.gujarati ? " (" + esc(k.gujarati) + ")" : ""} — ${esc(k.meal_date)}</div>`).join("") : "<p class='muted'>No meals logged yet.</p>";
  }
  if ($("dashTithi")) $("dashTithi").textContent = tithiToday ? "Tithi mode is ON today — green-vegetable recipes are hidden in What To Cook." : "Tithi mode is OFF today.";
  if ($("dashTithiToggle")) $("dashTithiToggle").checked = tithiToday;
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
  if (!demoMode) await loadCloud();
  alert("Saved checked receipt items to pantry."); show("pantry");
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
async function addRecipe() {
  const name = $("rName").value.trim(); if (!name) return alert("Enter a dish name.");
  const row = { name, gujarati: $("rGuj").value.trim() || null, category: $("rCat").value || "Main", minutes: Number($("rMin").value) || null, green_veg: $("rGreen").checked, ingredients: $("rIng").value.split(",").map(s => s.trim()).filter(Boolean), steps: $("rSteps").value.trim() || null, seeded: false };
  if (demoMode) { row.id = "custom-" + Date.now(); recipes.push(row); saveLocal(); }
  else {
    const res = await sb.from("recipes").insert(row).select().single();
    if (res.error) return alert("Recipe could not be saved yet (recipe tables may not be created in Supabase yet): " + res.error.message);
    await loadCloud();
  }
  renderRecipes(); show("recipes");
  ["rName", "rGuj", "rIng", "rSteps"].forEach(id => $(id).value = ""); $("rGreen").checked = false;
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
    <span class="muted">${k.servings ? k.servings + " servings • " : ""}${k.cooked_by ? "Cooked by " + esc(k.cooked_by) + " • " : ""}${esc(k.notes || "")}</span></div>
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
  logMeal(r.name, r.gujarati, 4, ""); show("kitchen");
}
async function delKitchen(id) {
  if (demoMode) { kitchenLog = kitchenLog.filter(k => String(k.id) !== String(id)); saveLocal(); }
  else { const res = await sb.from("kitchen_log").delete().eq("id", id); if (res.error) return alert(res.error.message); await loadCloud(); }
  renderKitchen();
}

// ---- Phase 3: What To Cook ----
function pantryHas(ingredient) {
  const needle = ingredient.toLowerCase().trim();
  const item = pantry.find(p => {
    const n = p.name.toLowerCase();
    return n === needle || n.includes(needle) || needle.includes(n);
  });
  if (!item) return false;
  if (item.level) return item.level !== "empty";
  return Number(item.quantity || 0) > 0;
}
function pantryExpiringSoon(ingredient) {
  const needle = ingredient.toLowerCase().trim();
  const item = pantry.find(p => { const n = p.name.toLowerCase(); return n === needle || n.includes(needle) || needle.includes(n); });
  if (!item || !item.expiry_date) return false;
  const d = daysUntil(item.expiry_date); return d !== null && d <= 7;
}
function cookAnalysis() {
  const pool = tithiToday ? recipes.filter(r => !r.green_veg) : recipes;
  const excluded = tithiToday ? recipes.filter(r => r.green_veg).length : 0;
  const scored = pool.map(r => {
    const ings = Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients || "").split(",").map(s => s.trim()).filter(Boolean);
    const have = ings.filter(pantryHas), missing = ings.filter(i => !pantryHas(i));
    const expiring = have.filter(pantryExpiringSoon).length;
    return { r, have, missing, expiring, score: missing.length * 10 - expiring };
  }).sort((a, b) => a.score - b.score || a.missing.length - b.missing.length || a.r.name.localeCompare(b.r.name));
  return { scored, excluded };
}
function renderCook() {
  if (!$("cookList")) return;
  if ($("tithiToggle")) $("tithiToggle").checked = tithiToday;
  const { scored, excluded } = cookAnalysis();
  const card = (a) => `
    <div class="item"><div><b>${esc(a.r.name)}</b> ${a.r.gujarati ? `<span class="badge">${esc(a.r.gujarati)}</span>` : ""} ${a.missing.length === 0 ? `<span class="badge">Can make now</span>` : a.missing.length <= 2 ? `<span class="badge">Almost — ${a.missing.length} missing</span>` : `<span class="badge">${a.missing.length} missing</span>`}<br>
    <span class="muted">Have: ${a.have.join(", ") || "—"}</span><br>
    <span class="muted">Need: ${a.missing.join(", ") || "nothing"}</span>${a.expiring ? `<br><span class="muted">Uses expiring-soon pantry items first.</span>` : ""}</div>
    <div><button class="small" onclick="addMissingToShopping('${a.r.id}')">Add missing to shopping</button>
    <button class="small" onclick="logMealFromRecipe('${a.r.id}')">I cooked this</button></div></div>`;
  $("cookList").innerHTML = (tithiToday ? `<p class="muted">Tithi mode is ON — green-vegetable recipes are hidden (${excluded} hidden). Turn it off to see them again.</p>` : `<p class="muted">Tithi mode is OFF. Turn it on when today is a tithi / special day and green vegetables are avoided.</p>`) +
    (scored.length ? scored.map(card).join("") : "<p class='muted'>No recipes to suggest yet. Add pantry items and recipes first.</p>");
}
async function setTithi(on) {
  tithiToday = !!on;
  if (demoMode) { localStorage.setItem("ha_tithi_" + today(), tithiToday ? "1" : "0"); }
  else {
    const res = await sb.from("tithi_days").upsert({ day: today(), is_tithi: tithiToday });
    if (res.error) localStorage.setItem("ha_tithi_" + today(), tithiToday ? "1" : "0");
  }
  renderCook(); renderDashboard();
}
async function addMissingToShopping(recipeId) {
  const a = cookAnalysis().scored.find(x => String(x.r.id) === String(recipeId));
  if (!a || !a.missing.length) { alert(a ? "Nothing missing for this recipe." : "Recipe not found."); return; }
  let added = 0;
  for (const name of a.missing) {
    if (shopping.some(s => s.name.toLowerCase() === name.toLowerCase() && !s.checked)) continue;
    const row = { name, quantity: 1, unit: "pcs", category: "Other", added_by: user?.phone || "family" };
    if (demoMode) { row.id = Date.now().toString() + Math.random(); shopping.push(row); }
    else { const res = await sb.from("shopping_items").insert(row); if (!res.error) added++; else { alert(res.error.message); return; } }
    if (demoMode) added++;
  }
  if (demoMode) saveLocal(); else await loadCloud();
  renderCook();
  alert(added ? `Added ${added} missing item(s) to shopping.` : "Missing items were already on your shopping list.");
}

// ---- Forms (wired in index.html) ----
document.addEventListener("DOMContentLoaded", init);
