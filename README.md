# OfficeMachine

> A Zero Linux distribution for an AI-native personal computer.

OfficeMachine is an independent operating-system project. Its direction is a coherent Linux distribution built around the Zero ecosystem, zero-native software, local ownership, and system-level agent capabilities.

OfficeMachine is **not** the parent platform for HyperPost. HyperPost and OfficeMachine are separate products, repositories, roadmaps, architectures, and business identities.

**Product direction:** [docs/VISION.md](docs/VISION.md)

## Status

OfficeMachine is in an early transition from an application and agent-runtime incubation monorepo into a distribution project. The current repository is useful raw material, but it is not yet a complete or final Linux distribution architecture.

Existing applications, native shells, agent infrastructure, and shared packages must each be explicitly retained, rewritten, moved, or retired according to the distro vision. Their presence in the repository does not automatically make them part of the final system.

## Direction

OfficeMachine aims to make the operating system itself a better environment for human and agent work:

- **Distribution first:** installation, boot, updates, recovery, security, hardware support, and the desktop session are first-class product concerns.
- **Zero-native by design:** Zero and zero-native are core implementation tools where they provide a real systems or application advantage.
- **Local-first and user-owned:** files, projects, credentials, models, and execution state should remain understandable and controllable by the user.
- **AI-native, not AI-dependent:** agents should be a system capability, while ordinary computing remains reliable without an agent in the loop.
- **Coherent but modular:** system applications should feel like one machine without collapsing into one inseparable codebase.
- **Explicit authority:** the user and the local system remain authoritative; agents propose and perform bounded operations under clear permissions.

## Current repository

The repository currently contains several categories of incubation work:

- native and hybrid application experiments, including terminal, browser, file explorer, music player, and video editor work;
- an AI SDK harness and durable chat/runtime stack;
- Zero and zero-native experiments;
- shared UI, TUI, configuration, sandbox, and media packages.

These are candidates and experiments—not a declaration of the final distro composition.

## Project boundary

HyperPost is a standalone creative and marketing product. It is not bundled into OfficeMachine, does not define OfficeMachine's architecture, and must not be used as the justification for OS-level decisions. A future HyperPost build may run on OfficeMachine just as another application would, but that compatibility must remain explicit and optional.

## Documentation

- [Vision and product boundary](docs/VISION.md)
- [Agent harness notes](docs/building-an-agent-harness.md)
- [Video editor architecture](docs/video-editor-architecture.md)

The technical documents describe current experiments. `docs/VISION.md` defines the product direction when an implementation document and the distro vision diverge.

## Development

This is currently a pnpm/Turborepo workspace with several Zig and Bun subprojects. Read `CLAUDE.md`, `AGENTS.md`, and the nearest nested instructions before changing a component; commands and build systems vary by package.

## License

See the repository's license and individual component licenses.
