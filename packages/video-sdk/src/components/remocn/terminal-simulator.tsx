"use client";

import { interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { TerminalLine, TerminalLineType, TerminalSimulatorBlockProps } from "../../project";

export type { TerminalLine, TerminalLineType } from "../../project";

export type TerminalSimulatorProps = Partial<TerminalSimulatorBlockProps> & {
  className?: string;
};

const DEFAULT_LINES: TerminalLine[] = [
  { text: "npm run build", type: "command", delay: 0 },
  { text: "Resolving dependencies...", type: "log", delay: 6 },
  { text: "> remocn@1.0.0 build", type: "log", delay: 4 },
  { text: "> next build", type: "log", delay: 4 },
  { text: "Compiling...", type: "log", delay: 12 },
  { text: "Compiled successfully in 4.2s", type: "success", delay: 14 },
  { text: "Generating static pages (24/24)", type: "log", delay: 10 },
  { text: "Build completed without errors", type: "success", delay: 12 },
];

const TYPE_COLORS: Record<TerminalLineType, string> = {
  command: "#fafafa",
  log: "#a1a1aa",
  success: "#22c55e",
  error: "#ef4444",
};

/** Auto freeze-frame heuristic: any line ending in "..." holds the camera. */
function autoPause(line: TerminalLine): number {
  if (line.pause !== undefined) return line.pause;
  if (line.text.trimEnd().endsWith("...")) return 18;
  return 0;
}

export function TerminalSimulator({
  lines = DEFAULT_LINES,
  prompt = "$",
  title = "~/projects/remocn",
  background = "#0a0a0a",
  chromeColor = "#1a1a1a",
  fontSize = 18,
  charsPerFrame = 1,
  chunkSize = 1,
  speed = 1,
  className,
}: TerminalSimulatorProps) {
  const frame = useCurrentFrame() * speed;
  const { fps } = useVideoConfig();

  const lineHeight = Math.round(fontSize * 1.6);
  const visibleLines = 8;
  const windowWidth = 900;
  const windowHeight = 480;

  let acc = 10;
  const schedule = lines.map((line) => {
    const delay = line.delay ?? 8;
    acc += delay;
    const start = acc;
    const typingFrames = Math.ceil(line.text.length / (chunkSize * charsPerFrame));
    acc += typingFrames + autoPause(line);
    return { line, start };
  });

  // STEP-FUNCTION scroll. Each overflowing line snaps the buffer up by
  // exactly one lineHeight on the frame it begins. No interpolation, no
  // easing — terminals do not glide.
  let translateY = 0;
  for (const [index, timing] of schedule.entries()) {
    if (index >= visibleLines && frame >= timing.start) {
      translateY -= lineHeight;
    }
  }

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: windowWidth,
          height: windowHeight,
          background,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
        }}
      >
        {/* Chrome */}
        <div
          style={{
            height: 40,
            background: chromeColor,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Light color="#ff5f57" />
          <Light color="#febc2e" />
          <Light color="#28c840" />
          <div
            style={{
              flex: 1,
              textAlign: "center",
              color: "#71717a",
              fontSize: 13,
            }}
          >
            {title}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: 20,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              top: 20,
              translate: `0 ${translateY}px`,
            }}
          >
            {schedule.map(({ line, start }) => (
              <Sequence
                key={`${start}-${line.type}-${line.text}`}
                from={Math.round(start / speed)}
                layout="none"
              >
                <TerminalLineRow
                  line={line}
                  prompt={prompt}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  charsPerFrame={charsPerFrame}
                  chunkSize={chunkSize}
                  fps={fps}
                  speed={speed}
                />
              </Sequence>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Light({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: color,
        opacity: 0.85,
      }}
    />
  );
}

function TerminalLineRow({
  line,
  prompt,
  fontSize,
  lineHeight,
  charsPerFrame,
  chunkSize,
  fps,
  speed,
}: {
  line: TerminalLine;
  prompt: string;
  fontSize: number;
  lineHeight: number;
  charsPerFrame: number;
  chunkSize: number;
  fps: number;
  speed: number;
}) {
  const localFrame = useCurrentFrame() * speed;
  const totalChars = line.text.length;

  // Chunked reveal: Math.floor of an interpolated count, then snapped to the
  // nearest multiple of `chunkSize`. This is what gives the bursty terminal
  // feel — text doesn't drip, it lurches.
  const linearRevealed = Math.floor(
    interpolate(localFrame, [0, totalChars / charsPerFrame], [0, totalChars], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const revealed = Math.min(totalChars, Math.ceil(linearRevealed / chunkSize) * chunkSize);
  const visible = line.text.substring(0, revealed);
  const typingDone = revealed >= totalChars;
  // 2 Hz blink at any framerate.
  const cursorVisible = Math.floor((localFrame / fps) * 2) % 2 === 0;

  return (
    <div
      style={{
        height: lineHeight,
        fontSize,
        color: TYPE_COLORS[line.type],
        display: "flex",
        alignItems: "center",
        whiteSpace: "pre",
      }}
    >
      {line.type === "command" && (
        <span style={{ color: "#22c55e", marginRight: 8 }}>{prompt}</span>
      )}
      <span>{visible}</span>
      {!typingDone && cursorVisible && (
        <span
          style={{
            display: "inline-block",
            width: fontSize * 0.55,
            height: fontSize,
            background: TYPE_COLORS[line.type],
            marginLeft: 2,
          }}
        />
      )}
    </div>
  );
}
