import { parseArgs } from "node:util";
import { z } from "zod";

export type ProviderName = "ai-gateway" | "ollama";

export type CliOptions = {
  provider: ProviderName;
  model: string;
  cwd: string;
  maxSteps: number;
  help: boolean;
  setup: boolean;
  skillsDirectory?: string;
};

export type ConfiguredModelOption = {
  context: number;
  id: string;
  model: string;
  name: string;
  provider: string;
  providerName: ProviderName;
};

export const configuredModelOptions: ConfiguredModelOption[] = [
  {
    context: 200_000,
    id: "ai-gateway:anthropic/claude-sonnet-4.6",
    model: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "AI Gateway",
    providerName: "ai-gateway",
  },
  {
    context: 128_000,
    id: "ollama:gemma4:12b",
    model: "gemma4:12b",
    name: "Gemma 4 12B",
    provider: "Ollama",
    providerName: "ollama",
  },
];

const providerDefaults: Record<ProviderName, string> = {
  "ai-gateway": "anthropic/claude-sonnet-4.6",
  ollama: "gemma4:12b",
};

export const providerNames: ProviderName[] = ["ai-gateway", "ollama"];

const providerSchema = z.union([z.literal("ai-gateway"), z.literal("ollama")]);

const parsedValuesSchema = z.object({
  "max-steps": z.coerce.number().int().min(1).default(20),
  "skills-dir": z.string().optional(),
  cwd: z.string().optional(),
  help: z.boolean().default(false),
  model: z.string().optional(),
  provider: providerSchema.default("ai-gateway"),
  setup: z.boolean().default(false),
});

const parseArgsErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export const parseCliOptions = (args: string[], defaultCwd: string): CliOptions => {
  let values: ReturnType<typeof parseArgs>["values"];
  try {
    values = parseArgs({
      allowPositionals: false,
      args,
      options: {
        "max-steps": { type: "string" },
        cwd: { type: "string" },
        help: { short: "h", type: "boolean" },
        model: { type: "string" },
        provider: { type: "string" },
        "skills-dir": { type: "string" },
        setup: { type: "boolean" },
      },
    }).values;
  } catch (error) {
    const parsedError = parseArgsErrorSchema.safeParse(error);
    if (parsedError.success && parsedError.data.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      const option = parsedError.data.message.match(/'(--[^ ]+)/)?.[1];
      if (option) {
        throw new Error(`Missing value for ${option}`);
      }
    }
    throw error;
  }

  const parsed = parsedValuesSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "provider") {
      throw new Error(
        `Unsupported provider "${String(values.provider)}". Use ai-gateway or ollama.`,
      );
    }
    if (issue?.path[0] === "max-steps") {
      throw new Error("--max-steps must be a positive integer");
    }
    throw parsed.error;
  }

  const valuesWithDefaults = parsed.data;
  const selectedModel = valuesWithDefaults.model ?? providerDefaults[valuesWithDefaults.provider];
  const configuredModel = configuredModelOptions.find(
    (entry) => entry.providerName === valuesWithDefaults.provider && entry.model === selectedModel,
  );
  if (!configuredModel) {
    throw new Error(
      `Unsupported model "${selectedModel}" for provider "${valuesWithDefaults.provider}". Add it to configuredModelOptions first.`,
    );
  }

  return {
    cwd: valuesWithDefaults.cwd ?? defaultCwd,
    help: valuesWithDefaults.help,
    maxSteps: valuesWithDefaults["max-steps"],
    model: selectedModel,
    provider: valuesWithDefaults.provider,
    ...(valuesWithDefaults["skills-dir"]
      ? { skillsDirectory: valuesWithDefaults["skills-dir"] }
      : {}),
    setup: valuesWithDefaults.setup,
  };
};
