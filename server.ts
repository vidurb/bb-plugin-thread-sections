import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { rpcContract, rulesSchema } from "./rpc.ts";

function resolveTarget(items: { id: string; name: string }[], value: string, kind: string) {
  const exactId = items.find((item) => item.id === value);
  if (exactId) return exactId.id;
  const matches = items.filter((item) => item.name === value);
  if (matches.length !== 1) throw new Error(
    matches.length ? `Ambiguous ${kind} name: ${value}. Use its ID.` : `Unknown ${kind}: ${value}.`,
  );
  return matches[0]!.id;
}

export default function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    enabled: { type: "boolean", label: "Automatically file threads", default: true },

  });
  async function getConfig() {
    const { enabled } = await settings.get();
    const rules = rulesSchema.parse((await bb.storage.kv.get("rules")) ?? {});
    return { enabled, rules };
  }
  async function saveRules(rules: Record<string, string>) {
    await bb.storage.kv.set("rules", rulesSchema.parse(rules));
    bb.rpc.experimental_invalidate(["rules"]);
  }
  settings.onChange(() => bb.rpc.experimental_invalidate(["rules"]));
  let disposed = false;
  let tail: Promise<unknown> = Promise.resolve();
  // Serialize sweeps, event handlers and rule edits within this generation.
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(work);
    tail = result.catch(() => {});
    return result;
  }
  bb.onDispose(async () => { disposed = true; await tail; });

  async function route(threadId: string, dryRun = false): Promise<boolean> {
    if (disposed) return false;
    const config = await getConfig();
    if (!config.enabled) return false;
    const rules = config.rules;
    if (!Object.keys(rules).length) return false;
    // Re-read immediately before moving: the creation event may be stale.
    const thread = await bb.sdk.threads.get({ threadId });
    const sectionId = rules[thread.projectId];
    if (!sectionId || thread.sectionId !== null || thread.archivedAt !== null ||
        thread.deletedAt !== null || thread.visibility === "hidden") return false;
    const sections = await bb.sdk.threadSections.list();
    if (!sections.some((section) => section.id === sectionId)) {
      throw new Error(`Rule for ${thread.projectId} points to missing section ${sectionId}; update or remove it.`);
    }
    if (disposed) return false;
    if (!dryRun) await bb.sdk.threads.update({ threadId, sectionId });
    return true;
  }

  async function apply(dryRun = false, signal?: AbortSignal) {
    const config = await getConfig();
    const result = { matched: 0, moved: 0, failed: 0, dryRun };
    if (!config.enabled || disposed) return result;
    for (const projectId of Object.keys(config.rules)) {
      // Finish paging before writes, since moving threads may change list order.
      const ids = new Set<string>();
      for (let offset = 0; !disposed && !signal?.aborted; offset += 100) {
        const page = await bb.sdk.threads.list({ projectId, archived: false,
          unsectioned: true, limit: 100, offset, signal });
        for (const thread of page) ids.add(thread.id);
        if (page.length < 100) break;
      }
      for (const id of ids) {
        if (disposed || signal?.aborted) return result;
        try {
          if (await route(id, dryRun)) {
            result.matched++;
            if (!dryRun) result.moved++;
          }
        } catch (error) {
          result.failed++;
          bb.log.warn(`Could not file thread ${id}: ${String(error)}`);
        }
      }
    }
    return result;
  }

  bb.events.on("thread.created", ({ thread }) => enqueue(async () => { await route(thread.id); }));
  bb.events.on("thread.unarchived", ({ thread }) => enqueue(async () => { await route(thread.id); }));
  // Catch events missed while the plugin was unloaded. No polling or timers.
  bb.background.service("catch-up", { async start(signal) { await enqueue(() => apply(false, signal)); } });

  bb.rpc.register(rpcContract, {
    state: () => enqueue(async () => {
      const [config, projects, sections] = await Promise.all([
        getConfig(), bb.sdk.projects.list({ includePersonal: true }), bb.sdk.threadSections.list(),
      ]);
      return { ...config, projects: projects.map(({ id, name }) => ({ id, name })),
        sections: sections.map(({ id, name }) => ({ id, name })) };
    }),
    setRule: ({ projectId, sectionId }) => enqueue(async () => {
      const projects = await bb.sdk.projects.list({ includePersonal: true });
      const sections = await bb.sdk.threadSections.list();
      if (!projects.some((project) => project.id === projectId)) throw new Error("Project no longer exists. Refresh and choose another project.");
      if (!sections.some((section) => section.id === sectionId)) throw new Error("Section no longer exists. Refresh and choose another section.");
      await saveRules({ ...(await getConfig()).rules, [projectId]: sectionId });
      return { saved: true as const };
    }),
    removeRule: ({ projectId }) => enqueue(async () => {
      const rules = (await getConfig()).rules;
      delete rules[projectId];
      await saveRules(rules);
      return { removed: true as const };
    }),
    apply: ({ dryRun }) => enqueue(() => apply(dryRun)),
  });

  const usage = [
    "bb thread-sections targets [--json]",
    "bb thread-sections list [--json]",
    "bb thread-sections set <project-name-or-id> <section-name-or-id> [--json]",
    "bb thread-sections remove <project-name-or-id> [--json]",
    "bb thread-sections apply [--dry-run] [--json]",
  ].join("\n");
  bb.cli.register({
    name: "thread-sections", summary: "File threads in sections by project",
    commands: [
      { name: "targets", summary: "List project and section names and IDs", usage: usage.split("\n")[0]! },
      { name: "list", summary: "Show configured rules", usage: usage.split("\n")[1]! },
      { name: "set", summary: "Set a project's default section", usage: usage.split("\n")[2]! },
      { name: "remove", summary: "Remove a project's rule", usage: usage.split("\n")[3]! },
      { name: "apply", summary: "File existing unsectioned threads", usage: usage.split("\n")[4]! },
    ],
    run: (argv) => enqueue(async () => {
      const json = argv.includes("--json");
      const args = argv.filter((arg) => arg !== "--json");
      const [command, ...values] = args;
      const reply = (data: unknown) => ({ exitCode: 0, stdout: JSON.stringify(data, null, json ? undefined : 2) });
      try {
        if (!command || command === "help" || command === "--help") return { exitCode: 0, stdout: usage };
        if (command === "list" && !values.length) {
          const config = await getConfig();
          return reply({ enabled: config.enabled, rules: config.rules });
        }
        if (command === "targets" && !values.length) {
          const [projects, sections] = await Promise.all([
            bb.sdk.projects.list({ includePersonal: true }), bb.sdk.threadSections.list(),
          ]);
          return reply({ projects: projects.map(({ id, name }) => ({ id, name })),
            sections: sections.map(({ id, name }) => ({ id, name })) });
        }
        if ((command === "set" && values.length === 2) || (command === "remove" && values.length === 1)) {
          const projects = await bb.sdk.projects.list({ includePersonal: true });
          const projectId = resolveTarget(projects, values[0]!, "project");
          const rules = (await getConfig()).rules;
          if (command === "set") {
            const sections = await bb.sdk.threadSections.list();
            rules[projectId] = resolveTarget(sections, values[1]!, "section");
          } else delete rules[projectId];
          await saveRules(rules);
          return reply({ rules });
        }
        if (command === "apply" && (values.length === 0 || (values.length === 1 && values[0] === "--dry-run"))) {
          const result = await apply(values[0] === "--dry-run");
          return { ...reply(result), exitCode: result.failed ? 1 : 0 };
        }
        return { exitCode: 1, stderr: usage };
      } catch (error) { return { exitCode: 1, stderr: String(error) }; }
    }),
  });
}
