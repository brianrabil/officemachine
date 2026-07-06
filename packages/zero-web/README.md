# zero-web — usage

A minimal web framework for [Zero](https://zerolang.ai): routing/response/auth
helpers over `std.http`, a `handle()` convention, and a runnable items-API
demo. Verified against `zero 0.3.4` on darwin arm64 — every command and output
below was run against the code in this package.

## Prerequisites

Install the Zero compiler:

```sh
curl -fsSL https://zerolang.ai/install.sh | bash
export PATH="$HOME/.zero/bin:$PATH"
zero --version   # zero 0.3.4 (build 5b3a90a)
```

## Run the server

Zero's `std.http.listen` binds a loopback socket inside `zero run`. Invoke
`zero` by **absolute path** — the host runtime re-execs the compiler to build
its handler, and a bare `zero` on PATH resolves to argv[0] in a way that can
fail with `No such file or directory` (it then surfaces as
`BLD002: zero dump failed`). An absolute path fixes it.

```sh
cd packages/zero-web
$HOME/.zero/bin/zero run .
# listening on http://127.0.0.1:8080
```

Then:

```sh
curl -sS http://127.0.0.1:8080/health
# {"ok":true,"service":"zero-web"}

curl -sS http://127.0.0.1:8080/items/1
# {"id":1,"name":"alpha"}

curl -sS -X POST -H "content-type: application/json" \
     -d '{"id":7}' http://127.0.0.1:8080/items
# {"id":7}
```

The port is set in `src/main.0` (`std.http.listen(world, 8080_u16)`). Omit the
port to auto-select the next free one from 3000.

## Demo endpoints

| Method | Path         | Status | Body                                    |
|--------|--------------|--------|-----------------------------------------|
| GET    | `/health`    | 200    | `{"ok":true,"service":"zero-web"}`      |
| GET    | `/items`     | 200    | `[{"id":1,"name":"alpha"},...]`         |
| GET    | `/items/:id` | 200/404| `{"id":1,"name":"alpha"}`               |
| POST   | `/items`     | 201/400| `{"id":7}` (requires `id` in JSON body) |
| OPTIONS| `/items`     | 204    | CORS preflight                          |

## Add a route

1. Write a handler in `src/items.0` (or a new module). Import helpers with
   `use web` and call them **unqualified** — Zero `use` brings names into the
   current module's scope; it does not add a namespace prefix:

   ```zero
   use web

   pub fn searchItems(request: Span<u8>, response: MutSpan<u8>) -> Maybe<Span<u8>> {
       let q: Maybe<Span<u8>> = queryValue(request, "q")
       if !q.has {
           return badRequest(response, "{\"error\":\"missing q\"}")
       }
       return ok(response, "[]")
   }
   ```

2. Wire it into the `handle()` chain in `src/main.0`:

   ```zero
   if isGet(request, "/items/search") {
       return searchItems(request, response)
   }
   ```

3. Rebuild the graph and run:

   ```sh
   zero import .
   $HOME/.zero/bin/zero run .
   ```

## Rebuild after editing `.0` source

`zero.graph` is the compile input; the `.0` files are the human-readable
projection. After editing source, sync the graph:

```sh
zero import .           # rebuild zero.graph from .0 files
zero check .            # type/effect check
zero verify-projection  # confirm graph and .0 are in sync (no drift)
```

## Helper API

All from `use web`, called unqualified.

**Predicates** — `(request, path) -> Bool`:
`isGet` `isPost` `isPut` `isDelete` `isOptions`

**Request accessors:**
`queryValue(request, name)` · `pathSegment(request, index)` ·
`pathSegmentCount(request)` · `header(request, name)` · `bearerToken(request)`
· `cookie(request, name)` · `jsonBodyWithin(request, max)`

**Responses** — `(response, body) -> Maybe<Span<u8>>`:
`ok` (200) · `created` (201) · `badRequest` (400) · `unauthorized` (401) ·
`forbidden` (403) · `notFound` (404) · `conflict` (409) ·
`methodNotAllowed` (405) · `serverError` (500)

`corsPreflight(response, origin, methods, headers)`

**Auth / JSON (composed):**
`authed(request, expected)` · `jsonField(request, max, name)` ·
`jsonFieldU32(request, max, name)`

## Architecture notes

- **No runtime router / middleware.** Zero has no function pointers, so routing
  is an `if`/`else` chain in `handle()`. This is by design, not a limitation to
  work around — the framework is the vocabulary of helpers plus the convention.
- **How `listen` dispatches.** `std.http.listen(world, port)` binds a loopback
  socket in the host runtime. The runtime finds `handle` by naming convention
  and calls it per request with a caller-owned response buffer. `main` never
  references `handle`.
- **0.3.4 has no `requestRouteMatches` / `requestPathParam`.** Path params use
  `pathSegment(request, index)`; JSON fields use `std.json.u32` / `std.json.field`
  over the body from `requestJsonBodyWithin`.
- **Fixed response buffers.** The host allocates a fixed buffer per request;
  keep responses within it (the runner caps handler output at 4 KiB).

## Troubleshooting

**`BLD002: zero dump failed` / `zero listen: No such file or directory`** —
you launched `zero` via PATH. The host runtime re-execs the compiler by path
to build its handler; a bare `zero` resolves in a way that breaks that.
Invoke the binary by absolute path: `$HOME/.zero/bin/zero run .`

**`unknown package-local import 'std'`** — `std` is the implicit prelude; don't
write `use std`. Just call `std.http.*` directly.

**`unknown identifier '<module>'`** — you wrote `module.fn(...)`. Zero `use`
imports names unqualified: after `use web`, call `ok(...)`, not `web.ok(...)`.

## Limits (honest)

- **In-process state only.** Each request gets a fresh handler invocation; the
  demo's `/items` data is hardcoded. Wire `std.fs` for persistence (the host
  target has the `fs` capability).
- **Loopback only.** `listen` binds `127.0.0.1`. Put a real reverse proxy
  in front for external traffic.
