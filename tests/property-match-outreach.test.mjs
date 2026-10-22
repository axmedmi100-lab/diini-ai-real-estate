import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new available properties schedule deduplicated matched-lead outreach", async () => {
  const actions = await read("app/properties/actions.ts");
  const migration = await read("supabase/migrations/202610220005_property_match_outreach.sql");
  assert.match(actions, /schedule_property_match_outreach/);
  assert.ok(actions.match(/schedule_property_match_outreach/g).length >= 2);
  assert.match(migration, /follow_ups_property_lead_outreach_unique/);
  assert.match(migration, /coalesce\(cu\.follow_up_opted_out,false\)=false/);
  assert.match(migration, /l\.budget_max is null or property_record\.price<=l\.budget_max/);
  assert.match(migration, /on conflict \(property_id,lead_id,outreach_kind\)/);
});

test("district spelling aliases match the same area", async () => {
  const migration = await read("supabase/migrations/202610220006_property_match_district_aliases.sql");
  assert.match(migration, /canonical_district_key/);
  assert.match(migration, /when 'darusalaam' then 'daarusalaam'/);
  assert.match(migration, /canonical_district_key\(l\.district\)=public\.canonical_district_key\(property_record\.district\)/);
});

test("follow-up worker sends a property image when outreach has one", async () => {
  const worker = await read("app/api/cron/follow-ups/route.ts");
  const migration = await read("supabase/migrations/202610220005_property_match_outreach.sql");
  assert.match(worker, /sendWhatsAppImage/);
  assert.match(worker, /item\.property_image_url/);
  assert.match(migration, /p\.image_urls->>0/);
  assert.match(migration, /grant execute on function public\.claim_due_follow_ups\(integer\) to service_role/);
});

