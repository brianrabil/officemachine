# File Explorer

A native-rendered Native SDK file browser. It starts in the user's home
folder and lists local directories and files directly from Zig — no WebView,
npm, or backend.

Use Home and Computer to jump to the home folder or filesystem root, the
up-arrow to visit the parent folder, and Refresh to rescan. Selecting a folder
opens it; selecting a file marks it as selected. The filter, hidden-file
toggle, resizable sidebar, directory-first sorting, and the native Icons/List
views all run in the native UI. Icons view uses a content-forward grid; List view
keeps the name/kind/size table. Selection details appear in the status bar. The
view is intentionally capped at the first 96 entries per directory to remain
inside the Native SDK's widget budget.

The declarative view is in `src/app.native`; the Zig `Model`, `Msg`, and
`update` loop lives in `src/main.zig`.

## Commands

```sh
native dev     # build and run the app with hot reload
native test    # run the app's test suite
native build   # produce a ReleaseFast binary in zig-out/bin/
native check   # validate src/*.native markup and app.zon
```

## Hot reload

`src/app.native` is watched while `native dev` runs: edit it and the
window updates within ~2s without losing model state. Parse failures
keep the last good view.

## Owning the build

Need custom build logic? `native eject` writes a build.zig and
build.zig.zon into the app — from then on the `native` verbs drive
your files through `zig build` and never regenerate them.
