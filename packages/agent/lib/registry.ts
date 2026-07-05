import { type KnownProvider } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";

const SUPPORTED_PROVIDERS = [
  "opencode-go",
  "vercel-ai-gateway",
] as const satisfies readonly KnownProvider[];

type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];
type BuiltinProvider = ReturnType<typeof builtinProviders>[number];

export const providers = builtinProviders().filter(
  (provider): provider is BuiltinProvider & { id: SupportedProvider } =>
    (SUPPORTED_PROVIDERS as readonly string[]).includes(provider.id),
);
