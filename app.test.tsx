// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

import { rpcContract } from "./rpc";

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
const initial = { enabled: true, rules: {} as Record<string, string>,
  projects: [{ id: "proj_one", name: "Website" }, { id: "proj_two", name: "App" }],
  sections: [{ id: "sec_work", name: "Work" }, { id: "sec_personal", name: "Personal" }] };
async function mount(overrides: Partial<typeof initial> = {}, failSave = false) {
  const state = structuredClone({ ...initial, ...overrides });
  const writes: unknown[] = [];
  const app = await loadPluginApp(() => import("./app"));
  const slot = renderSlot(app.settingsSections[0]!, {}, { pluginId: "thread-sections", rpc: {
    state: () => structuredClone(state),
    setRule: (value: unknown) => {
      const input = rpcContract.setRule.input.parse(value);
      if (failSave) throw new Error("Could not save rule");
      state.rules[input.projectId] = input.sectionId; writes.push(input); return { saved: true };
    },
    removeRule: (value: unknown) => { const { projectId } = rpcContract.removeRule.input.parse(value); delete state.rules[projectId]; return { removed: true }; },
    apply: (value: unknown) => { const { dryRun } = rpcContract.apply.input.parse(value); writes.push({ dryRun }); return { matched: 2, moved: dryRun ? 0 : 2, failed: 0, dryRun }; },
  } });
  cleanups.push(() => slot.lifecycle.unmount());
  await slot.findByText("Project rules");
  return { slot, state, writes };
}

test("adds a named rule using dropdowns without JSON", async () => {
  const { slot, writes } = await mount();
  expect(slot.queryByRole("textbox")).toBeNull();
  fireEvent.change(slot.getByLabelText("Project"), { target: { value: "proj_one" } });
  fireEvent.change(slot.getByLabelText("Send new threads to"), { target: { value: "sec_work" } });
  fireEvent.click(slot.getByRole("button", { name: "Add rule" }));
  await slot.findByLabelText("Section for Website");
  expect(writes).toEqual([{ projectId: "proj_one", sectionId: "sec_work" }]);
});

test("edits a section inline and removes the rule", async () => {
  const { slot, writes } = await mount({ rules: { proj_one: "sec_work" } });
  fireEvent.change(slot.getByLabelText("Section for Website"), { target: { value: "sec_personal" } });
  expect(writes).toEqual([]);
  fireEvent.click(slot.getByRole("button", { name: "Save section for Website" }));
  await slot.findByText("Section updated.");
  expect(writes).toEqual([{ projectId: "proj_one", sectionId: "sec_personal" }]);
  fireEvent.click(slot.getByRole("button", { name: "Remove rule for Website" }));
  await slot.findByText("Your threads, neatly sorted");
});

test("previews before moving and reports the result", async () => {
  const { slot, writes } = await mount({ rules: { proj_one: "sec_work" } });
  expect(slot.queryByRole("button", { name: "Move 2 threads" })).toBeNull();
  fireEvent.click(slot.getByRole("button", { name: "Preview" }));
  fireEvent.click(await slot.findByRole("button", { name: "Move 2 threads" }));
  await slot.findByText("2 threads moved.");
  expect(writes).toEqual([{ dryRun: true }, { dryRun: false }]);
});

test("shows save failure without losing selections", async () => {
  const { slot } = await mount({}, true);
  fireEvent.change(slot.getByLabelText("Project"), { target: { value: "proj_one" } });
  fireEvent.change(slot.getByLabelText("Send new threads to"), { target: { value: "sec_work" } });
  fireEvent.click(slot.getByRole("button", { name: "Add rule" }));
  expect((await slot.findByRole("alert")).textContent).toContain("Could not save rule");
  expect((slot.getByLabelText("Project") as HTMLSelectElement).value).toBe("proj_one");
});

test("disabled routing and missing sections have clear states", async () => {
  const { slot } = await mount({ enabled: false, sections: [] });
  await slot.findByText("Paused");
  await slot.findByText("Create a section in the sidebar, then refresh to find it here.");
  await waitFor(() => expect((slot.getByRole("button", { name: "Preview" }) as HTMLButtonElement).disabled).toBe(true));
});

test("unavailable projects can only be removed; missing sections can be repaired", async () => {
  const { slot, writes } = await mount({ rules: { proj_missing: "sec_work", proj_one: "sec_missing" } });
  expect((slot.getByLabelText("Section for proj_missing") as HTMLSelectElement).disabled).toBe(true);
  expect(slot.queryByRole("button", { name: "Save section for proj_missing" })).toBeNull();
  expect(slot.getByText("This project is unavailable. Remove the rule.")).toBeTruthy();
  expect(slot.getByText("This section is unavailable. Choose another section and save, or remove the rule.")).toBeTruthy();
  fireEvent.change(slot.getByLabelText("Section for Website"), { target: { value: "sec_work" } });
  fireEvent.click(slot.getByRole("button", { name: "Save section for Website" }));
  await slot.findByText("Section updated.");
  expect(writes).toEqual([{ projectId: "proj_one", sectionId: "sec_work" }]);
  fireEvent.click(slot.getByRole("button", { name: "Remove rule for deleted project" }));
  await slot.findByText("Rule removed. Existing threads stay where they are.");
});

test("refresh preserves preview for equal rules and clears it when rules change", async () => {
  const { slot, state } = await mount({ rules: { proj_one: "sec_work" } });
  fireEvent.click(slot.getByRole("button", { name: "Preview" }));
  await slot.findByRole("button", { name: "Move 2 threads" });
  fireEvent.click(slot.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(slot.getByRole("button", { name: "Move 2 threads" })).toBeTruthy());
  state.rules.proj_one = "sec_personal";
  await waitFor(() => expect((slot.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(slot.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(slot.queryByRole("button", { name: "Move 2 threads" })).toBeNull());
});
