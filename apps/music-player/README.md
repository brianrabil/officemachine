# Music

A local-first music player rendered entirely by the Vercel Native SDK. It has
an album library, all-songs view, search, native context menus, cover art,
keyboard controls, a play-next queue, and a persistent now-playing bar with a
live seek control.

The app is adapted from the Native SDK's official
[Soundboard example](https://github.com/vercel-labs/native/tree/main/examples/soundboard).
There is no WebView, JavaScript runtime, account, or backend.

## Local-first playback

Each track resolves in this order:

1. `assets/music/<album>/<track>.mp3`
2. The verified platform cache
3. The demo catalog's hosted source

Local files always win. A streamed track is cached under
`~/Library/Caches/music-player/audio/`, size-verified against the committed
catalog, and plays locally on later launches. Set
`NATIVE_SDK_MUSIC_URL_BASE=` to disable the hosted fallback and run entirely
offline.

The committed catalog and cover art live in `src/music_manifest.zon` and
`src/art/`. To replace the demo library, update that typed manifest and place
the matching audio files under `assets/music/`; the catalog is compiled into
the binary, while the audio stays local and gitignored.

## Commands

```sh
native dev
native check
native test -Dplatform=null
native build -Dautomation=true
./zig-out/bin/music-player
```

From a running automation build:

```sh
native automate assert 'gpu_nonblank=true' 'role=button name="Play or pause"'
native automate screenshot music-canvas
```
