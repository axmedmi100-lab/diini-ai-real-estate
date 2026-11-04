import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Super Admin can safely manage agency users", () => {
  const migration = read("supabase/migrations/202611040003_platform_agency_user_management.sql");
  const actions = read("app/admin/agencies/actions.ts");
  const page = read("app/admin/agencies/[id]/page.tsx");

  assert.match(migration, /is_platform_super_admin\(\)/);
  assert.match(migration, /last active owner cannot be changed or disabled/);
  assert.match(migration, /plan_limit_reached:users/);
  assert.match(migration, /agency\.member_updated/);
  assert.match(migration, /revoke all on function public\.platform_update_agency_member/);
  assert.match(actions, /platform_update_agency_member/);
  assert.match(page, /get_platform_agency_members/);
  assert.match(page, /Agency users/);
});

