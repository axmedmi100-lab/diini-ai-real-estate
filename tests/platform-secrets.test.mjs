import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("platform credential vault is service-role only", async () => {
  const sql = await read("supabase/migrations/202610150002_platform_integration_secrets.sql");
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on public\.platform_integration_secrets from anon, authenticated/i);
  assert.match(sql, /grant all on public\.platform_integration_secrets to service_role/i);
});

test("provider secrets are encrypted before storage and never rendered", async () => {
  const actions = await read("app/admin/integrations/actions.ts");
  const page = await read("app/admin/integrations/page.tsx");
  assert.match(actions, /encryptIntegrationSecret\(secret\)/);
  assert.doesNotMatch(page, /encrypted_value/);
  assert.match(page, /type="password"/);
});

test("OpenAI runtime prefers the encrypted platform vault", async () => {
  const credentials = await read("lib/integrations/platform-credentials.ts");
  const chat = await read("lib/ai/property-chat.ts");
  assert.match(credentials, /getPlatformIntegrationSecret\("openai"\)/);
  assert.match(chat, /await getOpenAIKey\(\)/);
});

test("property chat pins a supported model and retries structured-output failures", async () => {
  const chat = await read("lib/ai/property-chat.ts");
  assert.doesNotMatch(chat, /process\.env\.OPENAI_MODEL/);
  assert.match(chat, /model: "gpt-4o-mini"/);
  assert.match(chat, /chat\.completions\.create/);
  assert.match(chat, /response_format: \{ type: "json_object" \}/);
});

test("property search results only override replies for an explicit search intent", async () => {
  const chat = await read("lib/ai/property-chat.ts");
  const widgetRoute = await read("app/api/widget/chat/route.ts");
  assert.match(chat, /"greeting" \| "property_search" \| "capability" \| "general" \| "human_handoff"/);
  assert.match(widgetRoute, /requirement\.intent === "property_search"/);
});

