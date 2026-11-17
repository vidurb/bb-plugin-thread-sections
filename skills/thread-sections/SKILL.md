---
name: thread-sections
description: Configure project-to-section routing and file unsectioned BB threads with the Thread Sections plugin.
---

# Thread Sections

Use `bb thread-sections targets [--json]` to find project and section IDs.
`bb thread-sections list [--json]` shows saved project-to-section rules.

- `bb thread-sections set <project-name-or-id> <section-name-or-id>` adds or replaces a rule.
- `bb thread-sections remove <project-name-or-id>` removes one.
- `bb thread-sections apply --dry-run` counts eligible existing threads.
- `bb thread-sections apply` files those threads. Both support `--json`.

Quote names containing spaces. Names match exactly; ambiguous names require IDs.
Sections must already exist. Use `bb thread section create <name>` if needed.
Rules take effect immediately for new and unarchived threads. Setting a rule
alone does not sweep existing threads; apply does, and startup/reload catches up.
Explicit sections and pinned state are preserved; hidden and archived threads
are skipped. Moving a thread to no section makes it eligible again.

Settings → Installed plugins → Thread Sections provides project and section
dropdowns, Add rule, inline destination edits, removal, and Preview/Move controls.
The `enabled` setting pauses all routing, including apply and startup catch-up.
Rules live in plugin KV storage; use the CLI or editor to change them. There is
no JSON setting. For upgrades from 0.1, export rules before updating and restore
with `set`; see the README.
