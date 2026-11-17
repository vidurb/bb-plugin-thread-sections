import { useEffect, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import { definePluginApp, experimental_Icon as Icon,
  experimental_useRpcQuery as useRpcQuery, useRpc } from "@get-bb/plugin-sdk/app";
import { rpcContract } from "./rpc";

function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 ${className}`} {...props} />;
}
const selectStyle = "min-h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

export function RulesSettings() {
  const query = useRpcQuery({ contract: rpcContract, method: "state", input: null });
  const rpc = useRpc<typeof rpcContract>();
  const { data } = query;
  const [projectId, setProjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rulesKey = JSON.stringify(Object.entries(data?.rules ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  useEffect(() => { setPreview(null); setDrafts({}); }, [rulesKey, data?.enabled]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null); setNotice("");
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  if (!data) return <div className="rounded-xl border p-6 text-sm text-muted-foreground" aria-busy={!query.error}>
    {query.error ? <><p role="alert">Couldn’t load your rules.</p><Button className="mt-3" onClick={() => void query.refetch()}>Try again</Button></> : "Loading your projects and sections…"}
  </div>;
  const projects = [...data.projects].sort((a, b) => a.name.localeCompare(b.name));
  const sections = [...data.sections].sort((a, b) => a.name.localeCompare(b.name));
  const rules = Object.entries(data.rules).sort(([a], [b]) =>
    (projects.find((p) => p.id === a)?.name ?? a).localeCompare(projects.find((p) => p.id === b)?.name ?? b));
  const availableProjects = projects.filter((p) => !data.rules[p.id]);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name;
  const sectionName = (id: string) => sections.find((s) => s.id === id)?.name;
  async function addRule(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await rpc.call("setRule", { projectId, sectionId });
      await query.refetch();
      setProjectId(""); setSectionId(""); setNotice("Rule added. New threads will go to this section.");
    });
  }
  return <div className="space-y-5" data-bb-plugin="thread-sections" data-bb-plugin-root="thread-sections">
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground"><Icon name="Folder" className="size-4" /></span>
          <div><h3 className="text-sm font-semibold">Project rules</h3><p className="mt-0.5 text-xs text-muted-foreground">A home for every new thread.</p></div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${data.enabled ? "bg-primary/5 text-foreground" : "bg-muted text-muted-foreground"}`}>
          <span className={`size-1.5 rounded-full ${data.enabled ? "bg-primary" : "bg-muted-foreground"}`} />{data.enabled ? "Routing on" : "Paused"}
        </span>
      </div>
      {rules.length === 0 ? <div className="px-6 py-9 text-center">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon name="ArrowRight" className="size-5" /></div>
        <p className="text-sm font-medium">Your threads, neatly sorted</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Choose a project and where its new threads should go. Several projects can share a section.</p>
      </div> : <ul className="divide-y">
        {rules.map(([id, target]) => <li key={id} aria-busy={busy} className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={projectName(id) ?? id}>{projectName(id) ?? "Deleted project"}</span>
            <Icon name="ArrowRight" className="size-4 shrink-0 text-muted-foreground" />
            <label className="min-w-0 flex-1"><span className="sr-only">Section for {projectName(id) ?? id}</span>
              <select className={selectStyle} value={drafts[id] ?? target} disabled={busy || !projectName(id)} onChange={(e) => setDrafts((current) => ({ ...current, [id]: e.target.value }))}>
                {!sectionName(target) && <option value={target}>Section unavailable</option>}
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          {projectName(id) && <Button disabled={busy || !drafts[id] || drafts[id] === target} aria-label={`Save section for ${projectName(id)}`} onClick={() => void run(async () => {
            await rpc.call("setRule", { projectId: id, sectionId: drafts[id]! }); await query.refetch(); setNotice("Section updated.");
          })}>Save</Button>}
          <Button className="shrink-0 border-transparent text-muted-foreground hover:text-destructive" disabled={busy}
            aria-label={`Remove rule for ${projectName(id) ?? "deleted project"}`} onClick={() => void run(async () => {
              await rpc.call("removeRule", { projectId: id }); await query.refetch(); setNotice("Rule removed. Existing threads stay where they are.");
            })}><Icon name="Trash2" className="size-4" /><span className="sr-only">Remove</span></Button>
          {(!projectName(id) || !sectionName(target)) && <p className="w-full text-xs text-destructive">{!projectName(id) ? "This project is unavailable. Remove the rule." : "This section is unavailable. Choose another section and save, or remove the rule."}</p>}
        </li>)}
      </ul>}
      <form onSubmit={(event) => void addRule(event)} className="space-y-3 border-t bg-muted/20 px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground">ADD A RULE</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1.5"><span className="text-xs font-medium">Project</span>
            <select className={selectStyle} required value={projectId} disabled={busy || !availableProjects.length} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{availableProjects.length ? "Choose a project…" : "All projects have a rule"}</option>
              {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="min-w-0 flex-1 space-y-1.5"><span className="text-xs font-medium">Send new threads to</span>
            <select className={selectStyle} required value={sectionId} disabled={busy || !sections.length} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Choose a section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={busy || !projectId || !sectionId} className="min-h-10 shrink-0 border-primary bg-primary text-primary-foreground hover:bg-primary/90"><Icon name="Plus" className="size-4" />Add rule</Button>
        </div>
        {!sections.length && <p className="text-xs text-muted-foreground">Create a section in the sidebar, then refresh to find it here.</p>}
      </form>
    </div>

    <div className="flex flex-col gap-4 rounded-xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-medium">Sort existing threads</p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Preview threads with no section, then apply your rules. Threads already in a section stay where they are.</p></div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {preview !== null && preview > 0 && <Button disabled={busy || !data.enabled} className="border-primary bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => void run(async () => {
          const result = await rpc.call("apply", { dryRun: false });
          setPreview(null); setNotice(`${result.moved} ${result.moved === 1 ? "thread" : "threads"} moved.${result.failed ? ` ${result.failed} threads or project rules failed; check the plugin logs.` : ""}`);
        })}>Move {preview} {preview === 1 ? "thread" : "threads"}</Button>}
        <Button disabled={busy || !data.enabled || !rules.length} onClick={() => void run(async () => {
          const result = await rpc.call("apply", { dryRun: true }); setPreview(result.matched);
          setNotice(result.failed ? `${result.failed} threads or project rules could not be checked. Check the plugin logs and repair unavailable rules.` : result.matched ? `${result.matched} ${result.matched === 1 ? "thread is" : "threads are"} ready to move.` : "All caught up. No threads need moving.");
        })}>Preview</Button>
      </div>
    </div>
    {(error || query.error) && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error ?? query.error?.message}</p>}
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{notice}</p>
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <p>Save destination changes in each row. Existing section choices are preserved.</p>
      <Button className="min-h-7 border-transparent px-2 py-1 text-xs" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>Refresh</Button>
    </div>
  </div>;
}

export default definePluginApp((app) => {
  app.slots.settingsSection({ id: "project-rules", component: RulesSettings });
});
