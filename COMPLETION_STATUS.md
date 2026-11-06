# Examy PRO — Completion branch status

This branch contains targeted fixes based on the current repository. It is not represented as a fully verified release until the Windows CI build and manual acceptance tests pass.

## Changes made in this branch

- Fixed ribbon click propagation so the ribbon interaction controller receives tab clicks and can reveal the selected panel, preserve pin behavior, and reset its idle timer. The ribbon now opens pinned by default on first launch.
- Prevented table-selection cleanup from treating clicks on the ribbon navigation as outside clicks; this stops the Table Design tab from closing immediately when selected.
- Connected paper-size selection to the page geometry engine. Added A5, Legal, Tabloid, Executive, and B5 dimensions, validated page orientation, and persisted/restored page size and margins on startup.
- Added a paper-size selector directly to the Layout ribbon and synchronized it with the selected Windows printer's supported standard paper sizes, the Settings page, and print preview.
- Kept the ribbon expanded while a select, number field, or editable control has focus so measurements and dropdown choices can be entered without the panel collapsing.
- Fixed the ruler toggle to control the actual generated page rulers and preserve visibility when page numbers/layout are refreshed.
- Added a dedicated PDF export mode that prints only the examination sheets and their document content; app navigation, settings, toolbars, status panels, and page-editing controls are excluded from the PDF output.
- Corrected Electron .exam file-open handling: moved argument parsing out of the window factory, queued files until the renderer is ready, avoided duplicate sends, added a file-size limit, and handled second-instance/open-file events.
- Added a single-instance lock and restricted Electron IPC operations to the trusted packaged renderer.
- Restricted microphone permission to the packaged local application.
- Removed shell interpolation for printer names; printer properties now use execFile and validate that the requested printer is installed.
- Validated print/PDF options and return actual print callback results.
- Restricted non-LAN API routes to loopback clients. Kept only LAN discovery and submission reachable to other local-network devices.
- Reduced JSON request body size, limited individual LAN submissions, and bounded the LAN inbox by both record count and total stored bytes.
- Made local autosave storage failures non-fatal and connected the page-flow bridge to the active pagination engine.
- Hardened backup/restore handling, sanitized HTML restored from archives, templates, autosave, .exam imports, Word/PDF and backup files, delayed object-URL revocation for exports so downloads can start, connected the equation button to the visual MathLive editor, and capped revision-history storage to avoid quota crashes.
- Added an npm test smoke-check command and a Windows GitHub Actions workflow to run syntax/smoke checks, build the installer, and package the source ZIP.

## Verification status

The test suite now checks required files, JSON database validity, JavaScript syntax, ribbon navigation wiring, Electron hardening, local API restrictions, full backup/restore routes, and presence of core editor features. A source-level validation pass compiled all 28 JavaScript files successfully and verified that all 39 local JavaScript/CSS references in the HTML entry point exist. The package and lockfile versions also match.

**The actual npm test command and Windows installer workflow have not yet reported a successful run.** The app has also not been exercised here on a Windows desktop with a real printer, a multi-page exam, microphone permission prompts, or two devices on the same LAN. Those are required before calling the build complete or claiming 100% correctness.

## Required acceptance tests before release

1. Install and launch the Windows installer on a clean Windows 11 profile.
2. Switch every ribbon tab repeatedly, including Table Design, and confirm the toolbar stays visible and does not jump to Home.
3. Open and close each dropdown near all screen edges and confirm it remains anchored to its trigger.
4. Edit long paragraphs and multi-page tables; verify no missing or duplicated content across page breaks.
5. Test A4, A3, A5, Letter, Legal, Tabloid, Executive, and B5 in portrait and landscape.
6. Print to PDF and to at least one physical printer; verify page count, margins, headers, footers, and no UI controls in output.
7. Save, close, relaunch, recover autosave, export, import, and reopen .exam files, including a second-instance open.
8. Test LAN submission from a second device and confirm only the receiving PC can view its inbox and local configuration.
9. Test the microphone and AI assistant with a valid API key; confirm the key is never exposed to LAN clients.
10. Test search/replace, undo/redo, image insertion, table editing, equations, variant generation, and variant comparison.
11. Change the printer in Settings and confirm the ribbon, Settings, and preview paper-size lists all match that printer's supported paper options; test editing all numeric fields while the ribbon is open.
12. Toggle rulers on and off, then add/reorder pages and confirm the chosen ruler state remains consistent.
13. Export both PDF commands and confirm the PDF contains only the test paper(s), without any Examy application buttons, settings, ribbon, preview dock, or status bars.
