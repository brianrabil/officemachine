import { createProviderRegistry, customProvider, gateway } from "ai";
import { ollama } from "ai-sdk-ollama";

export const registry = createProviderRegistry({
  gateway: customProvider({
    languageModels: {
      "deepseek-v4-flash": gateway("deepseek/deepseek-v4-flash"),
      "deepseek-v4-pro": gateway("deepseek/deepseek-v4-pro"),
    },
    fallbackProvider: gateway,
  }),
  ollama: customProvider({
    languageModels: {
      "gemma4:12b": ollama("gemma4:12b"),
      "gemma4:12b-mlx": ollama("gemma4:12b-mlx"),
    },
    embeddingModels: {
      embeddinggemma: ollama.embeddingModel("embeddinggemma:latest"),
    },
    fallbackProvider: ollama,
  }),
});
