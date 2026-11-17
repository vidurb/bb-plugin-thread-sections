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

Settings → Installed plugins → Thread Sections exposes `enabled` and `rules`.
`rules` is a JSON object mapping project IDs to section IDs. The default is
`{}`. `enabled=false` pauses all routing, including apply and startup catch-up.
