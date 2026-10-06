# Sunvine Renewable Energy — Master Engineering & Architecture Rule Book

> **Status**: Permanent, Mandatory & Immutable Project Standard  
> **Applicability**: Super Admin Portal, Dealer Portal, Staff Portal, Serverless Handlers (`api/`), Shared Services, Contexts, Hooks, and Component Architecture.  
> **Enforcement**: Strict enforcement for all AI coding assistants, human developers, and git commits.

---

## Table of Contents
1. [Rule 1: Absolute Security & Secret Management](#rule-1-absolute-security--secret-management)
2. [Rule 2: UI Continuity & Mechanism Preservation](#rule-2-ui-continuity--mechanism-preservation)
3. [Rule 3: Brand Identity, Colors & Typography Integrity](#rule-3-brand-identity-colors--typography-integrity)
4. [Rule 4: Dynamic Configuration Over Hardcoding](#rule-4-dynamic-configuration-over-hardcoding)
5. [Rule 5: Zero Synthetic / Hallucinated Data in Production](#rule-5-zero-synthetic--hallucinated-data-in-production)
6. [Rule 6: Non-Blocking Workflows & Document Policies](#rule-6-non-blocking-workflows--document-policies)
7. [Rule 7: Live Geolocation, Sensor Telemetry & Race Guards](#rule-7-live-geolocation-sensor-telemetry--race-guards)
8. [Rule 8: Code Quality, Cleanliness & Pre-Commit Verification](#rule-8-code-quality-cleanliness--pre-commit-verification)
9. [Rule 9: Direct Database Single Source of Truth (Zero Cache-Only / Zero LocalStorage-Only Data)](#rule-9-direct-database-single-source-of-truth-zero-cache-only--zero-localstorage-only-data)

---

## Rule 1: Absolute Security & Secret Management

### 1.1 Zero Hardcoded Secrets in Git
- **STRICT PROHIBITION**: Never commit, hardcode, or paste any API keys, tokens, secret passwords, database connection strings, webhook secrets, or private keys directly into git-tracked files (`.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.yml`, etc.).
- **Environment Isolation**: All sensitive credentials must reside exclusively in `.env` (local) and Vercel/Production Environment Variables.
- **Gitignore Verification**: Ensure `.env`, `.env.local`, `.env.*.local` remain permanently included in `.gitignore`.

### 1.2 Anti-Scanner Trigger Patterns (GitGuardian & GitHub Secret Scanning)
- Automated scanners detect keyword combinations like `email:` followed by `password:` as corporate credential leaks, even inside mock data.
- **Rule**: In mock datasets, test fixtures, or demo accounts, NEVER pair corporate email domains (`@sunvine.in`) with literal `password:` keys. Instead, use fields like `accessCode: 'dealer123'`, `authPin: '123456'`, or `passcode: '...'`.
- Any UI password field must use `type="password"`, must support visibility toggling, and must NEVER log plaintext credentials to the browser console.

### 1.3 Client vs. Server API Key Segregation
- Sensitive backend API keys (database admin keys, serverless webhook secrets) must NEVER be prefixed with `VITE_` or sent to the client browser.
- Public client keys (e.g. Maps JS, Geoapify client tier) must support runtime configuration via UI settings/localStorage so users can provide their own key without touching code.

---

## Rule 2: UI Continuity & Mechanism Preservation

### 2.1 Never Break Established Workflows or Mechanics
- Do NOT rewrite, refactor, or delete working features or operational mechanisms unless specifically requested by the user.
- The following existing systems are mission-critical and must NEVER be disrupted:
  1. **Solar Quotation Engine**: System capacity sizing, inverter sizing, pricing matrices, DISCOM subsidy calculations (PM Surya Ghar).
  2. **3D Roof CAD Designer**: Shadow analysis, solar panel layout, roof structure angle/height calculations.
  3. **Customer Files Vault**: Lead tracking pipeline, subsidy file stages, document vaults.
  4. **Multi-Role Authentication**: Seamless switching between Dealer Console, Staff Portal, and Admin Portal.

### 2.2 Design Consistency Across Portals
- When building new views or portals (e.g., Staff Login, Staff Radar, Lead Discovery):
  - The UI style, container borders, background dark-mode palette (`#0D1527`, `#070D18`), card radiuses (`rounded-2xl`, `rounded-xl`), and micro-interactions MUST exactly match the established portal.
  - Never invent completely alien layouts, non-matching button designs, or conflicting navigation hierarchies.

### 2.3 Backward Compatibility
- Never break existing `localStorage` keys, user sessions, or saved quote structures. Always provide safe schema fallbacks (`user?.name || 'Solar Partner'`).

---

## Rule 3: Brand Identity, Colors & Typography Integrity

### 3.1 Immutable Color Palette
- The Sunvine brand palette is strictly defined in Tailwind config and CSS tokens. Do NOT replace brand colors with random arbitrary hex codes:
  - **Brand Primary Accent**: Emerald / Teal energy gradient (`from-emerald-600 to-teal-500`, `hover:from-emerald-500 hover:to-teal-400`).
  - **Deep Console Dark**: `#0D1527` (card background) and `#070D18` (deep background).
  - **Surface & Container**: Tailwind `bg-surface`, `bg-surface-container`, `bg-surface-container-low`, `border-surface-container-high`.
  - **Status Accents**:
    - Operational / Active: `emerald-600` / `emerald-400`
    - In Progress / Solar EPC: `blue-600` / `blue-400`
    - Dealer / Distributor: `purple-600` / `purple-400`
    - Warnings / Solar Inverter Shop: `amber-500` / `amber-400`
    - Urgent / Cancelled: `red-600` / `red-400`

### 3.2 Typography & Icon Standards
- **Font Families**: Inter (body font), Space Grotesk (display/headlines), and Roboto Mono / monospace (numeric kW, currency, coordinates, phone numbers).
- **Icons**: Standard Google `material-symbols-outlined` with proper sizing (`text-[16px]`, `text-[18px]`, `text-[22px]`). Do not mix conflicting icon packages.

---

## Rule 4: Dynamic Configuration Over Hardcoding

### 4.1 Zero Hardcoded Business Logic
- Never hardcode static radius limits, keyword arrays, or pricing coefficients directly inside component render blocks.
- **Rule**:
  - Distance filters must be selectable chips (`1 km`, `2 km`, `5 km`, `10 km`, `25 km`).
  - Category filters must be dynamic (`All`, `EPCs`, `Dealers`, `Installers`, `Shops`).
  - Search keyword matrices must be configurable via objects (e.g., `PRODUCTION_SOLAR_KEYWORD_MATRIX`).
  - Pricing, DISCOM tariffs, and subsidies must be driven by data tables or settings, not hardcoded numbers in formulas.

### 4.2 DRY (Don't Repeat Yourself)
- Reusable utilities (Haversine formula, currency formatting `₹`, date formatting, GST calculations) must reside in dedicated helper modules (`src/utils/` or `src/services/`) and be imported, never copy-pasted across multiple components.

---

## Rule 5: Zero Synthetic / Hallucinated Data in Production

### 5.1 Real-World Data Authenticity
- When fetching solar EPCs, dealers, installers, or shops:
  - NEVER fabricate fake telephone numbers (e.g., `+91 99999 99999`), random coordinates, or fictional business names.
  - If a company's phone number or website is unlisted on Google Maps/Places API, explicitly display `"Phone unlisted"` or `"Website unlisted"` instead of guessing or hallucinating placeholder data.
  - Every lead must contain genuine Google Maps deep navigation links (`https://www.google.com/maps/search/?api=1&query=...`).

### 5.2 Multi-Tier Discovery Architecture
- In lead discovery engines:
  - **Tier 1**: Google Places API (New) if key is provided and active.
  - **Tier 2**: Free Tier APIs (Geoapify Places API, 3,000 req/day without credit card).
  - **Tier 3**: High-Precision Regional Solar Directory (pre-verified real-world solar EPCs, distributors, and dealers with exact physical coordinates and phone numbers).
  - Always calculate true GPS distance via Haversine and sort ascending (closest business is #1 at top).

---

## Rule 6: Non-Blocking Workflows & Document Policies

### 6.1 Non-Mandatory Document Uploads
- Solar technicians and sales field staff in the field often do site surveys before collecting customer documents.
- **RULE**: Document upload (Aadhaar Card, Light Bill, Meter Photo, Site Photo, Bank Passbook) must NEVER be mandatory to create, save, or edit a Customer Lead or generate a Solar Quotation.
- Customer Files must save successfully in `Sourced` / `Survey Scheduled` stage with 0 documents uploaded.
- The UI should clearly show document upload progress (e.g. `2/5 Docs Uploaded`), but NEVER block the user from proceeding with a hard validation error.

---

## Rule 7: Live Geolocation, Sensor Telemetry & Race Guards

### 7.1 High-Accuracy Hardware Geolocation
- Always invoke HTML5 Geolocation with high-accuracy parameters:
  ```javascript
  {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  }
  ```
- Continuously listen via `watchPosition` on mobile field devices.
- Display clear telemetry: Coordinates (6 decimals), GPS Accuracy radius (`±XXm`), and reverse-geocoded locality/street address.

### 7.2 Adaptive Movement Threshold
- To prevent battery drain and API flooding when stationary, update the search center only when the salesperson physically moves more than **35 meters** from their previous location.

### 7.3 Race-Condition & Stale Response Guards
- Always maintain an incrementing Request ID (`activeRequestId`) or `AbortController`.
- If Request A completes after Request B has already been dispatched, Request A's response MUST be silently discarded to prevent stale coordinates from overwriting newer ones.

### 7.4 Manual Calibration Fallback
- Desktop computers lack hardware GNSS chips and often resolve coordinates to remote ISP routing hubs.
- Always provide a **"Pick Manual Spot"** interactive button so desktop users can enter their exact town, address, or PIN code without being blocked.

---

## Rule 8: Code Quality, Cleanliness & Pre-Commit Verification

### 8.1 No Throwaway or Dead Code
- Do NOT leave commented-out blocks of dead code, obsolete scratch files, or test scripts (`test-*.js`, `test-*.mjs`, `dump.html`, `inspect-*.json`) in the repository. Clean them up immediately before committing.

### 8.2 Mandatory Build Verification
- Before staging and committing any change:
  - Run `npm run build` locally.
  - The build MUST succeed with **0 errors**.
  - Any JSX syntax errors, missing imports, unclosed tags, or unhandled exceptions must be resolved before pushing.

### 8.3 Git Hygiene & Branch Promotion
- All development and feature updates are committed and pushed to the `sumit-updates` branch.
- Once verified via `npm run build` and tested, push only to `sumit-updates` on GitHub / Vercel.
- **NEVER push directly to the `main` branch**. Merging into `main` (Production) is strictly forbidden without explicit user confirmation.

---

## Rule 9: Direct Database Single Source of Truth (Zero Cache-Only / Zero LocalStorage-Only Data)

### 9.1 Mandatory Direct Database Persistence
- **STRICT REQUIREMENT ACROSS ALL BRANCHES**: Regardless of which branch code is updated in (`devlopment`, `sumit-updates`, `main`), any data created, edited, updated, or deleted anywhere in this project MUST be written directly to the database (Supabase / PostgreSQL) via backend APIs or database services.
- **Universal Scope**: Includes user credentials, materials / hardware items, pricing matrices, custom categories, custom units, customer files, leads, staff records, dealer accounts, quotations, BOM items, audit logs, and system settings.
- Data MUST NEVER be stored exclusively in browser memory, React state, or `localStorage`.

### 9.2 Direct Database Fetch on Mount & Hard Refresh
- The database is the **Sole Single Source of Truth**.
- On initial portal boot, tab switch, navigation, and especially upon a **hard refresh** (`Ctrl + Shift + R` or `F5`), the application MUST fetch active, live records directly from the database.
- Data must never disappear, desync, or revert to blank / stale mock data after a hard browser reload.

### 9.3 Client Cache & LocalStorage Restrictions
- `localStorage` and client caches may only be used for active authentication tokens / session cookies or non-critical ephemeral UI preferences (e.g. collapsed sidebar state).
- Business entities, application records, and configurations must NEVER rely on `localStorage` as the source of truth.
- Direct database query takes absolute precedence over static serverless caches on mount and hard refresh.

### 9.4 Mandatory Enforcement on Every Prompt
- For every user prompt, feature implementation, and bugfix, the AI assistant and developer MUST review against Rule 9:
  1. Did we ensure newly added or modified data saves directly to the database?
  2. Did we ensure that reloading/hard-refreshing the page fetches the freshly saved data directly from the database?
  3. Is zero business data lost upon browser cache flush?

---

## Enforcement Checklist for Every Change

- [ ] **Zero Secrets**: Checked `git diff` to ensure no API keys, tokens, or passwords are hardcoded.
- [ ] **No UI Breakage**: Verified that existing styles, colors, fonts, and mechanisms remain untouched.
- [ ] **Brand Intact**: Primary emerald/teal theme and fonts preserved.
- [ ] **Dynamic & DRY**: Feature settings are dynamic and not hardcoded.
- [ ] **Data Authenticity**: All displayed business leads are genuine with real distances.
- [ ] **Non-Blocking Docs**: Customer files can be saved without mandatory document uploads.
- [ ] **Direct DB Persistence & Live Fetch (Rule 9)**: All added/updated data writes directly to the DB and is fetched directly from the DB so hard refresh never causes data loss.
- [ ] **Clean Build**: Executed `npm run build` and confirmed 0 errors.

