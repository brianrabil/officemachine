import { defineConfig } from "orval";

export default defineConfig({
  // HTTP client generation
  aiGateway: {
    input: { target: "./openapi/ai-gateway.yaml" },
    output: {
      mode: "split",
      target: "./lib/client.ts",
      schemas: "./lib/model",
      client: "fetch",
      baseUrl: { getBaseUrlFromSpecification: true },
    },
  },
  // Zod schema generation
  aiGatewayZod: {
    input: { target: "./openapi/ai-gateway.yaml" },
    output: {
      mode: "split",
      client: "zod",
      target: "./lib/client",
      fileExtension: ".zod.ts",
    },
  },
  // SWR hooks generation
  aiGatewaySwr: {
    input: { target: "./openapi/ai-gateway.yaml" },
    output: {
      mode: "split",
      target: "./lib/hooks.ts",
      schemas: "./lib/model",
      client: "swr",
      baseUrl: { getBaseUrlFromSpecification: true },
    },
  },
});
