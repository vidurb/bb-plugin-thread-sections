import assert from "node:assert/strict";
import { test } from "node:test";
import { createFakePluginHost, makeThreadResponse, experimental_scanPublicSdkOnly } from "@get-bb/plugin-sdk/testing";
import plugin from "./server.ts";

const rules = JSON.stringify({ proj_work: "sec_work" });
async function setup(config: { enabled?: boolean; rules?: string } = { rules }) {
  const threads = new Map<string, ReturnType<typeof makeThreadResponse>>();
  const updates: { threadId: string; sectionId?: string | null }[] = [];
  const sections = [{ id: "sec_work", name: "Work", createdAt: 0, updatedAt: 0 }];
  const { bb, harness } = createFakePluginHost({
    pluginId: "thread-sections", settings: config,
    sdk: {
      projects: { list: async () => [{ id: "proj_work", name: "My Project", kind: "standard", createdAt: 0, updatedAt: 0, gitRemoteUrl: null, sources: [] }] },
      threadSections: { list: async () => sections },
      threads: {
        get: async ({ threadId }) => {
          const thread = threads.get(threadId);
          if (!thread) throw new Error("Thread deleted");
          return thread;
        },
        list: async ({ projectId, offset = 0, limit = 100 } = {}) => [...threads.values()]
          .filter((thread) => thread.projectId === projectId && thread.sectionId === null && thread.archivedAt === null)
          .slice(offset, offset + limit),
        update: async (args) => {
          updates.push(args);
          const thread = threads.get(args.threadId)!;
          thread.sectionId = args.sectionId ?? null;
          return thread;
        },
      },
    },
  });
  if (config.rules) await bb.storage.kv.set("rules", JSON.parse(config.rules));
  plugin(bb);
  function add(id: string, overrides: Parameters<typeof makeThreadResponse>[0] = {}) {
    const thread = makeThreadResponse({ id, projectId: "proj_work", sectionId: null,
      archivedAt: null, deletedAt: null, visibility: "visible", ...overrides });
    threads.set(id, thread);
    return thread;
  }
  return { harness, threads, updates, sections, add };
}

test("empty rules leave threads alone", async (t) => {
  const f = await setup({}); t.after(() => f.harness.lifecycle.dispose());
  f.add("preinstall");
  await f.harness.lifecycle.install();
  assert.equal(f.harness.registrations.services.length, 0);
  await f.harness.behavior.emitThreadEvent("thread.created", { thread: f.add("empty") });
  assert.equal(f.updates.length, 0);
});

test("routes by project and retains pin state; duplicate events are idempotent", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  const thread = f.add("match", { pinnedAt: 123 });
  await f.harness.behavior.emitThreadEvent("thread.created", { thread });
  await f.harness.behavior.emitThreadEvent("thread.created", { thread });
  assert.deepEqual(f.updates, [{ threadId: "match", sectionId: "sec_work" }]);
  assert.equal(thread.pinnedAt, 123);
});

test("skips explicit placement, other projects, archived, hidden and deleted threads", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  for (const [id, overrides] of [
    ["placed", { sectionId: "sec_other" }], ["other", { projectId: "proj_other" }],
    ["archived", { archivedAt: 1 }], ["hidden", { visibility: "hidden" as const }],
    ["deleted", { deletedAt: 1 }],
  ] as const) {
    await f.harness.behavior.emitThreadEvent("thread.created", { thread: f.add(id, overrides) });
  }
  assert.deepEqual(f.updates, []);
});

test("re-reads stale event placement before moving", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  const stale = { ...f.add("stale") };
  f.threads.get("stale")!.sectionId = "sec_manual";
  await f.harness.behavior.emitThreadEvent("thread.created", { thread: stale });
  assert.equal(f.updates.length, 0);
});

test("dry-run and explicit apply cover multiple pages without skipping moved rows", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  for (let i = 0; i < 205; i++) f.add(`thread_${i}`);
  const preview = await f.harness.behavior.runCli(["apply", "--dry-run", "--json"]);
  assert.deepEqual(JSON.parse(preview.stdout!), { matched: 205, moved: 0, failed: 0, dryRun: true });
  assert.equal(f.updates.length, 0);
  await f.harness.behavior.runCli(["apply"]);
  assert.equal(f.updates.length, 205);
  assert.equal(f.harness.inspection.sdk.callsTo("threadSections.list").length, 2);
});

test("settings changes take effect without reloading; disabled suppresses routing", async (t) => {
  const f = await setup({}); t.after(() => f.harness.lifecycle.dispose());
  await f.harness.behavior.callRpc("setRule", { projectId: "proj_work", sectionId: "sec_work" });
  await f.harness.behavior.emitThreadEvent("thread.created", { thread: f.add("fresh") });
  await f.harness.behavior.setSettings({ enabled: false });
  await f.harness.behavior.emitThreadEvent("thread.created", { thread: f.add("off") });
  assert.equal(f.updates.length, 1);
  assert.equal(JSON.parse((await f.harness.behavior.runCli(["apply", "--json"])).stdout!).moved, 0);
});

test("CLI resolves exact names, rejects ambiguity and missing targets, and removes rules", async (t) => {
  const f = await setup({}); t.after(() => f.harness.lifecycle.dispose());
  const set = await f.harness.behavior.runCli(["set", "My Project", "Work", "--json"]);
  assert.equal(set.exitCode, 0);
  assert.deepEqual(JSON.parse(set.stdout!).rules, { proj_work: "sec_work" });
  assert.equal((await f.harness.behavior.runCli(["set", "My Project", "Missing"])).exitCode, 1);
  f.sections.push({ ...f.sections[0]!, id: "sec_duplicate" });
  assert.match((await f.harness.behavior.runCli(["set", "My Project", "Work"])).stderr!, /Ambiguous/);
  assert.equal((await f.harness.behavior.runCli(["remove", "proj_work"])).exitCode, 0);
  assert.deepEqual(JSON.parse((await f.harness.behavior.runCli(["list", "--json"])).stdout!).rules, {});
});

test("RPC rejects invalid input and unknown targets without changing rules", async (t) => {
  const f = await setup({}); t.after(() => f.harness.lifecycle.dispose());
  for (const input of [{ projectId: "", sectionId: "sec_work" }, { projectId: "proj_missing", sectionId: "sec_work" }, { projectId: "proj_work", sectionId: "sec_missing" }]) {
    await assert.rejects(() => f.harness.behavior.callRpc("setRule", input));
  }
  const state = await f.harness.behavior.callRpc("state", null) as { rules: object };
  assert.deepEqual(state.rules, {});
});

test("RPC rules persist across reload, support edits and remove deleted projects", async (t) => {
  const f = await setup({}); t.after(() => f.harness.lifecycle.dispose());
  await f.harness.behavior.callRpc("setRule", { projectId: "proj_work", sectionId: "sec_work" });
  const reloaded = await f.harness.lifecycle.reload(plugin);
  t.after(() => reloaded.harness.lifecycle.dispose());
  const state = await reloaded.harness.behavior.callRpc("state", null) as { rules: object; sections: { name: string }[] };
  assert.deepEqual(state.rules, { proj_work: "sec_work" });
  assert.equal(state.sections[0]!.name, "Work");
  await reloaded.harness.behavior.callRpc("removeRule", { projectId: "proj_work" });
  assert.deepEqual((await reloaded.harness.behavior.callRpc("state", null) as { rules: object }).rules, {});
});

test("missing sections fail visibly and do not stop other rules", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  f.add("missing"); f.sections.length = 0;
  const result = await f.harness.behavior.runCli(["apply", "--json"]);
  assert.equal(result.exitCode, 1);
  assert.equal(JSON.parse(result.stdout!).failed, 1);
  assert.equal(f.updates.length, 0);
});

test("project paging failures are reported and later projects still run", async (t) => {
  const f = await setup({ rules: JSON.stringify({ proj_missing: "sec_work", proj_bad: "sec_work", proj_work: "sec_work" }) });
  t.after(() => f.harness.lifecycle.dispose());
  f.add("valid");
  f.harness.sdk.stub("threads.list", async ({ projectId }) => {
    if (projectId !== "proj_work") throw new Error(projectId === "proj_missing" ? "Project not found" : "Page unavailable");
    return [...f.threads.values()];
  });
  const result = await f.harness.behavior.runCli(["apply", "--json"]);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(JSON.parse(result.stdout!), { matched: 1, moved: 1, failed: 2, dryRun: false });
  assert.equal(f.harness.logEntries.filter((entry) => entry.message.includes("Could not list threads")).length, 2);
});

test("install, upgrade, reload, pause and rule changes never sweep existing or missed threads", async (t) => {
  const f = await setup({ rules: JSON.stringify({ proj_work: "sec_work" }) });
  t.after(() => f.harness.lifecycle.dispose());
  const old = f.add("old");
  await f.harness.lifecycle.install();
  assert.equal(f.harness.registrations.services.length, 0);
  await f.harness.behavior.emitThreadEvent("thread.created", { thread: f.add("routed") });
  f.threads.get("routed")!.sectionId = null; // deliberately unsectioned
  await f.harness.behavior.setSettings({ enabled: false });
  await f.harness.behavior.emitThreadEvent("thread.created", { thread: f.add("paused") });
  const pausedReload = await f.harness.lifecycle.reload(plugin);
  assert.equal((await pausedReload.harness.behavior.callRpc("state", null) as { enabled: boolean }).enabled, false);
  assert.equal(f.updates.length, 1);
  await pausedReload.harness.behavior.setSettings({ enabled: true });
  f.sections.push({ ...f.sections[0]!, id: "sec_other", name: "Other" });
  await pausedReload.harness.behavior.callRpc("setRule", { projectId: "proj_work", sectionId: "sec_other" });
  f.add("missed"); // no event delivered while unloaded
  const reloaded = await pausedReload.harness.lifecycle.reload(plugin);
  t.after(() => reloaded.harness.lifecycle.dispose());
  assert.equal(reloaded.harness.registrations.services.length, 0);
  assert.equal(f.updates.length, 1);
  assert.equal(old.sectionId, null);
  const preview = await reloaded.harness.behavior.callRpc("apply", { dryRun: true }) as { matched: number };
  assert.equal(preview.matched, 4);
  await reloaded.harness.behavior.callRpc("apply", { dryRun: false });
  assert.equal(f.updates.length, 5);
});

test("reads bypass a blocked sweep and disposal stops it before the next move", async () => {
  const f = await setup();
  f.add("first"); f.add("second");
  let release!: () => void;
  let entered!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  f.harness.sdk.stub("threads.get", async ({ threadId }) => { entered(); await blocked; return f.threads.get(threadId)!; });
  const sweep = f.harness.behavior.callRpc("apply", { dryRun: false });
  await started;
  const reads = Promise.all([f.harness.behavior.callRpc("state", null), f.harness.behavior.runCli(["list"]), f.harness.behavior.runCli(["targets"])]);
  await Promise.race([reads, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("reads blocked")), 500))]);
  const dispose = f.harness.lifecycle.dispose();
  release();
  await Promise.all([sweep, dispose]);
  assert.equal(f.updates.length, 0);
});

test("pausing during a sweep stops pending moves", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  f.add("pending");
  let release!: () => void;
  let entered!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  f.harness.sdk.stub("threads.get", async ({ threadId }) => { entered(); await blocked; return f.threads.get(threadId)!; });
  const sweep = f.harness.behavior.callRpc("apply", { dryRun: false });
  await started;
  await f.harness.behavior.setSettings({ enabled: false });
  release();
  await sweep;
  assert.equal(f.updates.length, 0);
});

test("unarchived threads get their default section", async (t) => {
  const f = await setup(); t.after(() => f.harness.lifecycle.dispose());
  await f.harness.behavior.emitThreadEvent("thread.unarchived", { thread: f.add("restored") });
  assert.equal(f.updates.length, 1);
});

test("public SDK imports only", async () => {
  const scan = await experimental_scanPublicSdkOnly(new URL(".", import.meta.url).pathname, { allow: [/^react$/, /^vitest$/, /^@testing-library\/react$/] });
  assert.deepEqual(scan.violations, []);
  assert.deepEqual(scan.privateDependencies, []);
});
