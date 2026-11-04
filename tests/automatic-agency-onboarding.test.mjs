import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Super Admin creates an agency and owner invitation atomically", async () => {
  const [migration, actions, page, detail, invitations] = await Promise.all([
    read("supabase/migrations/202611040001_automatic_agency_owner_onboarding.sql"),
    read("app/admin/agencies/actions.ts"),
    read("app/admin/agencies/page.tsx"),
    read("app/admin/agencies/[id]/page.tsx"),
    read("supabase/migrations/202610080001_team_invitations_and_handoff_assignment.sql"),
  ]);
  assert.match(migration, /is_platform_super_admin\(\)/);
  assert.match(migration, /'owner'/);
  assert.match(migration, /digest\(raw_token,'sha256'\)/);
  assert.match(migration, /security definer set search_path = ''/);
  assert.match(migration, /revoke all on function public\.platform_create_agency_with_owner_invite/);
  assert.match(actions, /randomBytes\(32\)/);
  assert.match(actions, /platform_create_agency_with_owner_invite/);
  assert.match(actions, /inviteUserByEmail/);
  assert.match(page, /Owner email/);
  assert.match(detail, /CopyInviteLink/);
  assert.match(invitations, /if target_role = 'owner' then raise exception/);
});

