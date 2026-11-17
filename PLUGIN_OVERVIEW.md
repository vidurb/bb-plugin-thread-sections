Keep related projects together in the sections you already use in BB's sidebar.
Thread Sections applies project defaults without replacing your thread list.

## What you get

- One default section per project, with several projects able to share a section.
- Automatic filing when a thread is created or unarchived.
- A startup catch-up sweep for threads created while the plugin was off.
- Preservation of explicit section placement and pinned state.
- An enable switch and validated JSON rules in plugin settings.

## How it works

Create sections in BB, then use `bb thread-sections targets` to list projects
and sections. Configure a rule with `bb thread-sections set "My Project" Work`.
Names and IDs both work, and rules store IDs to survive renames.

Use `bb thread-sections apply --dry-run` to count eligible existing threads,
then `bb thread-sections apply` to file them. Hidden and archived threads are
skipped. A thread manually moved out of every section becomes eligible again.
Installing with the default empty rules moves nothing.

## Requirements

BB 0.49 or later with Plugin SDK 0.6.132 or later. No external account, service
or API key. Rules are stored on your BB server. The plugin uses public SDK APIs
and works with BB's native sections.
