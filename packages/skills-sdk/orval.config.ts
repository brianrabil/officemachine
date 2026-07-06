import { defineConfig } from "orval";

export default defineConfig({
  // HTTP client generation
  skills: {
    input: { target: "./openapi/skills-sh.yaml" },
    output: {
      mode: "split",
      target: "./lib/client.ts",
      schemas: "./lib/model",
      client: "fetch",
      baseUrl: { getBaseUrlFromSpecification: true },
    },
  },
  // Zod schema generation
  skillsZod: {
    input: { target: "./openapi/skills-sh.yaml" },
    output: {
      mode: "split",
      client: "zod",
      target: "./lib/client",
      fileExtension: ".zod.ts",
    },
  },
  // SWR hooks generation
  skillsSwr: {
    input: { target: "./openapi/skills-sh.yaml" },
    output: {
      mode: "split",
      target: "./lib/hooks.ts",
      schemas: "./lib/model",
      client: "swr",
      baseUrl: { getBaseUrlFromSpecification: true },
    },
  },
});
