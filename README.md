# Home App — Phase 1 (shared, free cloud)

Phase 1: phone + password login for each family member, one shared household,
pantry (manual / bulk / receipt with review screen), spice-oil-salt levels,
storage Fridge / Freezer / Pantry / Spice Rack (free-text, so new ones can be added),
live shared shopping list, and a home dashboard for low stock, expiring soon,
and not-used-in-10-days items.

Later phases (same data model, no rebuild):
- Phase 2: kitchen log + family recipe book + seeded Jain-friendly library with Gujarati names
- Phase 3: What to Cook suggestions from pantry + expiring soon, Jain filters, tithi days
- Phase 4: budget (USD, week starts Monday) + cost per meal from purchase lots (FIFO)

## Stack — all free tier
- Frontend: this static site (HTML/CSS/JS, no build step)
- Backend / live sync / database: Supabase (Postgres + Auth + Realtime)
- Hosting: Vercel, Netlify, or GitHub Pages — all free for a static site.
  GitHub Pages is simplest if you already use GitHub.

## Setup walkthrough — what you need to do

### 1. Supabase (free)
1. Go to supabase.com and create a free account. Sign in with GitHub is fine.
2. Create a new project (free tier, any region close to US East).
3. Open SQL Editor, paste the whole `supabase-schema.sql` file, Run.
4. Go to Authentication > Settings and turn OFF "Confirm email".
   This is required because login is phone + password, not email.
   No SMS is used, so there is no SMS cost.
5. Go to Project Settings > API and copy: Project URL + anon public key.

### 2. Put the keys in the app — safely
- Do NOT paste keys in chat. Copy `config.example.js` to `config.js`
  and fill in your Project URL + anon key there.
- The anon key is designed to be public in a web app, but row-level
  security in the schema still requires a logged-in user.
- If you publish the code to a public GitHub repo, keep `config.js`
  out of the repo, or use Vercel/Netlify environment-style hosting
  where the config is added at deploy time. I can help with that step.

### 3. Host it (free)
Option A — Vercel: import this folder/repo, deploy, open the link on any phone.
Option B — Netlify Drop: drag this folder onto Netlify Drop.
Option C — GitHub Pages: push this folder to a repo, enable Pages.
Then open the link on each family member's phone, tap Create account,
enter phone + name + password. Everyone then sees the same pantry and list.

## How login works
Phone is the login name. Internally it maps to `p<digits>@homeapp.local`
for Supabase Auth, with the password you set in the app. That is why
no email address and no SMS code are needed. The real phone is stored
in `profiles` so spending can later be shown by who paid / who added.

## How meal cost will work (Phase 4, already in the data model)
`pantry_items.quantity` is the total on hand (so tomatoes stay one stock
line), while `purchase_lots` keeps each purchase's own price and date.
Budget totals sum the lots. Cooking will deduct oldest lots first.

## Demo mode
With empty `config.js`, the app still opens and works on that one device
using browser storage, with a yellow banner. That is for trying the UI
before Supabase is connected — it is NOT shared until Supabase is set up.
