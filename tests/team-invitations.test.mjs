import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("team invitations send a Supabase Auth email with password setup", async () => {
  const actions = await read("app/agents/actions.ts");
  const confirm = await read("app/auth/confirm/route.ts");
  const password = await read("app/auth/set-password/page.tsx");
  assert.match(actions, /inviteUserByEmail/);
  assert.match(actions, /invitation_token: token/);
  assert.match(actions, /next=\/auth\/set-password/);
  assert.match(confirm, /requestedNext === "\/auth\/set-password"/);
  assert.match(password, /supabase\.auth\.getUser\(\)/);
  assert.match(password, /updateUser\(\{ password \}\)/);
});

test("owner can see invitation delivery status", async () => {
  const page = await read("app/agents/page.tsx");
  assert.match(page, /agency_invitations/);
  assert.match(page, /Accepted/);
  assert.match(page, /Pending/);
  assert.match(page, /Expired/);
});

