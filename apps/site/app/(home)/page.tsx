import { Hero } from "@workspace/ui/components/landing/hero";
import { Stage } from "@workspace/ui/components/landing/stage";
import { Window } from "@workspace/ui/components/landing/window";
import { Terminal } from "@workspace/ui/components/landing/terminal";
import type { TerminalScene } from "@workspace/ui/components/landing/terminal";
import { Features, Panel } from "@workspace/ui/components/landing/features";
import type { SpotlightItem } from "@workspace/ui/components/landing/features";
import { Bento } from "@workspace/ui/components/landing/bento";
import type { BentoItem } from "@workspace/ui/components/landing/bento";
import { Footer } from "@workspace/ui/components/landing/footer";
import type { FooterColumn } from "@workspace/ui/components/landing/footer";
import { appName, gitConfig } from "../../lib/shared";

const heroTerminalScenes: readonly TerminalScene[] = [
  {
    name: "dev",
    data: [
      { tone: "input", text: "$ pnpm run dev" },
      { tone: "plain", text: "" },
      { tone: "ok", text: "api      → localhost:3000" },
      { tone: "ok", text: "web      → localhost:3001" },
      { tone: "ok", text: "terminal → zig build run" },
      { tone: "plain", text: "" },
      { tone: "ok", text: "Ready." },
    ],
  },
  {
    name: "resume",
    data: [
      { tone: "input", text: "$ curl -X POST localhost:3000/api/chat/8f2a1c" },
      { tone: "dim", text: "" },
      { tone: "dim", text: "no live run for chat 8f2a1c, starting workflow" },
      { tone: "ok", text: "hook chat:8f2a1c parked, awaiting next message" },
      { tone: "plain", text: "" },
      { tone: "input", text: "# server restarts" },
      { tone: "input", text: "$ curl -X POST localhost:3000/api/chat/8f2a1c" },
      { tone: "dim", text: "" },
      { tone: "ok", text: "resuming workflow run wf_8f2a1c..." },
      { tone: "ok", text: "streaming response" },
    ],
  },
  {
    name: "block",
    data: [
      { tone: "input", text: "$ npx shadcn add officemachine.dev/r/terminal" },
      { tone: "dim", text: "" },
      { tone: "ok", text: "installing terminal block" },
      { tone: "ok", text: "✓ components/terminal.tsx" },
      { tone: "ok", text: "✓ lib/use-terminal.ts" },
      { tone: "plain", text: "" },
      { tone: "ok", text: "Done." },
    ],
  },
];

const spotlights: readonly SpotlightItem[] = [
  {
    id: "harness",
    tone: "slate",
    title: "A durable agent runtime.",
    description:
      "One durable workflow per chat, parked on a hook between turns instead of one run per request. It resumes across server restarts and redeploys with nothing but a chat id.",
    bullets: [
      "built on AI SDK v7's HarnessAgent",
      "sandboxed filesystem, not a bare tool loop",
      "resumes mid-turn after a restart or redeploy",
    ],
    window: (
      <Panel
        rows={[
          { tone: "cmd", text: "$ curl -X POST localhost:3000/api/chat/8f2a1c" },
          { tone: "dim", text: "" },
          { tone: "code", text: "resuming workflow run wf_8f2a1c..." },
          { tone: "code", text: "hook chat:8f2a1c → new message" },
          { tone: "code", text: "streaming response" },
        ]}
      />
    ),
  },
  {
    id: "blocks",
    tone: "ash",
    title: "Installable, not just readable.",
    description:
      "Every hard problem we solve gets extracted into a shadcn block instead of staying buried in the app. Install it with the same workflow you already use.",
    bullets: [
      "npx shadcn add, same as any other registry",
      "ships as source in your project, not a package",
      "starts with the block for streaming a terminal into React",
    ],
    flip: true,
    window: (
      <Panel
        rows={[
          { tone: "cmd", text: "$ npx shadcn add officemachine.dev/r/terminal" },
          { tone: "dim", text: "" },
          { tone: "code", text: "installing terminal block" },
          { tone: "code", text: "✓ components/terminal.tsx" },
          { tone: "code", text: "✓ lib/use-terminal.ts" },
        ]}
      />
    ),
  },
  {
    id: "apps",
    tone: "iron",
    title: "Three apps, one agent.",
    description:
      "A web chat, a CLI, and a native terminal shell all drive the same harness underneath. Not three separate implementations pretending to be one product.",
    bullets: [
      "web chat over the same durable workflow",
      "a CLI for scripting and piping",
      "a native terminal app with an in-browser shell, no PTY",
    ],
    window: (
      <Panel
        rows={[
          { tone: "cmd", text: "$ pnpm run dev" },
          { tone: "dim", text: "" },
          { tone: "code", text: "api      → localhost:3000" },
          { tone: "code", text: "web      → localhost:3001" },
          { tone: "code", text: "terminal → zig build run" },
        ]}
      />
    ),
  },
];

const bentoItems: readonly BentoItem[] = [
  {
    id: "001",
    title: "Durable by default",
    body: "Each chat is a durable workflow, not a request handler. It survives server restarts and redeploys, and resumes exactly where it left off.",
  },
  {
    id: "002",
    title: "Sandboxed execution",
    body: "The agent reads and writes through a real sandboxed filesystem, not a bare shell tool bolted onto a chat loop.",
  },
  {
    id: "003",
    title: "Self-hosted",
    body: "Runs on your own machine. Local sqlite, local sessions, no vendor deciding what happens to your data.",
  },
  {
    id: "004",
    title: "Multi-surface",
    body: "The web chat, the CLI, and the terminal app all drive the same harness. Add a new surface without rebuilding the agent.",
  },
];

const footerColumns: readonly FooterColumn[] = [
  {
    heading: "Ecosystem",
    items: [
      { label: "Harness", href: "/harness" },
      { label: "Blocks", href: "/blocks" },
      { label: "Apps", href: "/apps" },
    ],
  },
  {
    heading: "Resources",
    items: [
      { label: "Docs", href: "/docs" },
      { label: "AI SDK", href: "https://ai-sdk.dev" },
    ],
  },
  {
    heading: "Links",
    items: [
      { label: "GitHub", href: `https://github.com/${gitConfig.user}/${gitConfig.repo}` },
    ],
  },
];

export default function HomePage() {
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden md:block">
        <div className="mx-auto h-full max-w-330 border-x border-border" />
      </div>
      <div className="relative z-10">
        <Hero
          headline="The toolkit for local-first ▲ AI SDK."
          description="A durable, sandboxed agent runtime built on AI SDK v7's HarnessAgent. Includes an installable shadcn block registry, and web, CLI, and terminal apps built on top of it. Open source, self-hosted."
          command="pnpm run dev"
        >
          <Stage tone="slate">
            <div className="mx-auto w-full max-w-290">
              <Window title="terminal" bar={false}>
                <Terminal scenes={heroTerminalScenes} />
              </Window>
            </div>
          </Stage>
        </Hero>
        <Features spotlights={spotlights} />
        <Bento
          heading="The parts, up close."
          description="Four things about how it's built that matter if you're going to fork it."
          command="pnpm --filter web run dev:app"
          items={bentoItems}
        />
        <Footer
          brand={appName}
          tagline="A local-first ecosystem for AI SDK — a durable agent runtime, an installable block registry, and the apps built on them."
          poweredByHref="https://vercel.com"
          columns={footerColumns}
        />
      </div>
    </div>
  );
}
