import { createProviderRegistry, gateway, type ProviderRegistryProvider } from "ai";
import { createOllama } from "ai-sdk-ollama";

import type { ProviderName } from "./options";

export type SelectedModel = {
  label: string;
  model: string;
};

type RegisteredLanguageModel = ReturnType<ProviderRegistryProvider["languageModel"]>;

export const modelProviderRegistry: ProviderRegistryProvider = createProviderRegistry({
  "ai-gateway": gateway,
  ollama: createOllama(),
});

export const describeSelectedModel = ({
  provider,
  model,
}: {
  provider: ProviderName;
  model: string;
}): SelectedModel => ({
  label: provider === "ai-gateway" ? "AI Gateway" : "Ollama",
  model,
});

export const createLanguageModel = ({
  provider,
  model,
}: {
  provider: ProviderName;
  model: string;
}): RegisteredLanguageModel => modelProviderRegistry.languageModel(`${provider}:${model}`);
