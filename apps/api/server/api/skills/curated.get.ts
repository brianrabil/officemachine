import { defineHandler, defineRouteMeta } from "nitro";
import { getCuratedSkills, toHttpError } from "#server/utils/skills-sh.ts";

defineRouteMeta({
  openAPI: {
    tags: ["skills"],
    description: "List curated skill groups, aggregated by owner.",
    responses: {
      200: {
        description: "Curated skill groups",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SkillsShCuratedResponse" },
          },
        },
      },
      503: { description: "skills.sh is not configured (missing Vercel OIDC token)" },
    },
    $global: {
      components: {
        schemas: {
          SkillsShCuratedGroup: {
            type: "object",
            properties: {
              owner: { type: "string" },
              totalInstalls: { type: "number" },
              featuredRepo: { type: "string" },
              featuredSkill: { type: "string" },
              skills: { type: "array", items: { $ref: "#/components/schemas/SkillsShSkill" } },
            },
            required: ["owner", "totalInstalls", "featuredRepo", "featuredSkill", "skills"],
          },
          SkillsShCuratedResponse: {
            type: "object",
            properties: {
              data: { type: "array", items: { $ref: "#/components/schemas/SkillsShCuratedGroup" } },
              totalOwners: { type: "integer" },
              totalSkills: { type: "integer" },
              generatedAt: { type: "string" },
            },
            required: ["data", "totalOwners", "totalSkills", "generatedAt"],
          },
        },
      },
    },
  },
});

export default defineHandler(() => getCuratedSkills().catch((error) => {
  throw toHttpError(error);
}));
