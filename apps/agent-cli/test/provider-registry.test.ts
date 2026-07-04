import { describe, expect, test } from "bun:test";

import { createLanguageModel, describeSelectedModel } from "../src/provider-registry";

describe("describeSelectedModel", () => {
  test("returns a stable provider label and display model", () => {
    expect(
      describeSelectedModel({
        model: "anthropic/claude-sonnet-4.6",
        provider: "ai-gateway",
      }),
    ).toEqual({
      label: "AI Gateway",
      model: "anthropic/claude-sonnet-4.6",
    });
  });
});

describe("createLanguageModel", () => {
  test("resolves ai-gateway models through the provider registry", () => {
    expect(
      createLanguageModel({
        model: "anthropic/claude-sonnet-4.6",
        provider: "ai-gateway",
      }).modelId,
    ).toBe("anthropic/claude-sonnet-4.6");
  });

  test("resolves ollama models through the provider registry", () => {
    expect(createLanguageModel({ model: "gemma4:12b", provider: "ollama" }).modelId).toBe(
      "gemma4:12b",
    );
  });
});
