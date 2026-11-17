# Thread Sections

Automatically file BB threads into native sidebar sections by project, without
replacing the sidebar. Map several projects to the same section or give each
project its own default.

Requires BB 0.49+ and Plugin SDK 0.6.132+. No external services or accounts.

## Install

```sh
bb plugin install https://github.com/vidurb/bb-plugin-thread-sections.git
```

No rules are configured initially, so installing alone moves nothing.

## Configure

Open **Settings → Installed plugins → Thread Sections**.

1. Pick a project and its destination section, then click **Add rule**.
Each rule shows the project's name beside its section. Change the section with
its dropdown and click **Save**, or remove the rule with the remove button.
Rules sync across open windows. Several projects can share a section.

Use **Preview** under **Sort existing threads** to see how many unsectioned
threads match. Click **Move N threads** to apply the rules. Adding or changing
a rule alone only affects new threads; threads already in a section keep their
placement. Pause automatic filing with the switch above the editor.

Create sections in BB's sidebar. Use **Refresh** in the editor after creating
or renaming a project or section elsewhere. Unavailable targets are marked in
the rule list so they can be repaired or removed.

### Command line

The CLI remains available for agents and scripts:

```sh
bb thread-sections targets
bb thread-sections set 'My Project' Work
bb thread-sections list
bb thread-sections apply --dry-run
bb thread-sections apply
bb thread-sections remove 'My Project'
```

Names containing spaces must be quoted. Ambiguous names require an ID.
Sections must already exist. Rules store IDs so renaming keeps working.
Each listed command supports `--json`. Removing a rule leaves already filed
threads where they are. Rules are stored privately on your BB server, separate from
the plugin's public source repository.

### Upgrading from 0.1

Version 0.2 replaces the JSON setting with the visual editor and stores rules
in plugin storage. If you configured 0.1, save `bb thread-sections list --json`
before upgrading, then recreate those mappings with the editor or
`bb thread-sections set <project-id> <section-id>`. Version 0.1 was never tagged; its legacy JSON
setting cannot be read by 0.2 or 0.3 after upgrading, so recreate any rules
that were not exported. Version 0.3 preserves 0.2 rules and the enable switch.

## Behavior

- New visible, unsectioned threads go into their project's configured section.
- Explicit section placement is preserved. Pinned state is preserved too.
- Hidden, archived and deleted threads are skipped.
- Unarchived threads are routed if they have no section.
- No automatic sweep runs on install, startup, reload or resume. Threads created
  or unarchived while the plugin is unloaded require explicit Preview/Move.
- No polling: automatic routing uses BB lifecycle events.
- Manually moving a thread to another section is respected. Moving it out of
  every section makes it eligible for explicit Preview/Move.
- Missing projects, paging failures and deleted sections produce warnings and
  failed counts in `apply`; other rules continue processing. Repair or remove
  unavailable rules and check the plugin logs for details.

Apply re-reads each thread before moving it. The SDK does not provide a
conditional section update, so a simultaneous manual move between that read
and write can still race. Concurrent creation during offset-based apply can
also require another `apply` to catch a missed row.

## Development

```sh
npm ci
npm test
npm run typecheck
bb plugin build .
```

Development requires Node.js 22.18 or newer. The tests use BB's public SDK
fake-host and frontend harnesses. They cover routing, stored rules, RPC
validation, pagination, lifecycle events and editor interactions. CI checks
tests, types and the plugin build. Generated `dist/` and `node_modules/` are
not committed.

## License

MIT
