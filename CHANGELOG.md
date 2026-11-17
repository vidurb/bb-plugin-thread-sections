# Release notes

## 0.3.0 (unreleased)

- Automatic routing handles live creation and unarchive events only. Startup,
  reload and resume no longer move existing threads. Use Preview/Move or
  `bb thread-sections apply` for threads missed while the plugin was unloaded.
- Existing 0.2 rules and the enabled setting are preserved. Version 0.1 was
  never tagged; its legacy JSON rules must be exported before upgrading and
  recreated manually. They cannot be read by this version after upgrading.
- Sweeps continue past project paging errors and report failures. Reads remain
  responsive during a sweep, and rule destination changes use an explicit Save.
