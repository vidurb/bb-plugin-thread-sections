Keep related projects together in the sections you already use in BB's sidebar.
Thread Sections applies project defaults without replacing your thread list.

## What you get

- One default section per project, with several projects able to share a section.
- Automatic filing when a thread is created or unarchived.
- A startup catch-up sweep for threads created while the plugin was off.
- Preservation of explicit section placement and pinned state.
- A visual rule editor with project and section dropdowns, inline changes and remove controls.
- A preview of existing threads before applying rules.

## How it works

Open the plugin's settings, choose a project and section, and click Add rule.
Rules save automatically and sync across windows. You can change a destination
inline or remove a rule. Unavailable projects or sections are marked clearly.

Use Preview to count eligible existing threads, then Move threads to apply your
rules. Hidden and archived threads are skipped. A thread manually moved out of
every section becomes eligible again. Installing with empty rules moves nothing.

The `bb thread-sections` CLI supports listing targets, setting and removing
rules, and previewing or applying them for agents and scripts.

## Requirements

BB 0.49 or later with Plugin SDK 0.6.132 or later. No external account, service
or API key. Rules are stored on your BB server. The plugin uses public SDK APIs
and works with BB's native sections.
