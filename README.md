# Nutri Plan
**Plan-first nutrition math** (Cronometer-ish) for building a weekly meal plan and validating nutrient coverage — without becoming a food logging app.

This repo is the **frontend** (React + TypeScript + Vite + Mantine). It talks to a **local-only GraphQL backend** (SQLite + Prisma) that:
- persists your data outside the browser, and
- makes USDA FoodData Central (FDC) calls server-side (so the browser never fights CORS).

> **Privacy reality check:** This README contains personal details about Scott & Ashley by design (project intent). Keep this repo private if that’s not something you want public.

---

## Why this exists (goals and non-goals)

### Goals
Nutri Plan is built for **planning**:
- Build a **weekly plan** (7 breakfasts + 7 lunches + 7 dinners + snacks)
- Create **recipes** (ingredient lists in grams)
- Pull nutrient profiles from **USDA FoodData Central**
- Compute nutrients:
  - per recipe
  - per day
  - per week
- Compare results against **targets** for a selected person
- Answer “Do we hit protein/fiber/micronutrients weekly?” before you grocery shop.

### Non-goals (intentionally)
Nutri Plan is **not**:
- a meal logging tool with time stamps and “what I ate today”
- a barcode scanner or branded-food-first tracker
- a perfect simulator of cooking yield / retention factors (yet)
- a diet program or medical advice engine

Strong opinion: most nutrition apps optimize for **logging compliance**. Nutri Plan optimizes for **designing a plan** and making sure it isn’t nutritionally dumb.

---

## Project intent: Scott & Ashley (so we don’t lose the plot)

This project exists to help **Scott** and **Ashley** design meal plans that:
- hit nutrient needs reliably,
- are mostly plant-based but realistic and enjoyable,
- support slow, healthy weight change without “diet brain,” and
- don’t require obsessively logging every bite.

### Scott (baseline profile)
- **DOB:** September 15, 1988  
- **Height:** 5 ft 8 in  
- **Current weight:** 185 lb  
- **Goal weight:** 155 lb  
- **Allergies:** None  
- **Diet style:** Mainly vegan, with exceptions:
  - honey
  - eggs (low frequency)
  - dairy (low frequency)

### Ashley (baseline profile)
- **DOB:** January 19, 1995  
- **Height:** 5 ft 4 in  
- **Current weight:** 135 lb  
- **Goal weight:** 120 lb  
- **Allergies:** None  
- **Diet style:** Mainly vegan, with exceptions:
  - honey
  - eggs (low frequency)
  - dairy (low frequency)

### Important detail: supplements + meds must be trackable
We plan to take and track:
- supplements and vitamins
- medications
- non-nutrient supplements like **creatine** and **ashwagandha**
- **prenatal** (when relevant)
- **tadalafil** (when relevant)

The app must eventually treat these as “things you consume that affect targets/outcomes,” even if they aren’t “foods.”

### Pregnancy + pre-pregnancy modes (required eventually)
We need **two separate modes**:
1. **Pre-pregnancy mode** (planning and target-setting leading up to pregnancy)
2. **Pregnancy mode** (trimester-specific adjustments)

The intent is: when pregnancy is enabled, the system should help **adjust nutrient targets** to follow widely accepted recommendations.  
(Important: the UI should still keep targets transparent and user-overridable, because context matters.)

### Exercise accounting (explicitly not now)
For now:
- we **won’t** model exercise calories or TDEE precision
- we will set calorie targets for a **light lifestyle**, using **target weight** in mind
- we are **not trying to create a deliberate deficit**; the approach is “eat enough to maintain the goal weight,” which should create slow, healthy weight loss over time

### “Bryan Johnson-ish, but human”
We want to eat as healthy as Bryan Johnson **in spirit**:
- high nutrient density
- high consistency
- high intention

…but less extreme and more willing to enjoy life:
- eat at **5pm** instead of **11am**
- more variety and texture
- occasional fun foods done intelligently (e.g., lower sugar pancakes)
- occasional fake meat
- not every meal needs to be “optimal,” just not dumb

---

## High-level workflow (how you use it)

1. **Start backend + frontend**
2. **(Optional)** configure an FDC API key in backend `.env` or through the UI Settings (which stores it in the backend)
3. **Foods (FDC)**: search foods and cache what you care about
4. **Recipes**: create recipes and add ingredients (cached foods show first, but you can add uncached foods too)
5. **People & Targets**: set targets per nutrient per person
6. **Week Plan**: assign recipes to each day (breakfast/lunch/dinner + snacks)
7. **Dashboard**: validate daily/weekly totals vs targets

---

## Architecture overview

### Repos
- **Frontend**: this repo (`nutri-plan`)
- **Backend**: separate repo (`nutri-plan-backend`)

The frontend is a Vite SPA. The backend is a local GraphQL service and should run on your machine.

### How data flows
On startup:
- The frontend queries `appState` from the backend
- The frontend hydrates its reducer state from that response

On UI changes:
- The UI dispatches reducer actions (optimistic update)
- The AppState provider maps those actions to backend GraphQL mutations to persist changes
- If a mutation fails, the UI refetches `appState` to re-sync (and shows a notification)

### USDA FoodData Central calls
- The browser **does not** call USDA directly anymore
- The frontend calls backend GraphQL:
  - `fdcSearchFoods(...)`
  - `fdcGetFoodDetails(fdcId)` → returns normalized `FoodDetailsLite`
- Backend handles the API key and the remote HTTP calls

This avoids browser CORS issues and avoids storing the key in localStorage.

---

## Tech stack

### Frontend
- React 18 + TypeScript
- Vite
- Mantine UI (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`)
- A reducer-based state model (domain logic stays centralized)

### Backend (separate repo)
- GraphQL server (GraphiQL enabled)
- SQLite database (`./dev.db`)
- Prisma ORM

---

## Requirements
- Node.js 18+ recommended
- npm 9+ recommended
- macOS / Linux / Windows all fine

---

## Quick start (recommended)

### 1) Start the backend
Clone and run `nutri-plan-backend`:

```bash
git clone <your-backend-repo-url> nutri-plan-backend
cd nutri-plan-backend

cp .env.example .env
# Optional but recommended:
# set FDC_API_KEY=... inside .env

npm install
npx prisma generate
npx prisma db push
npm run dev
````

Backend GraphQL endpoint:

```txt
http://localhost:4000/graphql
```

The backend enables CORS for dev origins:

```txt
http://localhost:5173
http://127.0.0.1:5173
```

### 2) Start the frontend

In a second terminal:

```bash
git clone <your-frontend-repo-url> nutri-plan
cd nutri-plan

npm install
npm run dev
```

Frontend dev server:

```txt
http://localhost:5173
```

---

## Config

### Backend URL (frontend)

By default, the frontend calls:

```txt
http://localhost:4000/graphql
```

If you need a different URL, set:

```bash
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

You can export it in your shell, or use a `.env.local` file in the frontend repo:

```bash
# .env.local
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

### USDA FoodData Central API Key

You have two options:

1. Set it in backend `.env`:

```bash
FDC_API_KEY=your_data_gov_key
```

2. Use the frontend Settings page:

* paste the key
* UI calls backend mutation `setApiKey(apiKey)`

Either way, the **key lives in the backend**, not in browser storage.

---

## What’s in the UI (pages)

### Dashboard

* Select person
* Toggle Day vs Week view
* See macro snapshot (calories/protein/carbs/fat/fiber)
* Compare targets vs actual totals with progress bars
* View computed nutrient totals (full list)

### Week Plan

* Enforces exactly one breakfast/lunch/dinner per day
* Snacks are a list per day
* Plan is stored persistently in backend

### Recipes

* Create/edit recipes
* Add ingredients (grams)
* Cached foods appear instantly when typing
* USDA results fill in asynchronously from backend search
* If you add an ingredient that isn’t cached, the UI fetches food details and caches it automatically (so totals work)

### Foods (FDC)

* Search foods via backend FDC search
* Cache food details (normalized)
* View cached foods list

### People & Targets

* People are persisted profiles (Scott/Ashley default seeded in state)
* You manually define nutrient targets (daily + optional weekly override)
* Targets are compared in Dashboard

### Settings

* Backend status information
* Set FDC API key (stored in backend)
* Reset all data (backend `resetAll` + rehydrate)

---

## Data model (conceptual)

### FoodDetailsLite (cached foods)

A cached food contains:

* `fdcId`
* `description`, `dataType`, `brandOwner`
* optional serving metadata
* **nutrients array** (id, name, unit, amount)
* `lastFetchedISO`

The UI assumes nutrient values are generally per 100g and scales by `grams / 100`.

### Recipes

A recipe:

* name, optional tags, optional notes
* ingredients:

  * `fdcId`
  * grams
  * stored description (so recipes are readable even if cache later changes)

### Week plan

* 7 days
* each day:

  * breakfast recipe id
  * lunch recipe id
  * dinner recipe id
  * snack recipe ids

### People

A person profile includes:

* name
* sex
* optional biometrics (weight goals, height, activity, pregnancy mode)
* nutrient targets

Targets are stored per nutrient id.

---

## Nutrition math (important caveats)

### Scaling

Nutrients are scaled using:

```txt
scaledAmount = per100gAmount * (grams / 100)
```

### Accuracy realities

* Foundation / SR Legacy foods tend to be consistent per 100g.
* Branded foods may be label-derived and sometimes weird.
* Cooked vs raw weights matter a lot (rice, oats, meat, etc.).
* This is “planning math,” not lab-grade nutrition accounting.

If you want Cronometer-level accuracy later, you’ll need:

* portion + unit support (cups, tbsp, servings)
* cooked yield / nutrient retention factors
* custom foods + per-food overrides
* supplement tracking

---

## Roadmap (future features we expect)

### Near-term (next)

* **Supplement / medication tracking**

  * supplements as “consumables” with nutrients (or other effects) + schedules
  * non-nutrient supplements tracked as well (creatine/ashwagandha/etc.)
* **Pregnancy + pre-pregnancy modes**

  * trimester-aware target presets / guidance
  * user overrides always visible

### Medium-term

* Target macros (protein/carb/fat) beyond just “nutrient totals”
* Cooking instructions per recipe / per plan day
* Grocery list generation from the week plan
* Pantry/kitchen equipment preferences (“we have an air fryer / blender / instant pot”)

### Longer-term

* Better unit support (cups, tbsp, serving sizes) with conversions
* Cooking yield/retention adjustments (optional)
* Multi-week plans and templates

---

## Development notes (frontend)

### State management

The UI uses a reducer as the core state machine. Persistence is handled by the AppState provider:

* Hydrate from backend `appState`
* Persist via mutations mapped from actions
* Keep UI responsive with optimistic updates
* On backend errors: notify + refetch `appState`

### Notifications

Mantine notifications are used for:

* backend offline warnings
* sync failures
* settings save failures

### Legacy Vite proxy

You may still see a Vite proxy config for `/fdc`. With the new backend integration, the proxy is no longer necessary for normal operation.

---

## Common troubleshooting

### “Backend not reachable” notification

* Make sure backend is running:

  ```bash
  cd nutri-plan-backend
  npm run dev
  ```
* Confirm GraphQL endpoint opens:

  ```txt
  http://localhost:4000/graphql
  ```
* Confirm frontend dev server origin is allowed (5173)

### Prisma / DB issues

From backend repo:

```bash
npx prisma generate
npx prisma db push
```

If you want to reset DB completely (backend-side):

* remove `dev.db` (or use whatever reset instructions backend repo provides)
* run `prisma db push` again

### FDC search returns errors

* Ensure `FDC_API_KEY` is set in backend `.env` OR set via Settings UI
* Confirm backend can reach the internet
* Try searching a simple term (“oats”)

### UI changes aren’t persisting

* Backend offline: UI may still render, but persistence fails
* Look at GraphQL errors in backend terminal output
* Use GraphiQL to test `appState` and mutations

---

## Scripts (frontend)

```bash
npm run dev       # start Vite dev server
npm run build     # typecheck + build
npm run preview   # serve built output
```

---

## Repo layout (frontend)

```txt
src/
  App.tsx                  # AppShell + navigation
  main.tsx                 # Mantine + notifications + AppStateProvider
  pages/                   # Dashboard / Plan / Recipes / Foods / People / Settings
  state/
    AppStateContext.tsx    # hydration + persistence mapping layer
    reducer.ts             # state machine + migrations
    types.ts               # core types
    calc.ts                # nutrient math
    utils.ts
  fdc/
    client.ts              # GraphQL-backed FDC search/details
  graphql/
    client.ts              # fetch-based GraphQL client
    literal.ts             # helper to serialize args into GraphQL literals
  backend/
    api.ts                 # backend contract wrapper (appState + mutations)
```

---

## License

MIT


