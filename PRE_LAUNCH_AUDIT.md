# PRE-LAUNCH AUDIT — Sunvine Solar Dealer Portal

- **Audited:** 2026-10-06, local checkout on branch `devlopment` (HEAD `1c1a35a`), compared with `origin/main` (`18765ae`) and `origin/sumit-updates` (`3a8ff5c`).
- **Mode:** read-only on source. This file is the only artefact written to the repo. Scratch probe scripts live outside the repo, in the agent scratch directory.
- **Secrets policy:** no real secret is printed. Values are masked (`ab…yz`) and referenced by file:line only.
- **Live probing:** I ran count-only, read-only anon-key HTTP requests against the Supabase project in your local `.env` (host `wyb….co`). Details are in SEC-002. **Whether that project is production is UNVERIFIED. If it is staging, repeat the probe against production before launch.**

---

## 1. Executive summary

**VERDICT: ❌ NO-GO for tomorrow.** There are 8 Critical findings. At least four of them let an unauthenticated internet user take over the system with one or two HTTP requests.

1. `POST /api/auth/manage-credentials` has **no authentication**. Anyone can create an admin (default password `admin123`), reset any dealer or staff password, delete dealers, and list admin accounts (SEC-001).
2. With only the public anon key, the live database returned **8 dealer rows and 5 staff rows including `password_hash` and staff `access_code`**, plus quotations, audit logs and dealer margin tables. RLS is effectively open (SEC-002). A SECURITY DEFINER login RPC in the repo also contains **hardcoded universal passwords** (SEC-003).
3. **Cross-dealer tampering:** `/api/quotations` save lets any dealer overwrite another dealer's quotation by sending its `quotation_id` (SEC-005). Prices can be zeroed with an unbounded `discount_amount` or by renaming BOM item ids (SEC-006).
4. The **database superuser password was committed to a public repo** in history (SEC-007). Treat it as compromised and rotate it.
5. `devlopment` ships `supabase_realtime_pricing_migration.sql`, which creates `FOR ALL USING (true)` policies on `quotations`. `npm run migrate` runs it (SEC-004).

**Path to GO-WITH-CONDITIONS:** complete section 3 items 1–10 (roughly 1.5 working days for one engineer). Then re-run the anon probe in Appendix B and confirm it returns 401/empty.

### Top 5 risks
| # | Risk | IDs |
|---|---|---|
| 1 | Unauthenticated account-management API (takeover, admin creation, mass delete) | SEC-001 |
| 2 | Anon key can read credential hashes / PII and likely write the core tables | SEC-002, SEC-003, SEC-004, SEC-008 |
| 3 | Cross-dealer quotation overwrite and price/discount tampering | SEC-005, SEC-006 |
| 4 | DB superuser credential in public git history, with no rotation evidence | SEC-007 |
| 5 | Unauthenticated or un-scoped storage, push and customer-file endpoints (IDOR) | SEC-009, SEC-010, SEC-011 |

## 2. Severity counts

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 8 | SEC-001 – SEC-008 |
| **High** | 4 | SEC-009 – SEC-012 |
| **Medium** | 13 | SEC-013 – SEC-025 |
| **Low** | 4 | SEC-026 – SEC-029 |
| **Info (positive or neutral)** | 6 | INF-001 – INF-006 |

Phase 3 hardcoded values (HC-xx) are tracked separately in section 5. Launch-blocking ones are marked there.

---

## 3. MUST FIX BEFORE LAUNCH TOMORROW (ordered)

| # | Action | Effort | Closes |
|---|---|---|---|
| 1 | **Rotate everything:** DB password (Supabase → Settings → Database), `JWT_SECRET` (this invalidates all sessions), `SUPABASE_SERVICE_ROLE_KEY`, R2 keys, VAPID private key, Upstash token, Gemini key. Restrict the Google Maps/Places keys by HTTP referrer. Update the Vercel env vars and redeploy. | 1 h | SEC-007 |
| 2 | Add an admin-JWT guard to `/api/auth/manage-credentials`. Remove the `'admin123'` default. Replace reflective CORS with an allowlist. | 1 h | SEC-001 |
| 3 | Run the RLS lockdown SQL (Fix A in SEC-002): drop every `USING (true)` policy on account tables. Revoke anon/authenticated grants on accounts, audit logs and OTP. Drop or `security_invoker` the `dealers`, `admin_users` and `staff_users` views. Run the SQL on prod, then re-run the Appendix B probe. | 1–2 h | SEC-002, SEC-004, SEC-008 |
| 4 | Redefine `verify_user_credentials` without the hardcoded passwords, or drop it and remove the client fallback. Check the live function body with the SQL in SEC-003. | 30 min | SEC-003 |
| 5 | Move all browser writes (dealer/staff/pricing/hardware/settings/audit) behind admin-checked `/api` routes. The minimum for tomorrow is to block anon writes in RLS and confirm the admin UI still works through the API. | 4–6 h | SEC-008 |
| 6 | `quotations.js` save: verify ownership when `quotation_id` is supplied. Clamp `discount_amount`. Price **every** BOM line from the DB. Reject unknown item ids. | 2 h | SEC-005, SEC-006 |
| 7 | Storage endpoints: scope keys per owner (`dealers/<dealer_id>/…`). Reject `NODE_ENV !== 'production'` bypasses. Remove the client-supplied `bucket`. | 2 h | SEC-009 |
| 8 | Require auth on `push-subscription` and `push-notify`. Derive `userId` and role from the JWT. | 45 min | SEC-010 |
| 9 | `customer-files.js`: enforce dealer/staff ownership on get/update/cancel/restore/delete. | 1.5 h | SEC-011 |
| 10 | Do NOT run `supabase_realtime_pricing_migration.sql`. Delete or neutralise it on `devlopment`. Remove the `migrate` npm script target, or point it at an `002`-compliant file. | 15 min | SEC-004 |
| 11 | Re-check suspension: check `status` on every API call, or keep the JWT TTL short with a revoke list. Drop the 12 h dealer-rate cache or invalidate it from the admin save. | 1.5 h | SEC-012 |
| 12 | Move the Report-Only CSP to enforcing. Add the nginx headers (section 4, SEC-016). | 1 h | SEC-016 |

---

## 4. Detailed findings

> Severity rule applied: when in doubt, the higher level.
> "Verified" means I reproduced it from code or ran a probe. "UNVERIFIED" means it needs something I could not do read-only.

### Phase 2A/2B — Secrets, RLS and database exposure

#### SEC-001 — CRITICAL — Unauthenticated account-management API
- **Location:** [authManage.js:13-34](file:///e:/repos/dealer-portal-quotation/api/_lib/authManage.js#L13-L34), `:417`, `:433`, `:445-454`. Routed from `api/auth/[action].js` case `manage-credentials`.
- **Evidence:**
```js
res.setHeader('Access-Control-Allow-Credentials', 'true');
res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');   // :15
...
const { action, payload } = req.body || {};                                // no verifyJwt anywhere in file
switch (action) { case 'create-dealer': ... case 'delete-dealer': ... case 'get-accounts': ... case 'create-admin':
  const plainPassword = String(password || 'admin123').trim();            // :454
```
- **Impact:** `grep verifyJwt|role` finds no guard in this file. An attacker runs `curl -X POST https://<host>/api/auth/manage-credentials -d '{"action":"create-admin","payload":{"email":"x@x","fullName":"x","password":"…"}}'`. They log in as admin through `/api/auth/login`, or use `update-dealer-credentials` to reset any dealer's password. They can also call `delete-dealer` / `delete-staff`, and `get-accounts` lists admin emails and mobile numbers. Reflective CORS plus credentials lets any website call it from a victim's browser.
- **Fix:**
```js
import { verifyJwt } from './jwt.js';
const ALLOW = new Set((process.env.ALLOWED_ORIGINS||'').split(','));
const origin = req.headers.origin;
if (ALLOW.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Credentials','true'); }
// after OPTIONS / method check:
const tok = (req.headers.cookie||'').match(/sunvine_auth_token=([^;]+)/)?.[1] || req.headers.authorization?.replace(/^Bearer\s+/i,'');
const jwt = verifyJwt(tok);
if (!jwt.valid || jwt.payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
// :454 -> if (!password || String(password).length < 10) return res.status(422).json({error:'password required (min 10)'});
```
Also check the admin role against `admin_accounts` on each call (see SEC-012).

#### SEC-002 — CRITICAL — Live DB readable (and probably writable) with the public anon key
- **Evidence:** probe in Appendix B. With `VITE_SUPABASE_ANON_KEY`, HTTP 206 and counts:
  `dealer_accounts 8`, `staff_accounts 5`, `quotations 3`, `audit_logs 7`, `dealer_custom_pricing 4`, `solar_modules 8`, `solar_inverters 12`, `bom_catalog 24`, `bos_pricing_matrix 15`, `document_master 21`. The views `dealers`, `staff_users` and `admin_users` also respond.
  Sensitive columns that were returned non-null (names only, no values read): dealer `password_hash` (8/8, bcrypt), `mobile_number`, `email`, `max_margin_cap_per_kw`; staff `password_hash` (5/5, bcrypt), `access_code` (5/5), `phone`, `email`; quotations `customer_phone`, `base_cost`, `dealer_margin`; audit_logs `user_email`, `ip_address`.
- **Root cause (repo):** [supabase_rename_account_tables.sql:39-55](file:///e:/repos/dealer-portal-quotation/supabase_rename_account_tables.sql#L39-L55) creates `"Public write dealer_accounts" … FOR ALL USING (true)`, and the same for `admin_accounts` and `staff_accounts`. [supabase_realtime_pricing_migration.sql:277-281](file:///e:/repos/dealer-portal-quotation/supabase_realtime_pricing_migration.sql#L277-L281) does it for quotations. `supabase/migrations/002_rls_lockdown.sql` was meant to fix this, but the live DB clearly does not reflect it. Another reason the live state differs: `002` makes `quotations` readable by anon `WHERE share_token IS NOT NULL`, and after its backfill every row has a token.
- **Impact:** an attacker needs only the anon key from the JS bundle.
  - They can dump all dealers' and staff members' bcrypt hashes and staff access codes. The latter are likely plaintext or short; I did not read them.
  - They can read every customer name and phone and every dealer margin.
  - Because the policies are `FOR ALL`, they can `PATCH dealer_accounts` to change a password hash, tier or margin cap. My no-op PATCH returned 204 on 5 tables; this is consistent with writes being allowed but is **inconclusive**, because RLS also returns 204 for zero rows. I did not attempt a real write.
- **Fix A (SQL, run in the Supabase SQL editor; review the table list first):**
```sql
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname='public' AND (qual='true' OR with_check='true')
             AND 'service_role' <> ALL(roles::text[]) LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;
REVOKE ALL ON public.dealer_accounts, public.staff_accounts, public.admin_accounts,
              public.audit_logs, public.otp_verifications, public.customer_files,
              public.notifications, public.push_subscriptions, public.quotations,
              public.system_settings, public.dealer_custom_pricing FROM anon, authenticated;
DROP VIEW IF EXISTS public.dealers, public.admin_users, public.staff_users;  -- api/quotations.js:150 reads 'dealers'; repoint it to dealer_accounts first
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_by_share_token ON public.quotations;     -- serve proposals only via /api/quotations?action=public
-- Catalogue: read-only for anon is acceptable, but never include cost columns
REVOKE INSERT, UPDATE, DELETE ON public.solar_modules, public.solar_inverters, public.bom_catalog,
        public.bos_pricing_matrix, public.pricing_presets, public.document_master FROM anon, authenticated;
```
- **Fix B:** because login and data go through custom JWT (`sunvine_auth_token`), not Supabase Auth, `auth.uid()` policies cannot isolate dealers. The only sound design is the one above: browser = anon with read-only catalogue, everything else via `/api` using the service role. See SEC-008.
- **Verify:** re-run Appendix B. Every account/quotation table must return 401 or 200 with `*/0`.

#### SEC-003 — CRITICAL — Hardcoded universal passwords in a SECURITY DEFINER login RPC
- **Location:** [supabase_rename_account_tables.sql:85, 129, 160](file:///e:/repos/dealer-portal-quotation/supabase_rename_account_tables.sql#L85). Client fallback at [authService.js:147](file:///e:/repos/dealer-portal-quotation/src/services/authService.js#L147).
- **Evidence (masked):**
```sql
OR (p_password = 'de…23')                              -- any dealer
OR (p_password = 'ad…23' OR p_password = '12…56')      -- admin; also an admin-fallback identifier ('63…47')
OR (p_password = 'st…23' OR p_password = 've…23')     -- staff
```
- **Impact:** if this function exists in the live DB with this body, anyone who reads the public repo can log in as any dealer, admin or staff. They can call it directly from the browser: `POST /rest/v1/rpc/verify_user_credentials` with the anon key. The function **does exist live**: my call with a non-existent user returned HTTP 200 and a "No registered dealer account found" message. That wording differs from the repo file, so the deployed body may differ. **UNVERIFIED** whether the backdoor survives. I deliberately did not try the backdoor passwords against real accounts.
- **Check (run on prod):**
```sql
SELECT proname, prosrc ~ 'p_password\s*=' AS has_hardcoded_pw FROM pg_proc WHERE proname='verify_user_credentials';
```
- **Fix:**
```sql
DROP FUNCTION IF EXISTS public.verify_user_credentials(text,text,text);
-- or REVOKE EXECUTE ON FUNCTION public.verify_user_credentials(text,text,text) FROM anon, authenticated, public;
```
Then remove the RPC fallback in `authService.js:138-200` (it falls back to client-side bcrypt hashing). Delete `supabase_rename_account_tables.sql` and `scripts/seedAllDatabase.mjs` history references. The seeds also used a default password of the form `de…23` (see SEC-007).

#### SEC-004 — CRITICAL (on `devlopment`) — Migration that opens quotations to everyone
- **Location:** `supabase_realtime_pricing_migration.sql:277,281` (exists only on `devlopment`, 305 lines); run by `npm run migrate` via [run_migrations.js](file:///e:/repos/dealer-portal-quotation/scripts/run_migrations.js).
- **Evidence:**
```sql
CREATE POLICY "Allow All Quotations Access" ON public.quotations FOR ALL USING (true);
CREATE POLICY "Allow All BOM Snapshots Access" ON public.quotation_bom_snapshots FOR ALL USING (true);
CREATE POLICY "Allow All Public Read Tier Margins" ON public.dealer_custom_pricing FOR SELECT USING (true);
```
- **Impact:** a developer who runs `npm run migrate` on prod gives anon full read/write/delete on all quotations. It also adds `ALTER PUBLICATION supabase_realtime` for pricing tables, which streams dealer tier margins to every client.
- **Fix:** delete the file and the `migrate` script on `devlopment` (`git rm`), or rewrite the policies as `TO service_role`. Do not merge `devlopment` → `main` before this is done.

#### SEC-005 — CRITICAL — Cross-dealer overwrite (IDOR) in quotation save
- **Location:** [quotations.js:237-274](file:///e:/repos/dealer-portal-quotation/api/quotations.js#L237-L274).
- **Evidence:**
```js
let quotationId = body.quotation_id;            // client-supplied
const isNew = !quotationId;
...
const record = { id: quotationId, dealer_id: effectiveDealerId, ... };
await db.from('quotations').upsert([record], { onConflict: 'id' })   // no ownership check, service role
```
- **Impact:** dealer A posts `{quotation_id:"SV-2026-Q0001", customer_name:…}`, where that id belongs to dealer B. The service-role upsert overwrites B's row, sets `dealer_id` to A, and rewrites customer, price and margin. This steals B's lead or destroys its data. For `role=staff/admin`, `dealer_id` is also taken from the body.
- **Fix:**
```js
if (!isNew) {
  const { data: ex } = await db.from('quotations').select('dealer_id,status').eq('id', quotationId).maybeSingle();
  if (!ex) return res.status(404).json({ error: 'Not found' });
  if (role === 'dealer' && ex.dealer_id !== dealer_id) return res.status(403).json({ error: 'Forbidden' });
  if (role === 'dealer' && !['Draft','Rejected'].includes(ex.status)) return res.status(409).json({ error: 'Locked' });
}
```

#### SEC-006 — CRITICAL — Price and discount tampering is possible despite "server recompute"
- **Location:** [quotations.js:165-182, 202](file:///e:/repos/dealer-portal-quotation/api/quotations.js#L165-L182).
- **Evidence:**
```js
if (item.id === 'solar_panel' && panelRatePerWp > 0) { ...DB rate... }
if (item.id === 'solar_inverter' && inverterUnitPrice > 0) { ...DB rate... }
// "Allow dealer to set rate on other items ... (permissive for now)"
return { ...item, qty, rate: Math.max(0, Number(item.rate)||0), gstRate: [0,5,18].includes(...) ... };
...
discountAmount: Math.max(0, Number(body.discount_amount) || 0),        // :202 — no upper bound
```
- **Proof** (ran the shared engine, `src/shared/pricing/calculations.js`, in Node):
  - Honest 5.5 kW: gross ₹140,700 + capped margin ₹33,000 = total ₹173,700, net ₹95,700 after ₹78,000 subsidy.
  - `discount_amount = 1e9` → `totalAmount 0, netPayable 0`.
  - A BOM line with `id:'panel_x', qty:10, rate:1, gstRate:0` → gross ₹10. The panel/inverter DB-pricing branch is skipped because the id is not exactly `solar_panel`.
  - `panel_id` is optional, so a payload with only `bom_items` is entirely client-priced, and `gstRate:0` removes GST.
- **Impact:** a dealer can issue a legally branded Sunvine quote at any price or without GST. `dealer_margin` is capped, but `discount_amount` and non-panel BOM lines are free.
- **Fix:** price every BOM line server-side by catalogue id from `bom_catalog`. Reject unknown ids. Take GST from the catalogue row, not the client.
```js
const { data: cat } = await db.from('bom_catalog').select('id,default_rate,gst_rate,min_rate,max_rate').in('id', bomItems.map(i=>i.id));
const byId = new Map(cat.map(c=>[c.id,c]));
const sanitized = bomItems.map(i => { const c = byId.get(i.id); if(!c) throw new Error('Unknown BOM item '+i.id);
  const rate = Math.min(c.max_rate ?? c.default_rate, Math.max(c.min_rate ?? 0, Number(i.rate)||c.default_rate));
  return { ...i, qty: Math.max(0, Math.min(10000, Number(i.qty)||0)), rate, gstRate: c.gst_rate }; });
const maxDiscount = Math.round(bomTotals.grossTurnkeyCost * 0.05);          // value to come from system_settings
const discountAmount = Math.min(maxDiscount, Math.max(0, Number(body.discount_amount)||0));
```
Add a DB-side `CHECK (total_amount >= base_cost * 0.9)` as a backstop. Also require `panel_id` for kit quotes.

#### SEC-007 — CRITICAL — Database superuser password in public git history
- **Evidence:** the first committed version of `scripts/seedAllDatabase.mjs`, now deleted from the tree but present in history (see `git log --all -- scripts/seedAllDatabase.mjs`), contained a `connectionString` with a literal `postgres` password: `'pos…e:' + encodeURIComponent('Ge@…it') + '@aw…es'`. Your own `AUDIT_REPORT_V2.md:315` (tracked, although listed in `.gitignore`) lists it as S-01. Other deleted scripts (`scripts/inspect_pg.js`, `run_*_migration.js`, `schema_hardening.sql`, …) may have carried credentials too; I only scanned for URL- and JWT-shaped patterns. The same file seeded default passwords of the form `de…23` for every dealer and staff member.
- **Impact:** the repo is a public fork, so anyone can run `git log -p` and recover the password. If it was never rotated, this is full DB takeover, bypassing RLS.
- **Fix:** rotate the DB password now (Supabase → Database → Reset password). Rotate `JWT_SECRET` and the service-role key at the same time. Forcing password resets for all accounts is advisable, since seeded defaults and the RPC backdoor may have been used. Rewriting history (`git filter-repo`) does not help once forks exist, so rotation is mandatory. Run `gitleaks detect --log-opts="--all"` before and after (not installed here, UNVERIFIED).

#### SEC-008 — CRITICAL — Browser writes straight to Supabase with the anon key
- **Evidence:** 24 direct `supabase.from()/rpc()` call sites in `src/services/*` (see Appendix A). Examples: [dealerService.js:150](file:///e:/repos/dealer-portal-quotation/src/services/dealerService.js#L150) upserts `dealer_accounts`, `:292` deletes dealers, [staffService.js:111](file:///e:/repos/dealer-portal-quotation/src/services/staffService.js#L111) upserts `staff_accounts`, and [pricingService.js:71,141,228,317,372,418,482](file:///e:/repos/dealer-portal-quotation/src/services/pricingService.js#L71) write presets, BOS matrix, BOM, dealer pricing and `system_settings`. `quotationService.js:47,96` fall back to `select('*')` on the quotations table when the API fails.
- **Impact:** this design forces RLS to stay open to anon (which is SEC-002). Either an attacker can edit prices and accounts from the console, or, once RLS is fixed, the admin UI breaks. Admin checks (`role` from `localStorage.sunvine_role`, [AppContext.jsx:215,1207](file:///e:/repos/dealer-portal-quotation/src/context/AppContext.jsx#L215)) are UI-only.
- **Fix:** add admin-guarded `PUT /api/admin/*` handlers for accounts, pricing, hardware and settings. The browser keeps anon read-only catalogue SELECT only. Remove the `supabase.from(...).upsert/delete` calls and the quotation fallback. Do not "fix" this by re-enabling open policies.

#### SEC-009 — HIGH — Storage endpoints have no ownership scoping, and an `isDev` bypass
- **Location:** [storage-download.js:20-30](file:///e:/repos/dealer-portal-quotation/api/storage-download.js#L20-L30), [storage-delete.js:49-68](file:///e:/repos/dealer-portal-quotation/api/storage-delete.js#L49-L68), [storage-presign.js:64-135](file:///e:/repos/dealer-portal-quotation/api/storage-presign.js#L64-L135).
- **Evidence:**
```js
const isDev = process.env.NODE_ENV !== 'production';
if (!jwtResult.valid && !isDev) return res.status(401)...    // any env where NODE_ENV != production = no auth
const { url, path: objectPath, filename, bucket } = req.query;  // arbitrary key AND bucket
```
- **Impact:**
  - Any logged-in dealer can read or delete any customer's Aadhaar, bank or electricity-bill file if they know or guess the key. Keys look like `uploads/<name>.pdf`.
  - Presign deletes alternate-extension objects with the same name (`:133-150`), which enables overwrite and delete of other people's files.
  - Docker, a Vercel preview with a custom `NODE_ENV`, or local use all skip auth.
  - `bucket` comes from the client.
- **Fix:** prefix keys with `${role}/${ownerId}/` on presign. In download and delete, `if (role==='dealer' && !key.startsWith('dealer/'+dealer_id+'/')) 403`. Staff and admin are checked against `customer_files`. Remove `isDev`; fail closed. Ignore the `bucket` argument.

#### SEC-010 — HIGH — Push endpoints unauthenticated, with spoofable role
- **Location:** [push-subscription.js:8-43](file:///e:/repos/dealer-portal-quotation/api/push-subscription.js#L8-L43), [push-notify.js:19-111](file:///e:/repos/dealer-portal-quotation/api/push-notify.js#L19-L111).
- **Evidence:** neither file imports `verifyJwt`. The body supplies `userId` and `role`. CORS is `req.headers.origin || '*'`. `push-notify` selects `WHERE user_id = ANY($1) OR role = 'admin'`.
- **Impact:** anyone can register their own endpoint with `role:'admin'` and then receive all admin notifications, which carry customer and quotation data. They can also spam all dealers and admins with phishing pushes.
- **Fix:** verify the JWT, set `user_id`/`role` from the token (`jwt.payload.id`, `jwt.payload.role`), and restrict `push-notify` to admin/staff. Use the same origin allowlist as SEC-001.

#### SEC-011 — HIGH — Customer-file API: authentication but no per-record authorisation
- **Location:** [customer-files.js:271-272, 303, 345-383, 420-462](file:///e:/repos/dealer-portal-quotation/api/customer-files.js#L271). Only `delete` checks the role (`:440`).
- **Evidence:** update, cancel and restore use `.eq('id', fileId)` only, with the service role. `updates.dealer_id` is client-writable (`:271-272`).
- **Impact:** any dealer who knows or guesses a file id (`CF-…`/sequential) can edit, cancel, restore or reassign another dealer's customer file (KYC data). **Partly UNVERIFIED:** I read the call sites but did not trace every branch. Confirm by calling update with a second dealer's token.
- **Fix:** for `role==='dealer'`, add `.eq('dealer_id', jwt.dealer_id)` to every query. Strip `dealer_id` from `updates` unless the role is admin.

#### SEC-012 — HIGH — Suspension, tier and margin changes are not enforced for 12–24 h
- **Location:** [authLogin.js](file:///e:/repos/dealer-portal-quotation/api/_lib/authLogin.js) (status checked only at login; payload embeds `tier`, `maxMarginCapPerKw`), [quotations.js:148](file:///e:/repos/dealer-portal-quotation/api/quotations.js#L148) (`cacheAside(..., 43200, ...)`), [jwt.js](file:///e:/repos/dealer-portal-quotation/api/_lib/jwt.js) (24 h TTL, blacklist only on logout).
- **Impact:** a dealer you suspend keeps full API access for up to 24 h. An admin who lowers a dealer's margin cap sees the old cap enforced for up to 12 h, because the Redis key `dealer:rates:<id>` is never invalidated. If Redis is not configured, the rate limiter falls back to a per-instance `Map` (see SEC-013).
- **Fix:** in a shared `requireAuth()` helper, re-read `dealer_accounts.status` (a cheap indexed PK lookup, cacheable for 60 s) and reject suspended or inactive accounts. Delete `dealer:rates:<id>` from the admin save path.

#### SEC-013 — MEDIUM — Login hardening
- **Location:** [authLogin.js:27,54,95,113-171](file:///e:/repos/dealer-portal-quotation/api/_lib/authLogin.js#L27).
- **Evidence:** the rate limit is per IP (10 failures per 5 min). With no `UPSTASH_REDIS_REST_*` it silently becomes an in-memory `Map` (`rateLimiter.js:3`), which is useless across serverless instances. There is no per-account lockout. Each candidate runs `verifyPassword` up to 3× (raw/whitespace-stripped/trimmed), using `bcrypt.compareSync` and `pbkdf2Sync` in the event loop. Staff privilege is derived from hardcoded ids `STF-800`/`STF-003` and from the client-supplied `staffRole`. The error text differs between "Invalid mobile number" and "Invalid credentials", which allows enumeration.
- **Impact:** a distributed credential-stuffing run against dealer mobile numbers (OTP-less login) faces no real limit. CPU-bound hashing from 200 dealers plus an attacker can exhaust the function.
- **Fix:** add a per-identifier counter (`ratelimit:acct:<mobile>`, 5 / 15 min). Use async `bcrypt.compare`. Compare once, on the exact password. Return one uniform error. Make Redis mandatory in production (fail closed if unset).

#### SEC-014 — MEDIUM — Client-side auth state
- **Location:** [AppContext.jsx:189,215,1203-1207](file:///e:/repos/dealer-portal-quotation/src/context/AppContext.jsx#L189).
- **Evidence:** `sunvine_auth` and `sunvine_role` are read from localStorage on startup.
- **Impact:** setting `localStorage.sunvine_role='admin'` shows the admin UI shell. The API (where guarded) still refuses, but SEC-008 means the direct DB writes do not. Not a standalone breach once SEC-008 is fixed.
- **Fix:** hydrate the role from `/api/auth/verify` on mount. Treat localStorage as a hint only.

#### SEC-015 — MEDIUM — Custom JWT implementation
- **Location:** [jwt.js:49-100](file:///e:/repos/dealer-portal-quotation/api/_lib/jwt.js#L49).
- **Evidence:** verification ignores the header `alg` and the `iss` claim; the cookie parser uses `decodeURI` and no length bound. The token is also accepted as a Bearer header. The positive side: timing-safe compare, a 32-char minimum secret, `HttpOnly; SameSite=Strict; Secure`.
- **Fix:** use `jose`. If you stay custom, verify `header.alg==='HS256'` and `payload.iss`. Shorten the TTL to 8 h with refresh.

#### SEC-016 — MEDIUM — CSP is Report-Only; nginx has no headers
- **Location:** [vercel.json:27](file:///e:/repos/dealer-portal-quotation/vercel.json#L27), [nginx.conf.template](file:///e:/repos/dealer-portal-quotation/nginx.conf.template).
- **Correction to your premise:** `vercel.json` **does** have HSTS, nosniff, X-Frame-Options, Referrer-Policy and Permissions-Policy. Only the CSP is Report-Only, with `'unsafe-inline' 'unsafe-eval'` and no R2, push, tesseract or Google Maps hosts. `nginx.conf.template` has none of them. Note that `/api` responses have no `Cache-Control: no-store` except storage-download.
- **Fix (vercel.json), replacing the Report-Only entry after a one-day report-only soak:**
```json
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev https://*.geoapify.com https://maps.googleapis.com; connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com https://api.geoapify.com https://maps.googleapis.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" },
{ "source": "/api/(.*)", "headers": [{ "key": "Cache-Control", "value": "no-store" }] }
```
`unsafe-eval` can only be dropped after confirming that html2pdf, three and tesseract (worker/wasm from CDN?) still work. UNVERIFIED, so test in Report-Only first.
- **Fix (nginx.conf.template), inside `server {}`:**
```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(self)" always;
add_header Content-Security-Policy "<same as above>" always;
location = /index.html { add_header Cache-Control "no-store"; }
```
Repeat the `add_header` lines inside the static-asset `location` block, since nginx drops inherited headers when a block adds its own.

#### SEC-017 — MEDIUM — TLS verification disabled for DB
- **Location:** [db.js:56](file:///e:/repos/dealer-portal-quotation/api/_lib/db.js#L56), `scripts/run_migrations.js`. `ssl: { rejectUnauthorized: false }`.
- **Fix:** download the Supabase CA and set `ssl: { ca: process.env.PG_CA, rejectUnauthorized: true }`. Use the transaction pooler (port 6543) on Vercel.

#### SEC-018 — MEDIUM — Public share token is weak and permanent
- **Location:** [002_rls_lockdown.sql:60](file:///e:/repos/dealer-portal-quotation/supabase/migrations/002_rls_lockdown.sql#L60) — `md5(id || clock_timestamp()::text || random()::text)`. The public endpoint is `/api/quotations?action=public`.
- **Impact:** md5 of a guessable id and timestamp plus `random()` is not a CSPRNG. Tokens have no expiry or revoke. The public view exposes customer name and prices.
- **Fix:** `share_token = encode(gen_random_bytes(18),'hex')`, a `share_expires_at` column, and enforce it in the handler.

#### SEC-019 — MEDIUM — Audit trail silently lost (bug)
- **Location:** [quotations.js:288](file:///e:/repos/dealer-portal-quotation/api/quotations.js#L288) inserts into `audit_log`, but the live table is `audit_logs`. The insert sits in `try {…}` and fails silently, so every quotation create/update/status audit entry is dropped.
- **Fix:** use `audit_logs` with its real column names (`supabase/migrations/009_audit_logs_comprehensive_schema_and_rls.sql`).

#### SEC-020 — MEDIUM — First-load weight (200 dealers on mobile)
- **Evidence:** build output: PWA precache 33 entries / **11 MB**, including `material-symbols-outlined.woff2` 3.9 MB, `sunvine_quotation_cover.png` 5.8 MB, `vendor-pdf` 984 kB (285 kB gz), `vendor-three` 556 kB, `index` 907 kB, `CreateQuotation` 600 kB. No sourcemaps in `dist` (good).
- **Impact:** a slow first install on 4G and heavy Vercel bandwidth.
- **Fix:** subset the icon font (`&icon_names=` Google URL, or a hand-picked SVG set). Convert the cover to WebP/JPG ≤300 kB. Exclude `png|jpg|woff2` from the precache glob and `three` and `pdf` from precache (lazy at runtime).

#### SEC-021 — MEDIUM — Security reports and internal notes tracked in a public repo
- **Evidence:** `git ls-files` includes `AUDIT_REPORT_V2.md`, which is in `.gitignore`, plus `AUDIT_REPORT.md`, `Sunvine_Merged_Audit_Report.md`, `HARDWARE_AUDIT_REPORT.md`, `PRICING_AND_DB_AUDIT_REPORT.md`, `HANDOVER_SR66_EMPTY_STATE_ISSUE.md`, `GIT_COMMITS_REPORT.md`, `docs/ROLLOUT.md`. Several describe live weaknesses and credentials locations.
- **Fix:** `git rm --cached` them and move to a private location.

#### SEC-022 — MEDIUM — Google Maps/Places keys shipped to the client
- **Evidence:** `VITE_GOOGLE_PLACES_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GEOAPIFY_API_KEY` are in the bundle by design. [googlePlacesNearbyService.js:10,62](file:///e:/repos/dealer-portal-quotation/src/services/googlePlacesNearbyService.js#L10) also reads the key from `localStorage`. `VITE_SLACK_CRASH_WEBHOOK_URL`, if set, makes the Slack webhook public: `hooks.slack.com` appears in `dist/assets/index-*.js` (the webhook value itself was not inspected).
- **Impact:** quota theft and billing abuse. Anyone can spam your Slack channel.
- **Fix:** restrict each key by HTTP referrer and API in Google Cloud. Move Slack posting to an `/api/report-error` handler with rate limiting.

#### SEC-023 — MEDIUM — Hardcoded fallbacks mask missing DB data
- **Location:** [AppContext.jsx:512-535, 566, 625-631](file:///e:/repos/dealer-portal-quotation/src/context/AppContext.jsx#L512), `defaultPresets.js`, [authLogin.js](file:///e:/repos/dealer-portal-quotation/api/_lib/authLogin.js) (`max_margin_cap_per_kw || 6000`).
- **Impact:** when the DB read fails, the UI silently shows stale or default prices, `ratePerWp: 18.00` kits and a default staff member, and quotes can be created from them. This violates the AGENTS.md database-first rule. See Phase 3 (HC-xx).
- **Fix:** on failure, show a blocking "pricing unavailable" state; do not fall back to prices.

#### SEC-024 — MEDIUM — Values that disagree across the codebase
- Subsidy fallback in `AllQuotations.jsx:312,1165` is `kw <= 2 ? 60000 : 78000`. The engine gives ₹69,000 for 2.5 kW (verified), while the admin list shows ₹78,000.
- Tier margins: `AppContext.jsx:663` uses diamond 6500 / platinum 5500, while `DealerManagement.jsx:315,1379,1649`, `PricingMaster.jsx:1986` and `authLogin.js` use 4500 default / 6000 cap.
- Flag threshold `marginPerKw > 6000` is hardcoded in `AllQuotations.jsx:1014,1167`, so a dealer with a custom cap is mis-flagged.
- **Fix:** one `system_settings` / `dealer_tiers` source (HC-03, HC-05).

#### SEC-025 — MEDIUM — Docker and CI
- Dockerfile: `nginx:alpine` runs master as root. There is no `/api` in this image, so a Docker deploy cannot authenticate at all. `npm ci || npm install` hides lockfile drift. `.dockerignore` lacks `.env*` and `*.md`, so a stray `.env` is copied into the build stage (`COPY . .`) and `VITE_*` baked in.
- CI: runs in parallel with the Vercel deploy and does not gate it. Actions are pinned to tags (`@v4`), not SHAs. No `npm audit`. The workflow triggers include `devlopment`, `development`, `dev` and `fix/*`. No `pull_request_target`, no secret leak.
- **Fix:** add `.env*` and `.git*` to `.dockerignore`. Use `nginxinc/nginx-unprivileged`. Add `npm audit --omit=dev --audit-level=high` to CI. Set Vercel "Required checks".

#### SEC-026 — LOW — Dependencies
- `npm audit`: 10 vulnerabilities (0 critical, 6 high, 2 moderate, 2 low). **All 6 highs are the dev/build chain** (`tailwindcss` 3.x → `braces`, `chokidar`, `fast-glob`, `micromatch`, `source-map-js`) and don't ship in the bundle. **Production-only (`--omit=dev`): 1 low**, `dompurify` (GHSA-6688-9rhm-gjv2, a transitive dependency of html2pdf/jspdf). Fix with `npm audit fix`.
- `pg`, `puppeteer-core`, `bcryptjs` are in `dependencies`/`devDependencies`. `pg` and `bcryptjs` run only in `/api`, which is correct. `puppeteer-core` is in devDependencies; confirm it is not imported by `api/` or `src/`.

#### SEC-027 — LOW — Public repo leaks internal addresses and staff ids
- `defaultPresets.js` holds the company GSTIN (`24…Z7`), bank account (`99…80`), IFSC and address. These are business data that appear on invoices anyway, but they belong in the DB (HC-01). `STF-DIRECT`, `STF-800` and `STF-003` ids are hardcoded in authorisation logic (SEC-013).

#### SEC-028 — LOW — Console and PII logging
- 2 `console.log` calls in `src`/`api`; the 14 `console.error` calls log error objects, not request bodies. No PII-in-URL pattern found. `ErrorBoundary.jsx:31` stores `sunvine_last_error` in localStorage, and the stack may include customer text; it is not sent anywhere except Slack. Low risk.

#### SEC-029 — LOW — XSS review
- No `dangerouslySetInnerHTML`, `eval` or `new Function` in `src`. `innerHTML=''` in `SolarStructure3DViewer.jsx:433` only clears a node. `window.open` calls build WhatsApp links with `encodeURIComponent`. PDF templates are React-rendered (escaped). One hardcoded WhatsApp number in `QuotationPreview.jsx:533` (HC-01). Upload checks: server-side MIME and extension allowlist and a 2 MB limit exist in `storage-presign.js:9-99`, but the type is client-declared and there is no magic-byte check. Tesseract assets are loaded from the default CDN without SRI (UNVERIFIED which URLs). Self-host them.

### Info (what is good)
- **INF-001:** `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `R2_*`, `VAPID_PRIVATE_KEY` do not appear in `dist/` (grep clean). `.gitignore` covers `.env` and `.env.*`. No real secrets found at HEAD (11 regex hits, all `.env.example` placeholders, env-built URLs or test fixtures).
- **INF-002:** `/api/quotations` does recompute GST, subsidy and margin cap server-side from a shared engine, enforces a status machine and scopes list/get/delete by `dealer_id`. The gaps are SEC-005 and SEC-006.
- **INF-003:** `npm run build` passes (0 errors) and `npm test` passes 20/20. No sourcemaps in `dist`.
- **INF-004:** the JWT secret is enforced (≥ 32 chars, the function fails closed). The auth cookie is `HttpOnly; SameSite=Strict; Secure`. Hashes are bcrypt, 13 of 13 checked.
- **INF-005:** the service worker runtime cache covers only JS chunks and fonts, so no authenticated API data is cached. `storage-download` sends `Cache-Control: private`.
- **INF-006:** `vercel.json` already carries HSTS, nosniff, X-Frame-Options, Referrer-Policy and Permissions-Policy.

---

### Phase 4 — Functional integrity

#### Quotation flow trace
1. **New quotation:** `CreateQuotation.jsx` (1.5 k lines on devlopment) pulls catalogue and presets from `/api/catalog` (cached 6–24 h in Redis) and `AppContext.hydrateAllFromSupabase`.
2. **Calculate:** the browser uses `src/utils/solarCalculations.js` and `src/shared/pricing/calculations.js`.
3. **Save:** `POST /api/quotations` recomputes on the server (SEC-005, SEC-006 apply).
4. **PDF:** `PDFTemplate.jsx` and `QuotationPreview.jsx` through html2pdf.
5. **Admin view:** `AllQuotations.jsx`.

**Does every price come from the DB?** Mostly for panel and inverter, but not for the other BOM lines (SEC-006), nor on DB failure (SEC-023). The subsidy slab constants and the 1440 kWh/kW yield are in code (HC-04, HC-07).

**Sample calculation** (executed against the real engine, `node`; illustrative rates):

| Step | Value |
|---|---|
| 10 × 550 Wp panels @ ₹18/Wp = 5,500 Wp | base ₹99,000 + GST 5% ₹4,950 = ₹103,950 |
| 1 × 5 kW inverter @ ₹35,000 | base ₹35,000 + GST 5% ₹1,750 = ₹36,750 |
| Gross turnkey (CGST+SGST split) | **₹140,700** |
| Dealer asks ₹60,000 margin = ₹10,909/kW. Cap ₹6,000/kW × 5.5 | capped to **₹33,000** (`marginExceeded=true`) |
| Total | **₹173,700** |
| Subsidy 5.5 kW residential (2×30,000 + 1×18,000, capped at 78,000) | ₹78,000 |
| **Net payable** | **₹95,700** |
| Tamper: `discount_amount=1e9` | total ₹0, net ₹0 |
| Tamper: panel line with id `panel_x`, rate ₹1, gst 0 | gross ₹10 |
| 2.5 kW subsidy: engine vs `AllQuotations` fallback | ₹69,000 vs ₹78,000 (disagree) |

The paise rounding is reasonable; the 22-item BOM drift test passes (≤ ₹2).

#### Other functional and scale findings
- **BUG-01** (see SEC-019): audit logging to a non-existent table.
- **BUG-02:** `generateQuotationId` falls back to a random hex id when the `next_quotation_seq` RPC fails (`quotations.js:~115`), so the numbering format and sequence become inconsistent silently. Check that the RPC exists on prod (UNVERIFIED).
- **BUG-03:** `getAllQuotations` falls back to anon `select('*').limit(100)` when the API is unreachable (`quotationService.js:47,96`), which both bypasses dealer scoping and exposes cost columns.
- **BUG-04:** no pagination on admin customer-file lists; `/api/quotations` list caps at 100 but the UI's `getAllQuotations(limit=100)` offers no paging. Unbounded `select *` appears on `dealer_accounts` and `staff_accounts` (`dealerService.js:22`, `staffService.js:11`).
- **Concurrency (200 dealers):** `db.js` creates a `pg.Pool` with `max: 10` per function instance. With Vercel autoscaling, 200 concurrent requests could open up to ~2,000 direct connections. Use the Supabase transaction pooler (port 6543, `pgbouncer=true`) and lower `max` to 1–3 per instance. Hobby-plan function limits are 10 s (60 s on Pro). `places-nearby.js` (881 lines) and the AI/OCR calls are the likeliest to time out, UNVERIFIED without load tests. The Redis catalogue cache (6–24 h) is a good fit for the 200-dealer read load, but no admin invalidation is wired for dealer rates.
- **Realtime:** the `devlopment` migration adds `supabase_realtime` for pricing tables, which leaks margins (SEC-004) and each tab holds a socket. No subscription clean-up was reviewed in depth (UNVERIFIED).
- **Double submit:** no idempotency key on save; combined with the server-generated id, a double click creates two quotations. Add a client-generated `request_id` with a unique index.
- **Offline/PWA:** the NetworkFirst JS cache and the 11 MB precache are OK for offline shell, but saves have no offline queue, and the `NetworkStatusBanner` is only informational (UNVERIFIED).
- **Tests:** `npm test` = 20 tests, all pass (`solarCalculations.test.js`, `securityAndWorkflow.test.js`). They cover subsidy tiers, GST aggregation, EMI, password hashing and margin-tier logic. They do **not** cover any `/api` handler authorisation, RLS, the discount/BOM tamper cases, ownership checks, the storage or push endpoints, or the UI.

---

## 5. Phase 3 — Hardcoded values → database

Existing tables I verified live (count only): `system_settings` (1 row; columns `company_profile`, `bank_details`, `terms_and_warranties`, `statutory_taxes`, `governance_settings`), `pricing_presets` (1), `dealer_custom_pricing` (4), `bom_catalog` (24), `bos_pricing_matrix` (15), `solar_modules` (8), `solar_inverters` (12), `document_master` (21). So most targets already have a home.

| ID | Value (masked where sensitive) | File:line | Should live in | Fetch / cache | Risk if left |
|---|---|---|---|---|---|
| HC-01 | Company name, GSTIN `24…Z7`, address, bank name, A/C `99…80`, IFSC, branch, email, tagline, notes | `src/data/defaultPresets.js:6-30` (`SUNVINE_OFFICIAL_PROFILE`), `:122-126` | `system_settings.company_profile`, `.bank_details` (exist) | `/api/catalog`, 6 h Redis + SWR in browser; PDF reads from context only | PDF shows stale bank or GSTIN if the DB is empty or a fetch fails |
| HC-02 | WhatsApp number, helpdesk `+91 80000 50580`, website | `QuotationPreview.jsx:533`, `PricingMaster.jsx:328`, `systemSettingsDefaults.js:13` | `system_settings.company_profile.{whatsapp,helpdesk,website}` | same | contact changes need a redeploy |
| HC-03 | Tier names and margins: default ₹4,500/kW, cap ₹6,000/kW, 6,500/5,500 variants | `DealerManagement.jsx:315,1379,1649,1833`; `PricingMaster.jsx:1986`; `AppContext.jsx:663`; `authLogin.js` (`|| 6000`); `quotations.js:~144` (`6000`); `calculations.js:190`; `AllQuotations.jsx:1014,1167` | `dealer_custom_pricing` (exists: `tier_id`, `default_margin_per_kw`, `max_margin_cap_per_kw`) | server loads once per request via `cacheAside` (60 s TTL, invalidated on admin save); **delete the fallbacks** | **already disagree** (4500/6000 vs 6500/5500); a wrong cap means a wrong margin |
| HC-04 | Subsidy rates `30000`/`18000`, cap `78000`, 3 kW breakpoint, residential/commercial rule | `calculations.js:22-24,34-47`; `AllQuotations.jsx:312,1165` (`60000 : 78000`) | `system_settings.statutory_taxes.subsidy` (JSON) | server passes into `calculateSubsidy` (the params already exist) | policy changes need a code release, and **AllQuotations disagrees with the engine** (SEC-024) |
| HC-05 | GST slabs 5/18/0 and the "default 18" | `calculations.js:127`; `quotations.js:175` (`[0,5,18]`) | `bom_catalog.gst_rate` per item; allowed set in `statutory_taxes` | per-item from catalogue (SEC-006 fix) | client can send gst 0 |
| HC-06 | Supplier state `Gujarat`, inter-state logic | `quotations.js:184,251`; `CreateQuotation.jsx` | `system_settings.company_profile.state` | with company profile | wrong CGST/SGST vs IGST outside Gujarat |
| HC-07 | Specific yield `1440` kWh/kW, tariff `6.67`, loan rate `8.5%`, tenure 5 | `calculations.js:222-223,255`; `quotations.js:185`; `solarCalculations.js` | `system_settings.governance_settings` (exists) | same cache | savings claims in customer PDFs can't be corrected quickly |
| HC-08 | Hardcoded kit presets `3.3/4.4/5.5 kW @ ₹18/Wp`, benchmark inverters (`inv-bm-1…`), BOS matrix defaults, `DEFAULT_PRICING_MASTER`, `DEFAULT_MODULES/INVERTERS` | `AppContext.jsx:542-592`; `defaultPresets.js`; `standardBomData.js` (625 lines on devlopment) | `pricing_presets`, `inverter_benchmark_matrix`, `bos_pricing_matrix`, `solar_kits_presets` | `/api/catalog` (cached); **no client fallback for prices** | silent stale prices (SEC-023) |
| HC-09 | Default BOM catalogue and categories, units, default rates `|| 100` | `standardBomData.js`; `AppContext.jsx:1266` (`defaultRate … || 100`) | `bom_catalog` (exists, 24 rows) | catalogue endpoint | a missing rate becomes ₹100 silently |
| HC-10 | Terms & warranties text, quotation validity "15 Days from generation…" | `defaultPresets.js:30+`; `PricingMaster.jsx:246` | `system_settings.terms_and_warranties` (+ `validity_days`) | with company profile | legal text not editable; the validity string is free text |
| HC-11 | Quotation number format `SV-<year>-Q<seq>` | `quotations.js:~110-125` | `system_settings.governance_settings.quote_prefix` + DB sequence | server | prefix change requires deploy; the random fallback breaks the sequence |
| HC-12 | `STF-DIRECT`, `STF-800`, `STF-003`, `'Direct to Company (HQ)'`, `city:'Ahmedabad'`, default staff `STF-801` | `DealerManagement.jsx:445-456`; `authLogin.js`; `AdminSettings.jsx:2381+` | `staff_accounts.is_verification boolean`; `system_settings.default_desk_id` | admin config | privilege decided by magic ids (SEC-013) |
| HC-13 | Default passwords `'admin123'`, seed `dea…23` | `authManage.js:454`; seeds in history | none, remove | n/a | account takeover (SEC-001/007) |
| HC-14 | Loan banks list (SBI, BoB, HDFC, ICICI, Canara) and bank data | `systemSettingsDefaults.js:45-50`; `solarBanksData.js` | `solar_banks` table (the `/api/catalog` `catalog:solar_banks` cache key already exists) | catalogue endpoint | static list |
| HC-15 | States/cities/DISCOMs, Gujarat DB (6,007 lines) | `gujaratDatabase.js`, `staffData.js` (`GUJARAT_CITIES_COORDS`) | `ref_locations(state, city, discom, lat, lon)` (post-launch; reference data, low change rate) | static JSON chunk, lazy | acceptable as static, but only Gujarat is covered |
| HC-16 | Mock/sample data: `DEFAULT_STAFF`, `DEFAULT_CUSTOMER_FILES`, `DEFAULT_NOTIFICATIONS` | `AppContext.jsx:20-21,618`; `staffData.js` | none, remove | n/a | `sunvine_current_staff` defaults to `DEFAULT_STAFF[0]` (a fake identity) when localStorage is empty |
| HC-17 | Required-documents lists, pipeline stages, doc rules, 2 MB / 14-day retention | `defaultRequiredDocuments.js`, `documentationPolicies.js`; `storage-presign.js:19`; `customer-files.js` | `document_master` (exists), `system_settings.governance_settings` (limits) | cached | limits need a deploy |
| HC-18 | Max kW `1000`, margin cap fallback `6000`, discount cap (missing) | `quotations.js:~96,~144` | `governance_settings.max_system_kw`, `.max_discount_pct` | server | no discount cap exists at all (SEC-006) |

**Reads from DB but falls back to a hardcoded value:** `AppContext.jsx:512-535` (all `DEFAULT_*` initial state), `authLogin.js` (`max_margin_cap_per_kw || 6000`), `quotations.js` (`maxMarginCapPerKw = 6000`, `peakSunHours || 1440`, `panel_watt || 550`, `supplier_state || 'Gujarat'`), `AppContext.jsx:1266` (`|| 100`), `calculations.js` (`DEFAULT_*`).

**Duplicated sources of truth:** subsidy (engine vs `AllQuotations`), tier margins (6 places), company profile (`defaultPresets.js` vs `system_settings.company_profile`), inverter prices (`solar_inverters.base_price` VARCHAR vs `base_price_inr` numeric, with the API parsing both), module rates (`rate_per_wp` VARCHAR vs `rate_per_wp_inr`).

### Hardcoded → DB migration plan (ordered)

| # | Item | Effort | Launch-blocking? |
|---|---|---|---|
| 1 | HC-13 remove default passwords and `admin123` | S | **Yes** |
| 2 | HC-05 + HC-18 + HC-09: server prices every BOM line from `bom_catalog`; discount cap from settings; drop `|| 100` | M | **Yes** (SEC-006) |
| 3 | HC-03 tier margins from `dealer_custom_pricing` only; remove 6000/4500/6500 literals; invalidate cache on admin save | M | **Yes** (SEC-012/024) |
| 4 | HC-04 subsidy params into `statutory_taxes`; fix the `AllQuotations` fallback to use the stored `subsidy_amount` only | S | **Yes** (wrong number in admin view) |
| 5 | HC-08/HC-16 remove price/identity fallbacks and mock staff from `AppContext`; show a blocking error when pricing is unavailable | M | **Yes** (SEC-023) |
| 6 | HC-01/02/06/10 company profile, bank, terms into `system_settings` (rows exist); `defaultPresets.js` keeps neutral placeholders only | M | No (data is already in DB); do it in week 1 |
| 7 | HC-07/11/17 yield, tariff, loan rate, quote prefix, upload limits into `governance_settings` | S | No |
| 8 | HC-12 `is_verification` column replaces magic staff ids | S | No (but fix SEC-013 first) |
| 9 | HC-14 `solar_banks` table, HC-15 `ref_locations` | M | No |

Schema additions needed (only where missing):
```sql
ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS is_verification boolean NOT NULL DEFAULT false;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS request_id uuid UNIQUE, ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;
CREATE TABLE IF NOT EXISTS public.solar_banks (id text PRIMARY KEY, name text NOT NULL, rate_pct numeric(5,2), active boolean DEFAULT true);
-- keep these RLS-enabled with NO anon policies; read through /api/catalog only
ALTER TABLE public.solar_banks ENABLE ROW LEVEL SECURITY;
```

---

## 6. PR review verdict (Phase 1)

- **Latest merge to `main`:** PR #26 `18765ae`, 2026-10-05, 14-day cancellation retention for customer files (migration `008`, `customer-files.js`).
- **Ahead of main, on `devlopment`:** 30 files, +4,780 / −2,276 lines.
  - `aca1e1a` (2026-10-06) "flexible structure types, freight presets, installation modes & locked BOM items" touches `CreateQuotation.jsx` (±1.5 k lines), `HardwareMaster.jsx` (±1.2 k), `AppContext.jsx`, `authManage.js`, `package.json` and adds `scripts/run_migrations.js`, `scripts/sync_inverters_from_sheet.js` and `update_modules_from_sheet.js`.
  - `1c1a35a` is the latest, a mobile-responsiveness UI fix, and it is safe on its own.
  - `supabase_realtime_pricing_migration.sql` is the dangerous addition (SEC-004).
- **PR #26 / `main`, review notes:**
  - ✅ The retention feature itself is reasonable.
  - ❌ `customer-files.js` update/cancel/restore have no ownership checks (SEC-011).
  - ❌ The status-machine and audit write target the wrong table (SEC-019).
  - ⚠️ `authManage.js` exposes the unauthenticated admin API (SEC-001); the latest commit's change to it (`email !== undefined` null handling) is harmless but touches the file without adding a guard.
- **Leftovers:** `HANDOVER_SR66…md`, `GIT_COMMITS_REPORT.md` and the new scripts that read Google Sheets and write directly to the DB with `pg` (`ssl.rejectUnauthorized:false`).
- **Verdict:**
  - **`main` (PR #26): NOT safe to ship as the launch build.** The blocking issues are pre-existing but unfixed.
  - **`devlopment`: NOT safe.** It adds SEC-004 and large unreviewed rewrites of the quotation screen. I could not UI-test them (build and unit tests pass only).
  - **Do not merge `devlopment` → `main` for tomorrow** unless the quotation changes are needed. Cherry-pick the security fixes onto the branch you deploy (`sumit-updates` per AGENTS.md; `main` per Vercel, UNVERIFIED which one Vercel builds for production).

---

## 7. Launch readiness checklist (Phase 5)

| Item | Status | Notes |
|---|---|---|
| Env vars per environment (`JWT_SECRET`, service role, `DATABASE_URL`, Upstash, R2, VAPID) | **UNVERIFIED** | Local `.env` has all keys; Vercel dashboard not inspectable. Redis is mandatory for rate limits (SEC-013). |
| `NODE_ENV=production` on all deployed functions | **UNVERIFIED** | The `isDev` auth bypass in storage handlers depends on it (SEC-009). |
| No dev/test data or test accounts in prod | **FAIL / UNVERIFIED** | The live DB has 8 dealers, 5 staff, 3 quotations. Seeded default passwords and RPC backdoor are in history. Review each account. |
| RLS / anon lockdown | **FAIL** | SEC-002. |
| Secrets rotated | **FAIL** | No evidence (SEC-007). |
| Backups / PITR | **UNVERIFIED** | Enable PITR (Pro plan) or a daily `pg_dump`. `scripts/rollout/backup.mjs` exists; verify a restore. |
| Error monitoring | **FAIL** | Only a Slack webhook from the client (SEC-022). Add Sentry or Vercel log drains. |
| Rate limits | **FAIL** | Upstash dependency unverified; per-account limit missing (SEC-013). |
| Custom domain + HTTPS + HSTS | **UNVERIFIED** | HSTS header is configured with `preload` before the domain is confirmed; do not submit to the preload list until the domain is final. |
| CORS origins | **FAIL** | Reflective on `authManage` and push; check the others (SEC-001/010). |
| Supabase Auth redirect/site URL, email settings | **N/A / UNVERIFIED** | The app uses custom JWT, not Supabase Auth; there is no email flow. Disable Supabase email signups: `/auth/v1/signup` is still reachable with the anon key. Test with the Appendix B probe. |
| CSP / security headers | **PARTIAL** | Present in `vercel.json` (CSP only Report-Only); absent in nginx (SEC-016). |
| Build + tests | **PASS** | Build 0 errors; 20/20 tests. |
| Dependency audit (prod) | **PASS** | 1 low. |
| Sourcemaps in prod | **PASS** | None. |
| Rollback plan | **UNVERIFIED** | Use Vercel "Instant Rollback" and keep the previous DB dump. The SQL in SEC-002 is not trivially reversible; take a `pg_dump` first. |
| Load test with 200 dealers | **FAIL (not done)** | Run k6 against `/api/quotations`, `/api/catalog`, login. |

---

## 8. Safe to fix post-launch (backlog)

1. Migrate the JWT to `jose`, add refresh tokens and an 8 h TTL (SEC-015).
2. Subset the icon font and compress images; trim the PWA precache (SEC-020).
3. Idempotency key on quotation save; offline queue.
4. `ref_locations` and `solar_banks` tables (HC-14/15).
5. Pagination and column projection for dealer, staff and customer-file lists; indexes on `quotations(dealer_id, created_at)`, `customer_files(dealer_id,status)`.
6. Magic-byte file validation; self-host tesseract assets (SEC-029).
7. CI: SHA-pinned actions, `npm audit`, gitleaks, Vercel required checks, nginx-unprivileged Docker image (SEC-025).
8. `tailwindcss` upgrade to clear the dev-chain highs (SEC-026).
9. Remove tracked audit/handover markdown from the public repo (SEC-021).
10. Replace the `dealers`/`admin_users`/`staff_users` compatibility views.
11. Consolidate the 6 root SQL files plus `supabase/migrations` into one ordered migration set (`006`, `007` are missing).

---

## 9. Coverage, commands, and limitations

See the **Coverage table** (generated from `git ls-files`) at the end of this document.

### Commands run (key outputs in Appendices)
`git branch -a -vv`, `git log --all`, `git diff --stat origin/main origin/devlopment`, `git ls-files`, `git grep -nIP <secret regexes>` (HEAD), `git log --all -p -G<url/jwt regexes>` (history), `git log --diff-filter=D --name-only`, `gh --version` (CLI present; I did not run `gh pr list`, so PR metadata comes from merge commits), `npm audit`, `npm audit --omit=dev`, `npm run build`, `npm test`, a grep of `dist/assets` for secret names, a Node run of `src/shared/pricing/calculations.js`, and the two anon probes (Appendix B).

### Limitations / UNVERIFIED
- **Not line-by-line for every file.** I deeply read the `/api` auth, quotation, storage and push handlers, the shared pricing engine, `jwt.js`, `security.js`, `db.js`, the RLS SQL, `vercel.json`, `nginx`, `Dockerfile`, CI, and the diffs of `devlopment`. The UI components (about 70 files, including `HardwareMaster.jsx`, `AdminSettings.jsx` at 2.6 k+ lines and `CreateQuotation.jsx`) were pattern-scanned (XSS sinks, hardcoded constants, supabase calls, localStorage), not read in full. The coverage table says which is which.
- **Live DB state:** inferred from anon probes only. I did not run a real write, did not read row values, and did not test the backdoor passwords. The `.env` project may not be production.
- **Gitleaks and trufflehog are not installed.** Only my own regexes ran (`.env.example` and URL/JWT shapes, `sb_secret_`, `AKIA`, `ghp_`, `sk-`, password literals). History coverage is limited to those patterns, so secrets in other formats could be missed. Run `gitleaks detect --log-opts="--all"` yourself.
- **Not testable here:** Vercel env and settings, Supabase dashboard (auth providers, storage buckets: the bucket list API returned `[]` for anon, which says nothing about private buckets), Upstash, R2 bucket policy, real PDF rendering, browser behaviour, and load.
- **`gh pr list` was not run;** PR #26 is identified from the merge commit.
- Tesseract and html2pdf CDN usage is UNVERIFIED (grep of `index.html` and the service config was not exhaustive).

---

## Appendix A — Direct Supabase call sites (browser)
24 `supabase.from()/rpc()` sites across `src/services/` (counted with `git grep -nE "supabase\s*\.\s*(from|rpc)\("`), covering `customer_files`, `dealer_accounts`, `staff_accounts`, `document_master`, `solar_modules`, `solar_inverters`, `bom_catalog`, `pricing_presets`, `bos_pricing_matrix`, `inverter_benchmark_matrix`, `dealer_custom_pricing`, `system_settings`, `quotations`, `audit_logs`, and the RPC `verify_user_credentials`.

## Appendix B — Anon-key probe (counts only, secrets and row values not printed)
```
host: wyb….co | anon key role claim: ? (publishable-style key, not a decodable JWT)
dealer_accounts 206 0-0/8      staff_accounts 206 0-0/5      admin_accounts 200 */0
quotations 206 0-0/3           customer_files 200 */0        audit_logs 206 0-0/7
otp_verifications 401          dealer_custom_pricing 206 /4  system_settings 200 /1
solar_modules 206 /8           solar_inverters 206 /12       bom_catalog 206 /24
dealers (view) 206 /8          staff_users (view) 206 /5     admin_users (view) 200 */0
PATCH(no-op filter) dealer_accounts / quotations / system_settings / solar_modules / dealer_custom_pricing → 204 each (inconclusive)
rpc verify_user_credentials(nonexistent user, wrong pw) → 200 "No registered dealer account found…"
columns (names, non-null counts): dealer_accounts.password_hash 8/8 bcrypt; staff_accounts.password_hash 5/5 bcrypt, access_code 5/5;
  quotations.customer_phone 3/3, base_cost 3/3, dealer_margin 3/3; audit_logs.user_email 7/7, ip_address 7/7
```
**Re-run after the fix:** `node <scratch>/probe.mjs` (written outside the repo). Pass criteria: dealer/staff/admin/quotation/audit/customer-file/otp requests return 401 or an empty result.

## Appendix C — Other outputs
```
npm audit: {"info":0,"low":2,"moderate":2,"high":6,"critical":0,"total":10}
  high: braces, chokidar, fast-glob, micromatch, tailwindcss(direct), source-map-js  (all dev/build chain)
npm audit --omit=dev: 1 low (dompurify GHSA-6688-9rhm-gjv2)
npm run build: ✓ built in 24.49 s; PWA precache 33 entries (11007 KiB); .map files in dist: 0
npm test: tests 20, pass 20, fail 0
dist secret-name grep: only hooks.slack.com / "Slack" in index-*.js (client crash reporter)
HEAD secret-regex hits: 11, all placeholders / env-assembled URLs / test fixtures (masked)
History hits: 7 commits (env-assembled URLs and templated DATABASE_URL strings),
  plus the literal DB password in the first version of scripts/seedAllDatabase.mjs (masked above)
```

---

## 10. Ready-to-paste FIX PROMPTS

> Run them in order. Each one is scoped. After prompts 1–2, re-run the Appendix B probe. Always run `npm run build` and `npm test` before committing. Commit only to `sumit-updates` and never push to `main`.

### Prompt 1 — Security / RLS / API authorisation (do first)
```
Context: Sunvine dealer portal. Read PRE_LAUNCH_AUDIT.md findings SEC-001..SEC-012 first.
Goal: close the unauthenticated and IDOR holes in /api and lock down Supabase RLS.

Do, in this order:
1. api/_lib/authManage.js: add a requireAdmin guard (verifyJwt from ./jwt.js; role must be 'admin'; read token from the sunvine_auth_token cookie or Bearer header). Remove the 'admin123' default; require password length >= 10. Replace reflective CORS with an allowlist from process.env.ALLOWED_ORIGINS (set Vary: Origin; Allow-Credentials only for allowed origins).
2. api/push-subscription.js and api/push-notify.js: require JWT; take user_id and role from the token; push-notify is admin/staff only; same CORS allowlist.
3. api/quotations.js handleSave: if body.quotation_id exists, load the row and 403 when role==='dealer' and dealer_id differs; only allow edits when status is Draft or Rejected. Clamp discount_amount to a max from system_settings.governance_settings.max_discount_pct (fallback: reject, not a literal). Price EVERY bom item from bom_catalog by id (reject unknown ids; GST from the catalogue; clamp qty 0..10000). Require panel_id for kit quotes. Fix the audit insert to use table audit_logs and its real columns.
4. api/customer-files.js: for dealers add .eq('dealer_id', jwt.dealer_id) to every get/update/cancel/restore; ignore client dealer_id unless admin.
5. api/storage-*.js: remove the isDev bypass (fail closed); ignore client 'bucket'; on presign prefix keys with `${role}/${ownerId}/`; download/delete must verify the prefix (dealer) or customer_files membership (staff/admin).
6. Write SQL file supabase/migrations/010_rls_lockdown_v2.sql (do NOT run it): drop all USING(true) policies except service_role, REVOKE anon/authenticated on dealer_accounts, staff_accounts, admin_accounts, audit_logs, otp_verifications, customer_files, notifications, push_subscriptions, quotations, system_settings, dealer_custom_pricing; REVOKE write on catalogue tables; drop public_read_by_share_token; drop verify_user_credentials (or revoke execute) and the views dealers/admin_users/staff_users after repointing api/quotations.js:150 to dealer_accounts.
7. Add node:test tests in src/utils/__tests__/ for: manage-credentials 403 without an admin token, quotation overwrite 403, discount clamp, unknown BOM id rejected, storage prefix check (mock the handlers' deps).

Acceptance: `npm run build` 0 errors; `npm test` passes incl. the new tests; unauthenticated POST to /api/auth/manage-credentials returns 403; a dealer token cannot overwrite another dealer's quotation_id; no 'admin123' string remains (git grep).
Do NOT touch: src/components/**, vercel.json, nginx.conf.template, Dockerfile, existing migrations 001-009, any .env file. Never print or commit secrets.
```

### Prompt 2 — Move browser writes behind the API, remove anon fallbacks
```
Context: PRE_LAUNCH_AUDIT.md SEC-008, SEC-003, SEC-023. Prerequisite: Prompt 1 merged.
Goal: the browser must hold read-only anon access to catalogue data and nothing else.

1. Create admin-guarded handlers (reuse the requireAdmin helper from Prompt 1; put it in api/_lib/requireAuth.js) for: dealers, staff, pricing (presets, bos matrix, bom catalog, dealer_custom_pricing, tier margins), hardware (solar_modules, solar_inverters), system_settings, audit logs. Use the existing service client (api/_lib/db.js). Methods restricted, JSON body validated, errors generic.
2. Rewrite src/services/{dealerService,staffService,pricingService,hardwareService,settingsService,systemSettingsService,documentMasterService,auditLogService,customerFileService,quotationService}.js so every write and all reads of accounts/quotations/customer files use fetch('/api/...', {credentials:'include'}). Delete the direct supabase.from(...).upsert/delete/insert calls and the quotationService select('*') fallback. Keep supabase-js only for read-only catalogue SELECTs.
3. Remove the RPC fallback in src/services/authService.js (verify_user_credentials and client bcrypt).
4. AppContext: hydrate role and auth from /api/auth/verify on mount, not from localStorage (localStorage is only a UI hint). On DB/API failure show a blocking "data unavailable" state; do not fall back to DEFAULT_* prices, mock staff (DEFAULT_STAFF) or demo customer files.

Acceptance: `git grep -nE "supabase\s*\.\s*(from|rpc)\([^)]*\)\s*\.(upsert|insert|update|delete)" -- src` returns nothing; npm run build 0 errors; npm test passes; manual smoke: admin edits a dealer margin cap and the dealer sees it on the next quote; hard refresh (Ctrl+Shift+R) keeps all data (database-first rule from AGENTS.md).
Do NOT touch: api/quotations.js (done in Prompt 1), CSS/layout, PDF templates, vercel.json, nginx, migrations.
```

### Prompt 3 — Hardcoded values → database
```
Context: PRE_LAUNCH_AUDIT.md section 5 (HC-01..HC-18). Prerequisites: Prompts 1-2.
Goal: single DB source of truth for business values; no silent price fallbacks.

1. Add supabase/migrations/011_governance_defaults.sql (idempotent, do not execute): extend system_settings JSON: statutory_taxes.subsidy {slab1Rate:30000, slab2Rate:18000, cap:78000, breakpointKw:3}, governance_settings {max_discount_pct, max_system_kw, quote_prefix, validity_days, default_specific_yield, default_tariff, default_loan_rate, upload_max_mb}, company_profile {whatsapp, helpdesk, website, state}; add staff_accounts.is_verification boolean; solar_banks table (RLS on, no anon policies).
2. Extend api/catalog.js (cacheAside 6h, existing pattern) to return these settings. Invalidate the Redis keys on every admin save in the new admin handlers.
3. Replace literals with DB values at: calculations.js (pass params; keep DEFAULT_* only as unit-test constants), api/quotations.js (max kW, discount cap, quote prefix, yield, supplier state, margin cap with NO `|| 6000` fallback: reject the request if the dealer cap is missing), api/_lib/authLogin.js (`|| 6000`), AllQuotations.jsx:312,1014,1165,1167 (use the stored subsidy_amount and the dealer's own cap), DealerManagement.jsx/PricingMaster.jsx/AppContext.jsx tier defaults 4500/6000/6500/5500, QuotationPreview.jsx:533 and PricingMaster.jsx:328 (WhatsApp/helpdesk), defaultPresets.js SUNVINE_OFFICIAL_PROFILE (read from system_settings; PDFTemplate takes it from context).
4. Replace the STF-800/STF-003 magic ids in authLogin.js with staff_accounts.is_verification.
5. Add a unit test proving subsidy and margin come from injected settings, and that a missing setting throws instead of defaulting.

Acceptance: `git grep -nE "\b(6000|78000|4500|6500|5500|1440)\b" -- src api ':!src/utils/__tests__' ':!src/data/gujaratDatabase.js'` returns only comments/test constants; build + tests pass; changing a value in system_settings changes the next quotation without a redeploy.
Do NOT touch: auth/RLS code from Prompts 1-2, gujaratDatabase.js, styles.
```

### Prompt 4 — Headers, infra, CI
```
Context: PRE_LAUNCH_AUDIT.md SEC-016, SEC-017, SEC-020, SEC-021, SEC-025, SEC-026.
1. vercel.json: change Content-Security-Policy-Report-Only to an enforcing Content-Security-Policy using the policy in SEC-016 (keep the existing HSTS/nosniff/XFO/Referrer/Permissions headers); add `Cache-Control: no-store` for /api/(.*). First deploy it as Report-Only for one preview and note any violations before enforcing; keep 'unsafe-eval' only if html2pdf/three/tesseract require it, and document why.
2. nginx.conf.template: add the same headers with `always`, repeated inside the static-asset location; index.html no-store.
3. Dockerfile: use nginxinc/nginx-unprivileged:alpine (port 8080), `npm ci` only (no `|| npm install`); .dockerignore: add .env*, *.md, supabase, scripts.
4. api/_lib/db.js and scripts/run_migrations.js: `ssl: { ca: process.env.PG_CA, rejectUnauthorized: true }` when PG_CA is set; document PG_CA and the pooler (6543) in .env.example (placeholders only). Lower the Pool max to 3.
5. .github/workflows/ci.yml: add `npm audit --omit=dev --audit-level=high`; pin actions to commit SHAs; add a gitleaks step (gitleaks/gitleaks-action pinned).
6. vite.config.js (VitePWA workbox): exclude png/jpg/woff2/three/pdf chunks from precache (globIgnores), keeping the offline app shell. Do not change runtimeCaching for /api (must stay uncached).
7. `git rm --cached` AUDIT_REPORT*.md, Sunvine_Merged_Audit_Report.md, HARDWARE_AUDIT_REPORT.md, PRICING_AND_DB_AUDIT_REPORT.md, HANDOVER_SR66_EMPTY_STATE_ISSUE.md, GIT_COMMITS_REPORT.md, docs/ROLLOUT.md and add them to .gitignore. Never remove PRE_LAUNCH_AUDIT.md.

Acceptance: npm run build 0 errors; `curl -I` on the preview shows CSP, HSTS and nosniff on / and no-store on /api/*; docker build succeeds and the container runs as non-root.
Do NOT touch: src/** business logic, api handlers other than db.js, supabase SQL.
```

### Prompt 5 — Functional bugs and scale
```
Context: PRE_LAUNCH_AUDIT.md Phase 4 and SEC-012, SEC-013, SEC-018, SEC-019.
1. api/_lib: create requireAuth.js that verifies the JWT and then re-reads the account status (dealer_accounts/staff_accounts, 60 s Redis cache); reject suspended/inactive. Use it in every handler. Invalidate `dealer:rates:<id>` in the admin save path and cut the cache TTL in quotations.js:148 to 60 s.
2. authLogin.js: single bcrypt.compare (async) on the exact password; one uniform "Invalid credentials" message; per-identifier limiter (5 failures / 15 min) in Redis; fail closed in production if UPSTASH_* is unset.
3. Quotation save idempotency: add `request_id uuid UNIQUE` (migration 012, do not execute), client sends crypto.randomUUID() per form session, server upserts on it. Fix generateQuotationId so a missing next_quotation_seq RPC is an error, not a random id.
4. Share links: share_token = gen_random_bytes(18) hex, share_expires_at column, enforce expiry in the public handler.
5. Pagination for dealer, staff and customer-file lists (limit/offset + column projection, no select *). Add indexes quotations(dealer_id, created_at DESC), customer_files(dealer_id, status).
6. Add a k6 script (scripts/loadtest/quotes.js) for login + /api/catalog + /api/quotations?action=list at 200 VUs. Do not run it against production without confirmation.

Acceptance: build + tests pass; a suspended dealer's next API call returns 403; two rapid saves with the same request_id produce one row; list endpoints return at most 100 rows.
Do NOT touch: UI styling, PDF templates, SQL already applied to prod, other migrations.
```

---

## Coverage table (generated from `git ls-files`, 224 files)

Legend: **Deep** = read and analysed for security/logic. **Scan** = pattern-scanned with grep (secrets, XSS sinks, hardcoded constants, DB calls, localStorage), not read line by line. **Skipped** = binary, image, font or lockfile. Findings = IDs from sections 4 and 5 that cite or involve the file (0 = none found, not proved clean).

| File | Reviewed | Depth | Findings |
|---|---|---|---|
| `.agentrules` | yes | Scan | 0 |
| `.agents/skills/ponytail/SKILL.md` | yes | Scan | 0 |
| `.agents/skills/ui-ux-pro-max/SKILL.md` | yes | Scan | 0 |
| `.cursorrules` | yes | Scan | 0 |
| `.dockerignore` | yes | Deep | 1 (SEC-025) |
| `.env.example` | yes | Deep | 0 |
| `.github/PULL_REQUEST_TEMPLATE.md` | yes | Scan | 0 |
| `.github/workflows/ci.yml` | yes | Deep | 1 (SEC-025) |
| `.gitignore` | yes | Deep | 0 |
| `AGENTS.md` | yes | Scan | 0 |
| `AUDIT_REPORT.md` | yes | Scan | 1 (SEC-021) |
| `AUDIT_REPORT_V2.md` | yes | Scan | 1 (SEC-021) |
| `Dockerfile` | yes | Deep | 1 (SEC-025) |
| `GEMINI.md` | yes | Scan | 0 |
| `GIT_COMMITS_REPORT.md` | yes | Scan | 1 (SEC-021) |
| `HANDOVER_SR66_EMPTY_STATE_ISSUE.md` | yes | Scan | 1 (SEC-021) |
| `HARDWARE_AUDIT_REPORT.md` | yes | Scan | 1 (SEC-021) |
| `LADDER_DEPLOYMENT_WORKFLOW.md` | yes | Scan | 0 |
| `PRICING_AND_DB_AUDIT_REPORT.md` | yes | Scan | 1 (SEC-021) |
| `PROJECT_RULEBOOK.md` | yes | Scan | 0 |
| `README.md` | yes | Scan | 0 |
| `REDIS_OPTIMIZATION_PLAN.md` | yes | Scan | 0 |
| `RESPONSIVE_UI_RULES.md` | yes | Scan | 0 |
| `Sunvine_Merged_Audit_Report.md` | yes | Scan | 1 (SEC-021) |
| `api/_lib/authLogin.js` | yes | Deep | 4 (SEC-012, SEC-013, HC-03, HC-12) |
| `api/_lib/authLogout.js` | yes | Deep | 0 |
| `api/_lib/authManage.js` | yes | Deep | 3 (SEC-001, SEC-021, HC-13) |
| `api/_lib/authVerify.js` | yes | Deep | 0 |
| `api/_lib/db.js` | yes | Deep | 1 (SEC-017) |
| `api/_lib/jwt.js` | yes | Deep | 1 (SEC-015) |
| `api/_lib/rateLimiter.js` | yes | Deep | 1 (SEC-013) |
| `api/_lib/redis.js` | yes | Deep | 0 |
| `api/_lib/security.js` | yes | Deep | 0 |
| `api/ai-analyze.js` | yes | Deep | 0 |
| `api/auth/[action].js` | yes | Deep | 1 (SEC-001) |
| `api/catalog.js` | yes | Deep | 0 |
| `api/customer-files.js` | yes | Deep | 1 (SEC-011) |
| `api/places-nearby.js` | yes | Deep | 0 |
| `api/push-notify.js` | yes | Deep | 1 (SEC-010) |
| `api/push-subscription.js` | yes | Deep | 1 (SEC-010) |
| `api/quotations.js` | yes | Deep | 6 (SEC-005, SEC-006, SEC-012, SEC-019, HC-03, HC-18) |
| `api/scrape-solar-leads.js` | yes | Deep | 0 |
| `api/storage-delete.js` | yes | Deep | 1 (SEC-009) |
| `api/storage-download.js` | yes | Deep | 1 (SEC-009) |
| `api/storage-presign.js` | yes | Deep | 1 (SEC-009) |
| `docs/ROLLOUT.md` | yes | Scan | 1 (SEC-021) |
| `index.html` | yes | Scan | 0 |
| `nginx.conf.template` | yes | Deep | 2 (SEC-016, SEC-025) |
| `package-lock.json` | no | Skipped (binary/lockfile) | 0 |
| `package.json` | yes | Deep | 1 (SEC-026) |
| `postcss.config.js` | yes | Scan | 0 |
| `public/dealer_avatar.jpg` | no | Skipped (binary/lockfile) | 0 |
| `public/favicon.ico` | no | Skipped (binary/lockfile) | 0 |
| `public/favicon.svg` | no | Skipped (binary/lockfile) | 0 |
| `public/fonts/inter-latin.woff2` | no | Skipped (binary/lockfile) | 0 |
| `public/fonts/material-symbols-outlined.woff2` | no | Skipped (binary/lockfile) | 0 |
| `public/fonts/space-grotesk-latin.woff2` | no | Skipped (binary/lockfile) | 0 |
| `public/manifest.json` | yes | Scan | 0 |
| `public/mirana.pdf` | no | Skipped (binary/lockfile) | 0 |
| `public/mirana_page1_original.jpg` | no | Skipped (binary/lockfile) | 0 |
| `public/pwa-192x192.png` | no | Skipped (binary/lockfile) | 0 |
| `public/pwa-512x512.png` | no | Skipped (binary/lockfile) | 0 |
| `public/robots.txt` | yes | Scan | 0 |
| `public/sitemap.xml` | yes | Scan | 0 |
| `public/solar_field_cover.jpg` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine-logo-darkmode.png` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine-logo-darkmode.webp` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine-logo.png` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine-logo.webp` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine_logo_transparent.png` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine_logo_transparent.webp` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine_logo_white.png` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine_logo_white.webp` | no | Skipped (binary/lockfile) | 0 |
| `public/sunvine_quotation_cover.png` | no | Skipped (binary/lockfile) | 0 |
| `public/sw-push.js` | yes | Scan | 0 |
| `public/sw.js` | yes | Deep | 0 |
| `scripts/createAccount.mjs` | yes | Scan | 0 |
| `scripts/executeSqlMigration.mjs` | yes | Scan | 0 |
| `scripts/inspect_audit_logs.mjs` | yes | Scan | 0 |
| `scripts/rollout/audit-accounts.mjs` | yes | Scan | 0 |
| `scripts/rollout/backup.mjs` | yes | Scan | 0 |
| `scripts/rollout/check-db.mjs` | yes | Scan | 0 |
| `scripts/rollout/db.mjs` | yes | Deep | 1 (SEC-017) |
| `scripts/rollout/execute-migration-001.mjs` | yes | Scan | 0 |
| `scripts/rollout/execute-migration-002.mjs` | yes | Scan | 0 |
| `scripts/rollout/local-smoke-test.mjs` | yes | Scan | 0 |
| `scripts/rollout/query.mjs` | yes | Scan | 0 |
| `scripts/rollout/runSql.mjs` | yes | Scan | 0 |
| `scripts/rollout/sync-real-pricing.mjs` | yes | Scan | 0 |
| `scripts/rollout/test-staff-fetch.mjs` | yes | Scan | 0 |
| `scripts/rollout/test-staff-upsert.mjs` | yes | Scan | 0 |
| `scripts/rollout/update-admin-mobile.mjs` | yes | Scan | 0 |
| `scripts/rollout/update-staff-passwords.mjs` | yes | Scan | 0 |
| `scripts/rollout/verify-anon-lockdown.mjs` | yes | Scan | 0 |
| `scripts/rollout/verify-staff-db.mjs` | yes | Scan | 0 |
| `scripts/runMigration.mjs` | yes | Scan | 0 |
| `scripts/run_all_migrations.mjs` | yes | Scan | 0 |
| `scripts/run_migrations.js` | yes | Deep | 2 (SEC-004, SEC-017) |
| `scripts/sync_inverters_from_sheet.js` | yes | Scan | 0 |
| `scripts/test_14_day_retention.mjs` | yes | Scan | 0 |
| `scripts/test_audit_log_insert.mjs` | yes | Scan | 0 |
| `scripts/updateDocumentRules.mjs` | yes | Scan | 0 |
| `scripts/update_modules_from_sheet.js` | yes | Scan | 0 |
| `src/App.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/AdminDashboard.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/AdminSettings.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/AllQuotations.jsx` | yes | Scan | 2 (SEC-024, HC-04) |
| `src/components/AdminPortal/AuditLogViewer.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/BusinessPerformance.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/DealerCustomPricingMatrix.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/DealerManagement.jsx` | yes | Scan | 3 (SEC-024, HC-03, HC-12) |
| `src/components/AdminPortal/HardwareMaster.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/PricingMaster.jsx` | yes | Scan | 4 (SEC-024, HC-02, HC-03, HC-10) |
| `src/components/AdminPortal/ReportsAnalytics.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/StaffManagement.jsx` | yes | Scan | 0 |
| `src/components/AdminPortal/SwipeableMetricCard.jsx` | yes | Scan | 0 |
| `src/components/Auth/AdminLogin.jsx` | yes | Scan | 0 |
| `src/components/Auth/DealerLogin.jsx` | yes | Scan | 0 |
| `src/components/Auth/StaffLogin.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/ConvertQuotationModal.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/CreateQuotation.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/DealerDashboard.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/DealerProfile.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/DealerSettings.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/MyApplications.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/MyQuotations.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/PDFTemplate.jsx` | yes | Scan | 0 |
| `src/components/DealerPortal/QuotationPreview.jsx` | yes | Scan | 2 (SEC-029, HC-02) |
| `src/components/Navigation.jsx` | yes | Scan | 0 |
| `src/components/PortalApp.jsx` | yes | Scan | 0 |
| `src/components/PublicQuotationView.jsx` | yes | Scan | 0 |
| `src/components/Shared/AppUpdateModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/CameraCaptureModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/CancelCustomerFileModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/ComingSoonPlaceholder.jsx` | yes | Scan | 0 |
| `src/components/Shared/CustomerFileDetailModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/DocumentPreviewModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/DocumentationHub.jsx` | yes | Scan | 0 |
| `src/components/Shared/EditCustomerFileModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/ErrorBoundary.jsx` | yes | Scan | 1 (SEC-028) |
| `src/components/Shared/GlobalActionLoader.jsx` | yes | Scan | 0 |
| `src/components/Shared/InteractiveImageRoofTracer.jsx` | yes | Scan | 0 |
| `src/components/Shared/LeadGenerationComingSoon.jsx` | yes | Scan | 0 |
| `src/components/Shared/NetworkStatusBanner.jsx` | yes | Scan | 0 |
| `src/components/Shared/NotificationPanel.jsx` | yes | Scan | 0 |
| `src/components/Shared/PanelLayoutVisualizer.jsx` | yes | Scan | 0 |
| `src/components/Shared/RooftopDesigner.jsx` | yes | Scan | 0 |
| `src/components/Shared/Skeleton.jsx` | yes | Scan | 0 |
| `src/components/Shared/SolarBankSelectorModal.jsx` | yes | Scan | 0 |
| `src/components/Shared/SolarStructure3DComingSoon.jsx` | yes | Scan | 0 |
| `src/components/Shared/SolarStructure3DViewer.jsx` | yes | Scan | 1 (SEC-029) |
| `src/components/Shared/StatusOverlaySystem.jsx` | yes | Scan | 0 |
| `src/components/Shared/Toast.jsx` | yes | Scan | 0 |
| `src/components/Shared/UpdateNotificationPopup.jsx` | yes | Scan | 0 |
| `src/components/Shared/ViewModeToggle.jsx` | yes | Scan | 0 |
| `src/components/Shared/ViewSkeleton.jsx` | yes | Scan | 0 |
| `src/components/SplashScreen.jsx` | yes | Scan | 0 |
| `src/components/StaffPortal/StaffDashboard.jsx` | yes | Scan | 0 |
| `src/components/StaffPortal/StaffFiles.jsx` | yes | Scan | 0 |
| `src/components/StaffPortal/StaffNewLead.jsx` | yes | Scan | 0 |
| `src/components/StaffPortal/StaffRadarMap.jsx` | yes | Scan | 0 |
| `src/components/StaffPortal/VerificationDesk.jsx` | yes | Scan | 0 |
| `src/config/version.js` | yes | Scan | 0 |
| `src/context/AppContext.jsx` | yes | Deep | 5 (SEC-014, SEC-023, SEC-024, HC-08, HC-16) |
| `src/context/LoadingContext.jsx` | yes | Scan | 0 |
| `src/data/defaultPresets.js` | yes | Deep | 5 (SEC-023, SEC-027, HC-01, HC-08, HC-10) |
| `src/data/defaultRequiredDocuments.js` | yes | Scan | 0 |
| `src/data/documentationPolicies.js` | yes | Scan | 0 |
| `src/data/gujaratDatabase.js` | yes | Scan | 1 (HC-15) |
| `src/data/solarBanksData.js` | yes | Scan | 1 (HC-14) |
| `src/data/staffData.js` | yes | Scan | 2 (HC-15, HC-16) |
| `src/data/standardBomData.js` | yes | Scan | 2 (HC-08, HC-09) |
| `src/data/systemSettingsDefaults.js` | yes | Deep | 2 (HC-02, HC-14) |
| `src/hooks/useHighAccuracyLocation.js` | yes | Scan | 0 |
| `src/index.css` | yes | Scan | 0 |
| `src/lib/supabase.js` | yes | Deep | 0 |
| `src/main.jsx` | yes | Scan | 1 (SEC-022) |
| `src/services/adminAccountService.js` | yes | Scan | 0 |
| `src/services/auditLogService.js` | yes | Scan | 1 (SEC-008) |
| `src/services/authService.js` | yes | Deep | 2 (SEC-003, SEC-008) |
| `src/services/bankService.js` | yes | Scan | 0 |
| `src/services/customerFileService.js` | yes | Scan | 1 (SEC-008) |
| `src/services/dealerService.js` | yes | Deep | 1 (SEC-008) |
| `src/services/documentMasterService.js` | yes | Scan | 1 (SEC-008) |
| `src/services/googlePlacesNearbyService.js` | yes | Scan | 1 (SEC-022) |
| `src/services/hardwareService.js` | yes | Scan | 1 (SEC-008) |
| `src/services/n8nSolarRadarService.js` | yes | Scan | 0 |
| `src/services/pricingService.js` | yes | Deep | 1 (SEC-008) |
| `src/services/pushNotificationService.js` | yes | Scan | 0 |
| `src/services/quotationService.js` | yes | Deep | 1 (SEC-008) |
| `src/services/settingsService.js` | yes | Scan | 1 (SEC-008) |
| `src/services/staffService.js` | yes | Deep | 1 (SEC-008) |
| `src/services/storageService.js` | yes | Scan | 0 |
| `src/services/systemSettingsService.js` | yes | Scan | 1 (SEC-008) |
| `src/shared/pricing/calculations.js` | yes | Deep | 4 (SEC-006, HC-04, HC-05, HC-07) |
| `src/utils/__tests__/securityAndWorkflow.test.js` | yes | Deep | 0 |
| `src/utils/__tests__/solarCalculations.test.js` | yes | Deep | 0 |
| `src/utils/aiRoofVisionEngine.js` | yes | Scan | 0 |
| `src/utils/cacheManager.js` | yes | Scan | 0 |
| `src/utils/documentUtils.js` | yes | Scan | 0 |
| `src/utils/mediaOptimizer.js` | yes | Scan | 0 |
| `src/utils/performanceAnalytics.js` | yes | Scan | 0 |
| `src/utils/quotationShare.js` | yes | Scan | 0 |
| `src/utils/solarCalculations.js` | yes | Scan | 0 |
| `src/utils/solarLayoutEngine.js` | yes | Scan | 0 |
| `sunvine-logo.svg` | no | Skipped (binary/lockfile) | 0 |
| `sunvine_logo_transparent.png` | no | Skipped (binary/lockfile) | 0 |
| `sunvine_logo_white.png` | no | Skipped (binary/lockfile) | 0 |
| `supabase/migrations/001_numeric_prices.sql` | yes | Scan | 0 |
| `supabase/migrations/002_rls_lockdown.sql` | yes | Deep | 2 (SEC-002, SEC-018) |
| `supabase/migrations/003_staff_and_dealer_sync.sql` | yes | Scan | 0 |
| `supabase/migrations/004_dealer_salesman_attribution.sql` | yes | Scan | 0 |
| `supabase/migrations/005_push_subscriptions.sql` | yes | Scan | 0 |
| `supabase/migrations/008_cancelled_files_14_day_retention.sql` | yes | Scan | 0 |
| `supabase/migrations/009_audit_logs_comprehensive_schema_and_rls.sql` | yes | Scan | 0 |
| `supabase/schema_current.sql` | yes | Scan | 0 |
| `supabase_extended_migration.sql` | yes | Scan | 0 |
| `supabase_full_migration.sql` | yes | Scan | 0 |
| `supabase_realtime_pricing_migration.sql` | yes | Deep | 2 (SEC-002, SEC-004) |
| `supabase_rename_account_tables.sql` | yes | Deep | 2 (SEC-002, SEC-003) |
| `supabase_schema.sql` | yes | Deep | 0 |
| `tailwind.config.js` | yes | Scan | 0 |
| `vercel.json` | yes | Deep | 1 (SEC-016) |
| `vite.config.js` | yes | Deep | 1 (SEC-020) |

**Totals:** Deep 49, Scan 151, Skipped 24 (of 224).

---

## Addendum - uncommitted working-tree changes seen during the audit

While this audit ran, `git status` showed edits that I did not make: modified `.env.example`, `api/push-notify.js` (+325 lines, adds Slack posting), `MyApplications.jsx`, `ErrorBoundary.jsx`, `AppContext.jsx`, `src/main.jsx`, `pushNotificationService.js`, and new untracked `src/services/crashReporter.js` and `slackNotificationService.js`. They are **not reviewed** here beyond a glance at the diff. Two things to check before committing them:

1. `.env.example` now lists `VITE_SLACK_CRASH_WEBHOOK_URL` and `VITE_SLACK_FILES_UPDATE`. Any `VITE_` variable is compiled into the public JS bundle, so a Slack webhook URL placed there is public (SEC-022). Use the non-`VITE_` `SLACK_FILES_UPDATE` and send from a server handler only.
2. `api/push-notify.js` is still unauthenticated (SEC-010); the new Slack code would let an anonymous caller trigger Slack messages with attacker-controlled text. Add the JWT check from Prompt 1 before merging.
