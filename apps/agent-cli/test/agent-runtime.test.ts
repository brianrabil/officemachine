import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelMessage } from "ai";

import { createAgentRuntime, estimateMessageTokens } from "../src/agent-runtime";
import { createLanguageModel } from "../src/provider-registry";

describe("agent runtime", () => {
  test("estimates message tokens from serialized message length", () => {
    const messages: ModelMessage[] = [{ role: "user", content: "abcd" }];

    expect(estimateMessageTokens(messages)).toBeGreaterThan(0);
  });

  test("loads bash-tool skills from the configured directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-cli-"));
    const skillsDirectory = join(root, "skills");
    const skillDirectory = join(skillsDirectory, "demo");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      join(skillDirectory, "SKILL.md"),
      [
        "---",
        "name: demo",
        "description: Demo skill for runtime wiring",
        "---",
        "Use this demo skill when asked.",
      ].join("\n"),
    );

    const runtime = await createAgentRuntime({
      cwd: root,
      maxSteps: 1,
      model: createLanguageModel({ model: "gemma4:12b", provider: "ollama" }),
      skillsDirectory,
    });

    expect(Object.keys(runtime.tools)).toContain("skill");
    expect(Object.keys(runtime.tools)).toContain("bash");
    expect(Object.keys(runtime.tools)).toContain("readFile");
    expect(Object.keys(runtime.tools)).toContain("writeFile");
  });
});
