# OfficeMachine — Vision & Product Direction

_The source of truth for what OfficeMachine is becoming. Last updated 2026-07-10._

## What OfficeMachine is

**OfficeMachine is a Zero Linux distribution for an AI-native personal computer.**

The product is the operating system: the installed, bootable, updateable, recoverable environment in which people create, communicate, automate, and run software. Zero and zero-native are central to the direction, but the goal is not merely to collect Zero applications. The goal is a coherent Linux distribution whose system architecture and user experience are designed for local, agent-assisted computing.

## Project boundary

OfficeMachine and HyperPost are independent projects.

- OfficeMachine is not a platform, umbrella brand, runtime, or monorepo for HyperPost.
- HyperPost is not an OfficeMachine application, module, bundled service, or reference architecture.
- The projects have separate repositories, roadmaps, architectures, and business identities.
- Neither project may acquire a dependency on the other by assumption.
- Future compatibility must be explicit, optional, and treated like ordinary app-to-operating-system integration.

## What OfficeMachine is not

- It is not simply the current AI harness with a desktop shell around it.
- It is not a web application styled to look like an operating system.
- It is not a bundle of unrelated desktop experiments presented as a distro.
- It is not an operating environment whose basic functions require a cloud agent.
- It is not the delivery vehicle for HyperPost.

## Product principles

### 1. The distribution is the product

Boot, installation, updates, rollback, recovery, hardware compatibility, security, the desktop session, packaging, and system observability are core product surfaces—not later infrastructure work hidden beneath the applications.

### 2. Zero-native where it earns its place

Zero and zero-native should shape the system where they improve correctness, portability, performance, developer experience, or user experience. The architecture should distinguish clearly among the Linux base, Zero runtime/toolchain, native system services, application SDK, and user applications.

### 3. Local-first and user-owned

The user's files, projects, credentials, settings, models, transcripts, and automation state should remain inspectable, portable, and recoverable. Cloud services may extend the machine, but they should not obscure ownership or become an invisible source of authority.

### 4. AI-native, not AI-dependent

Agents should be available as a system capability with access to well-defined tools, permissions, state, and audit trails. The machine must still boot, expose files, launch applications, and support ordinary work when models or networks are unavailable.

### 5. Human authority is explicit

Agents may observe, propose, and perform bounded actions. The operating system must define permissions, consent, reversibility, identity, and logging at the system boundary rather than leaving each application to invent them.

### 6. Coherence without accidental coupling

OfficeMachine applications should share system conventions, capabilities, and design language. They should not become one indivisible application monolith. Components need explicit ownership and contracts so they can evolve, be replaced, or be omitted.

## Repository transition

The current repository predates this clarified product direction. It contains an AI harness, durable runtime work, native and hybrid shells, system-application experiments, Zero experiments, and shared packages.

Treat that code as incubation material. Every major component should be classified against the distro vision:

- **retain** when it directly supports the distribution and has an appropriate system boundary;
- **rewrite** when the capability belongs but the architecture does not;
- **move** when it is a useful independent project or library rather than distro code;
- **retire** when it no longer serves the product direction.

No current folder is part of the final architecture merely because it already exists.

## Open architecture decisions

The following decisions are intentionally unresolved and should be documented before implementation hardens around them:

1. Linux base, kernel policy, userland, and supported hardware targets.
2. Installer, image production, boot flow, recovery, updates, rollback, and release channels.
3. Package format, repositories, dependency policy, and application distribution.
4. Display server, compositor, desktop/session architecture, window management, and accessibility.
5. Filesystem layout, user data model, backup, encryption, secrets, and identity.
6. Zero toolchain/runtime placement and the contract between Zero, zero-native, Linux services, and applications.
7. Agent runtime boundaries, permissions, sandboxing, audit logs, approvals, and offline behavior.
8. System application set and the criteria for first-party versus third-party software.
9. Telemetry, diagnostics, crash recovery, and supportability.
10. Licensing and governance for the distribution and its component projects.

Until these decisions are made, implementation documents should describe experiments rather than imply settled distro architecture.

## Near-term documentation order

1. Product and project boundary — this document.
2. System architecture decision record covering the unresolved layers above.
3. Distribution build and release model.
4. Security and agent authority model.
5. First-party application and SDK boundaries.
6. Migration map for the current repository.

OfficeMachine becomes real when it can be understood as a distribution from source tree to installed machine—not merely as a collection of promising applications.
