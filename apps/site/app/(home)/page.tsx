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

const heroTerminalScenes: readonly TerminalScene[] = [
  {
    name: "image",
    data: [
      {
        tone: "input",
        text: '$ ai image "a sunset" -m "openai/gpt-image-2,bfl/flux-2-pro"',
      },
      { tone: "plain", text: "" },
      { tone: "ok", text: "Saved to /Users/you/resp_img_a-1.png (3.2s)" },
      { tone: "ok", text: "Saved to /Users/you/resp_img_b-2.png (4.1s)" },
    ],
  },
  {
    name: "video",
    data: [
      { tone: "input", text: '$ ai image "a dragon" | ai video "animate this"' },
      { tone: "dim", text: "" },
      { tone: "dim", text: "Generating image with openai/gpt-image-2" },
      { tone: "ok", text: "Generating video with bytedance/seedance-2.0" },
      { tone: "plain", text: "" },
      { tone: "ok", text: "Saved to /Users/you/resp_video.mp4 (12.4s)" },
    ],
  },
  {
    name: "text",
    data: [
      { tone: "input", text: '$ git diff | ai text "explain these changes"' },
      { tone: "dim", text: "" },
      { tone: "dim", text: "Generating text with openai/gpt-5.5" },
      { tone: "plain", text: "" },
      { tone: "plain", text: "These changes refactor the auth module:" },
      { tone: "plain", text: "" },
      { tone: "plain", text: "  1. Splits session logic into its own file" },
      { tone: "plain", text: "  2. Adds token expiry validation" },
      { tone: "plain", text: "  3. Removes deprecated OAuth1 flow" },
      { tone: "plain", text: "" },
      { tone: "ok", text: "Saved to /Users/you/resp_text.md" },
    ],
  },
  {
    name: "audio",
    data: [
      { tone: "input", text: '$ ai audio speak "Thanks for trying ai-cli"' },
      { tone: "dim", text: "" },
      { tone: "dim", text: "Generating audio with openai/tts-1" },
      { tone: "plain", text: "" },
      { tone: "ok", text: "Saved to /Users/you/resp_8j3k2m1n.mp3 (1.8s)" },
      { tone: "muted", text: "Playing audio  ▁▂▃▅▇▆▄▃▂▁" },
      { tone: "plain", text: "" },
      { tone: "input", text: "$ ai audio transcribe meeting.mp3" },
      { tone: "ok", text: "Saved to /Users/you/resp_transcript.txt" },
    ],
  },
];

const spotlights: readonly SpotlightItem[] = [
  {
    id: "multi-model",
    tone: "slate",
    title: "Multi-model comparison.",
    description:
      "Run the same prompt across multiple models in parallel. Compare outputs side by side to find the best result. Combine with -n to generate multiple per model.",
    bullets: [
      "comma-separated model IDs for parallel generation",
      "configurable concurrency limits",
      "per-job timing and structured JSON output",
    ],
    window: (
      <Panel
        rows={[
          { tone: "cmd", text: '$ ai image "a sunset" -m "gpt-image-2,flux-2-pro"' },
          { tone: "dim", text: "" },
          { tone: "code", text: "Saved to /Users/you/resp_img_a-1.png (3.2s)" },
          { tone: "code", text: "Saved to /Users/you/resp_img_b-2.png (4.7s)" },
        ]}
      />
    ),
  },
  {
    id: "piping",
    tone: "ash",
    title: "Pipe everything.",
    description:
      "Pipe text in as context, pipe images into video generation, turn text into speech, or transcribe piped audio. Raw output on stdout when piped, file saves when interactive.",
    bullets: [
      "text stdin becomes prompt context",
      "binary stdin for image, video, and audio workflows",
      "chain: ai image | ai video, or pipe text to ai audio speak",
    ],
    flip: true,
    window: (
      <Panel
        rows={[
          { tone: "cmd", text: '$ git diff | ai text "explain these changes"' },
          { tone: "dim", text: "" },
          { tone: "code", text: "These changes refactor the auth module:" },
          { tone: "code", text: "" },
          { tone: "code", text: "  1. Splits session logic into its own file" },
          { tone: "code", text: "  2. Adds token expiry validation" },
          { tone: "code", text: "  3. Removes deprecated OAuth1 flow" },
          { tone: "dim", text: "" },
          { tone: "cmd", text: '$ ai image "a dragon" | ai video "animate this"' },
          { tone: "code", text: "Saved to /Users/you/resp_video.mp4" },
          { tone: "dim", text: "" },
          { tone: "cmd", text: '$ echo "Ship the changelog" | ai audio speak' },
          { tone: "code", text: "Saved to /Users/you/resp_speech.mp3" },
        ]}
      />
    ),
  },
  {
    id: "models",
    tone: "iron",
    title: "Hundreds of models, one key.",
    description:
      "Access text, image, video, speech, and transcription models from OpenAI, Anthropic, Google, Black Forest Labs, ByteDance, and more through Vercel AI Gateway.",
    bullets: [
      "short names resolve automatically: flux-2-pro, gpt-5.5, tts-1",
      "live model listing from the gateway",
      "per-type defaults configurable via env vars",
    ],
    window: (
      <Panel
        rows={[
          { tone: "cmd", text: "$ ai models --type audio" },
          { tone: "dim", text: "" },
          { tone: "dim", text: "Speech models (8):" },
          { tone: "dim", text: "" },
          { tone: "dim", text: "  openai" },
          { tone: "code", text: "    tts-1" },
          { tone: "code", text: "    gpt-4o-mini-tts" },
          { tone: "dim", text: "" },
          { tone: "dim", text: "Transcription models (4):" },
          { tone: "dim", text: "" },
          { tone: "dim", text: "  openai" },
          { tone: "code", text: "    whisper-1" },
          { tone: "dim", text: "  ...and more" },
        ]}
      />
    ),
  },
];

const bentoItems: readonly BentoItem[] = [
  {
    id: "001",
    title: "Inline preview",
    body: "Generated images, video frames, and speech previews display directly in your terminal. Visual previews use the Kitty graphics protocol where supported.",
  },
  {
    id: "002",
    title: "Agent-native output",
    body: "Predictable behavior for scripts and agents. Raw stdout when piped, file saves when interactive. JSON metadata mode for CI pipelines.",
  },
  {
    id: "003",
    title: "Live model discovery",
    body: "Models are fetched directly from the AI Gateway — no hardcoded lists to maintain. Use short names or full provider/model IDs.",
  },
  {
    id: "004",
    title: "Zero config",
    body: "No config files, no init command, no setup wizard. Set an API key environment variable and start generating. Defaults work out of the box.",
  },
];

const footerColumns: readonly FooterColumn[] = [
  {
    heading: "Usage",
    items: [
      { label: 'ai image "prompt"' },
      { label: 'ai video "prompt"' },
      { label: 'ai text "prompt"' },
      { label: 'ai audio speak "text"' },
      { label: "ai models" },
    ],
  },
  {
    heading: "Features",
    items: [
      { label: "multi-model comparison" },
      { label: "stdin/stdout piping" },
      { label: "inline preview" },
      { label: "live model discovery" },
    ],
  },
  {
    heading: "Links",
    items: [
      { label: "GitHub", href: "https://github.com/vercel-labs/ai-cli" },
      { label: "npm", href: "https://www.npmjs.com/package/ai-cli" },
      { label: "AI Gateway", href: "https://vercel.com/docs/ai-gateway" },
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
          headline="The ultimate toolkit for local-first AI SDK HarnessAgent."
          description="A tiny CLI for generating text, images, video, and audio with dead-simple commands. Pipe content in and out. Compare models side by side. See results inline."
          command="npm install -g ai-cli"
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
          heading="Built for composability."
          description="Not a chatbot. A generation tool that fits into any workflow — scripts, CI pipelines, agent toolchains, or just your terminal."
          command='ai text "hello"'
          items={bentoItems}
        />
        <Footer
          brand="ai-cli"
          tagline="Generate text, images, video, and audio from your terminal."
          poweredByHref="https://vercel.com"
          columns={footerColumns}
        />
      </div>
    </div>
  );
}
