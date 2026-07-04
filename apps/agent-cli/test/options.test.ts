import { describe, expect, test } from "bun:test";

import { parseCliOptions } from "../src/options";

describe("parseCliOptions", () => {
  test("uses AI Gateway defaults from the current directory", () => {
    expect(parseCliOptions([], "/repo")).toEqual({
      cwd: "/repo",
      help: false,
      maxSteps: 20,
      model: "anthropic/claude-sonnet-4.6",
      provider: "ai-gateway",
      setup: false,
    });
  });

  test("parses provider, model, cwd, and max steps", () => {
    expect(
      parseCliOptions(
        [
          "--provider",
          "ollama",
          "--model=gemma4:12b",
          "--cwd",
          "/workspace",
          "--max-steps",
          "12",
          "--skills-dir",
          "/skills",
        ],
        "/repo",
      ),
    ).toEqual({
      cwd: "/workspace",
      help: false,
      maxSteps: 12,
      model: "gemma4:12b",
      provider: "ollama",
      skillsDirectory: "/skills",
      setup: false,
    });
  });

  test("uses the local Gemma 4 Ollama model by default", () => {
    expect(parseCliOptions(["--provider", "ollama"], "/repo")).toEqual({
      cwd: "/repo",
      help: false,
      maxSteps: 20,
      model: "gemma4:12b",
      provider: "ollama",
      setup: false,
    });
  });

  test("rejects unsupported provider names", () => {
    expect(() => parseCliOptions(["--provider", "openai"], "/repo")).toThrow(
      'Unsupported provider "openai". Use ai-gateway or ollama.',
    );
  });

  test("rejects unsupported model names", () => {
    expect(() => parseCliOptions(["--provider", "ollama", "--model", "llama3.2"], "/repo")).toThrow(
      'Unsupported model "llama3.2" for provider "ollama". Add it to configuredModelOptions first.',
    );
  });

  test("rejects missing option values", () => {
    expect(() => parseCliOptions(["--model"], "/repo")).toThrow("Missing value for --model");
  });

  test("rejects invalid max step counts", () => {
    expect(() => parseCliOptions(["--max-steps", "0"], "/repo")).toThrow(
      "--max-steps must be a positive integer",
    );
  });

  test("parses help flag without changing defaults", () => {
    expect(parseCliOptions(["--help"], "/repo")).toEqual({
      cwd: "/repo",
      help: true,
      maxSteps: 20,
      model: "anthropic/claude-sonnet-4.6",
      provider: "ai-gateway",
      setup: false,
    });
  });

  test("parses setup flag without changing defaults", () => {
    expect(parseCliOptions(["--setup"], "/repo")).toEqual({
      cwd: "/repo",
      help: false,
      maxSteps: 20,
      model: "anthropic/claude-sonnet-4.6",
      provider: "ai-gateway",
      setup: true,
    });
  });
});
