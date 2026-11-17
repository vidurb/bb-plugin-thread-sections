Keep related projects together in the sections you already use in BB's sidebar.
Thread Sections applies project defaults without replacing your thread list.

## What you get

- One default section per project, with several projects able to share a section.
- Automatic filing when a thread is created or unarchived.
- Preservation of explicit section placement and pinned state.
- A visual rule editor with project and section dropdowns, inline changes and remove controls.
- A preview of existing threads before applying rules.

## How it works

Open the plugin's settings, choose a project and section, and click Add rule.
Rules sync across windows. Change a destination inline and click Save, or
remove a rule. Unavailable projects or sections are marked clearly.

Use Preview to count eligible existing threads, then Move threads to apply your
rules. Hidden and archived threads are skipped. A thread manually moved out of
every section becomes eligible for an explicit move. Threads missed while the
plugin is unloaded need an explicit move. Installing with empty rules moves nothing.

The `bb thread-sections` CLI supports listing targets, setting and removing
rules, and previewing or applying them for agents and scripts.

## Requirements

BB 0.49 or later with Plugin SDK 0.6.132 or later. No external account, service
or API key. Rules are stored on your BB server. The plugin uses public SDK APIs
and works with BB's native sections.
