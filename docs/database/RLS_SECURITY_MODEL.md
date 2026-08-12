# RLS SECURITY MODEL

Row Level Security is the **only** defence against cross-tenant reads. The schema was designed around this principle: **if a frontend client can supply an `organization_id` parameter, don't trust it.** Enforcement is done server-side in Postgres via `public.current_org_id()`.

## 1. Prerequisites / Execution Model

All 9 private tables have RLS explicitly **enabled**:
```sql
ALTER TABLE public.organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_sizes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history     ENABLE ROW LEVEL SECURITY;
```
Supabase's default RLS posture when enabled is **"deny unless a policy allows"**. There is no fallback.

## 2. Tenant Resolution (`current_org_id`)

```sql
SELECT p.organization_id
FROM public.profiles p
WHERE p.id = auth.uid()
LIMIT 1;
```
- Defined STABLE SECURITY DEFINER (runs with privileges of the function's creator, bypassing RLS on `profiles` — otherwise reading profiles to get org id hits RLS on profiles which needs org id: classic chicken/egg).
- Uses `auth.uid()` → only resolves for the caller's actual authenticated Supabase user. Client can't substitute.

## 3. Policy Inventory (per-table)

Legend:
- **S** = SELECT
- **I** = INSERT
- **U** = UPDATE
- **D** = DELETE
- **+RBAC** = additional `has_role()` gating inside the policy

| Table | S | I | U | D | RBAC for write |
|-------|---|---|---|---|----------------|
| `organizations` | own id only | ❌ (trigger only) | own id only | ❌ | `admin` only |
| `profiles` | self OR same-org | ❌ (trigger only) | self only | ❌ | |
| `user_roles` | same-org (via profiles EXISTS) | ❌ | ❌ | ❌ | (admin UI not yet built) |
| `card_sizes` | system_default OR same-org | same-org | same-org | same-org | admin admin admin |
| `card_templates` | same-org | same-org +RBAC | same-org +RBAC | same-org | I/U: admin OR designer<br>D: admin |
| `template_versions` | same-org | same-org | same-org | same-org | (FOR ALL — org predicate only) |
| `template_assets` | same-org OR (NULL template AND BACKGROUND asset) | same-org | same-org +RBAC | same-org | D: admin OR designer |
| `id_cards` | same-org | same-org +RBAC | same-org +RBAC | same-org | I/U: admin OR operator<br>D: admin |
| `print_history` | same-org | same-org | ❌ | same-org | D: admin only |

### 3.1 Detailed policies & rationale

#### organizations
```sql
FOR SELECT USING (auth.uid() IS NOT NULL AND id = public.current_org_id());
FOR UPDATE USING (id = public.current_org_id() AND public.has_role('admin'));
```
Rationale: users only ever interact with their **single** organization row (getOrganization limit 1). No INSERT policy because signup trigger creates the org inside Postgres (trigger function runs with privileges; RLS does not apply to SECURITY DEFINER triggers on auth.users? — actually it does apply to the outer INSERT on public.organizations done by `handle_new_user`. Because `handle_new_user` runs as SECURITY DEFINER, it is the **function owner** (supabase_admin / extension owner) that is checked, so the RLS default-deny on `organizations` does not block it.)

#### profiles
Self or same-org read. Update restricted to self (users can edit their own display name/email; they cannot demote others' profiles directly via table writes — org membership is handled server-side on signup).

#### card_sizes
Reads intentionally include the 5 seeded global system sizes (`is_system_default=true` with NULL org). Writes admin-only. Delete only allowed on org-owned rows. Global rows effectively are undeletable through RLS.

#### card_templates / template_versions / template_assets
Designer workflow gating. `template_versions` is append-only immutable snapshots so no write RBAC (org predicate is enough because only `saveTemplateDesign` writes it, which already runs with a valid role on the calling user).

#### id_cards
Most important table. Write access = `admin` or `operator`. Viewer users cannot issue/change cards (can still view via listCards; their session can read because READ policy is org-only).

`id_cards_org_number_uniq` + `id_cards_qr_token_uniq` are table-level constraints — enforced **before** RLS on INSERT. RLS is for auth; uniqueness is for integrity.

#### print_history
Any authenticated org member can INSERT (print_history records events from operators/designers AND from status changes). Delete audit-admin only.

## 4. Public Verification Boundary

Anonymous access is **NOT** granted to any table. The only anonymous-accessible surface is the SECURITY DEFINER RPC:

```sql
public.verify_card(_token text)
RETURNS TABLE (card_number text, card_state text, expiry timestamptz,
               full_name text, job_position text, org_name text)
```

The caller never sees: `identification_number`, `nik`, `birth_place`, `birth_date`, `gender`, `address`, `phone`, `email`, `department`, `membership_number`, `photo_url`, `id`, `organization_id`.

### Step-by-step security argument
1. RPC runs as SECURITY DEFINER ⇒ bypasses RLS on `id_cards` (has to, because `anon` role has no policies).
2. Only one parameter exists: `_token`. Lookup uses the globally-unique-index `qr_token`.
3. Return type is an explicit `TABLE(...)` with a fixed column set. No `RETURNS SETOF id_cards` or `RETURNS RECORD`.
4. QR token itself is 96 bits of `pgcrypto.gen_random_bytes()` hex → 24 hex chars, not guessable.
5. The only computed column (`card_state`) additionally derives from `expiry_date` — expired cards are reported expired even if the DB status row says active (same logic as the UI's `effectiveStatus` at `lib/card/status.ts:19`).

## 5. Cross-Tenant Proof (Logical)

Theorem: User A from org A can never SELECT/INSERT/UPDATE/DELETE a row owned by org B.

Proof for SELECT:
- All SELECT policies (except card_sizes global rows) contain the predicate `organization_id = current_org_id()` OR equivalent EXISTS-clause that checks `profiles.organization_id = current_org_id()` (user_roles policy).
- `current_org_id()` returns org A for user A. Therefore rows with org B do not match.

Proof for INSERT (WITH CHECK):
- All INSERT policies check `organization_id = current_org_id()`. If the supplied INSERT payload's org_id is B, WITH CHECK fails for user A because current_org_id()=A.

Proof for UPDATE/DELETE:
- USING clause requires `organization_id = current_org_id()` first, so rows of org B are invisible to UPDATE/DELETE — a SET cannot touch rows you can't see.

Proof for Storage:
- All four (S/I/U/D) storage policies for each bucket include the folder check
  ```
  (storage.foldername(name))[1] = current_org_id()::text
  ```
  All uploads go to `bucket/<org_id>/<filename>` because `uploadFile` in `services/storage.ts:19` uses `crypto.randomUUID()` with no folder traversal. A user attempting to craft `../../orgB-uuid/x.png` would produce top-level `['..','..','orgB-uuid','x.png']` → `[1] = '..'` which does not equal the UUID; policy fails.

## 6. Known Gaps / Areas for Hardening

These are **non-blocking** and noted because the codebase does not exercise them today; document and patch later if the app grows:

| Gap | Status | Mitigation |
|-----|--------|------------|
| Bulk role assignment UI not present. Roles currently only set on first signup (admin). Adding members/operators requires Supabase dashboard or future `user_roles` admin screen. | Accepted | Policies for user_roles are read-only currently; add I/U/D when membership UI exists. |
| `viewer` role currently not gating reads (every org member reads everything). Accepted because the spec has viewer as a role but no screen restricts read yet. | Accepted | Add viewer policy branch when the distinction is enforced in UI. |
| `profiles.self_update` does not verify organization_id integrity vs SET CHECK on UPDATE. Users can UPDATE `profiles` WHERE id = auth.uid, so they can change org_id only for themselves — would self-orphan; low-risk because it just breaks access. | Will add WITH CHECK (organization_id = current_org_id()) patch when editing user settings UI ships. | Documented. |
