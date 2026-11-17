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
its dropdown, or remove the rule with the remove button. Rules save immediately
and sync across open windows. You can send several projects to the same section.

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
Every command supports `--json`. Removing a rule leaves already filed threads
where they are. Rules are stored privately on your BB server, separate from
the plugin's public source repository.

### Upgrading from 0.1

Version 0.2 replaces the JSON setting with the visual editor and stores rules
in plugin storage. If you configured 0.1, save `bb thread-sections list --json`
before upgrading, then recreate those mappings with the editor or
`bb thread-sections set <project-id> <section-id>`. The enable switch is retained.

## Behavior

- New visible, unsectioned threads go into their project's configured section.
- Explicit section placement is preserved. Pinned state is preserved too.
- Hidden, archived and deleted threads are skipped.
- Unarchived threads are routed if they have no section.
- On startup/reload, a catch-up sweep files existing unsectioned threads for
  configured projects, including threads created while the plugin was off.
- No polling: routing uses BB lifecycle events and one startup sweep.
- Manually moving a thread to another section is respected. Moving it out of
  every section makes it eligible for the next catch-up or explicit apply.
- Deleted sections produce warnings and failed counts in `apply`; repair or
  remove the affected rule. Other threads continue processing.

Catch-up re-reads each thread before moving it. The SDK does not provide a
conditional section update, so a simultaneous manual move between that read
and write can still race. Concurrent creation during offset-based catch-up can
also require another `apply` to catch a missed row.

## Development

```sh
npm ci
npm test
npm run typecheck
bb plugin build .
```

The tests use BB's public SDK fake-host and frontend harnesses. They cover
routing, stored rules, RPC validation, pagination, lifecycle events and editor interactions. CI checks tests, types and
the plugin build. Generated `dist/` and `node_modules/` are not committed.

The source repository is public. No marketplace submission or release tag is
created automatically. Before publishing a release, exercise it on a running
BB instance, add marketplace screenshots if needed, and tag the reviewed
version. See `PLUGIN_OVERVIEW.md` for the store description.

## License

MIT
