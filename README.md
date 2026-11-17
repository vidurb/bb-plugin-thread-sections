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

Create your sections with BB's sidebar or `bb thread section create Work`.
List available projects and sections, then set a rule by exact name or ID:

```sh
bb thread-sections targets
bb thread-sections set 'My Project' Work
bb thread-sections list
```

Rules take effect immediately for newly created or unarchived threads.
Names containing spaces must be quoted. Ambiguous names are rejected; use
an ID instead. Rules store IDs so renaming a project or section keeps working.
Sections must already exist; the plugin never creates them implicitly.

To sort existing threads after adding rules:

```sh
bb thread-sections apply --dry-run
bb thread-sections apply
```

Remove a rule with `bb thread-sections remove 'My Project'`. Removing a rule
leaves already filed threads where they are. Every command supports `--json`.

You can also edit **Automatically file threads** and **Project → section
rules (JSON IDs)** in the plugin's settings. The rules field is a JSON object:

```json
{"proj_example": "section-id"}
```

Disable **Automatically file threads** to pause routing and catch-up.
Rules stay on your BB server, separate from the plugin's source repository.

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

The tests use BB's public SDK fake-host harness and cover routing, settings,
CLI validation, pagination and lifecycle events. CI checks tests, types and
the plugin build. Generated `dist/` and `node_modules/` are not committed.

The source repository is public. No marketplace submission or release tag is
created automatically. Before publishing a release, exercise it on a running
BB instance, add marketplace screenshots if needed, and tag the reviewed
version. See `PLUGIN_OVERVIEW.md` for the store description.

## License

MIT
