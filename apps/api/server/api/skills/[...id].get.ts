import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedRouterParams } from "h3";
import { getSkill, toHttpError } from "#server/utils/skills-sh.ts";
import { skillIdParamsSchema } from "#server/schema.ts";

defineRouteMeta({
  openAPI: {
    tags: ["skills"],
    description: "Get a single skill's details, including its file contents.",
    responses: {
      200: {
        description: "Skill detail",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SkillsShDetail" },
          },
        },
      },
      503: { description: "skills.sh is not configured (missing Vercel OIDC token)" },
    },
    $global: {
      components: {
        schemas: {
          SkillsShDetail: {
            type: "object",
            properties: {
              id: { type: "string" },
              source: { type: "string" },
              slug: { type: "string" },
              installs: { type: "number" },
              hash: { type: ["string", "null"] },
              files: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    contents: { type: "string" },
                  },
                  required: ["path", "contents"],
                },
              },
            },
            required: ["id", "source", "slug", "installs", "hash", "files"],
          },
        },
      },
    },
  },
});

// Catches multi-segment ids like "vercel-labs/skills/find-skills" (github
// sources) or "mintlify.com/mintlify" (well-known sources) as one param.
export default defineHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, skillIdParamsSchema);

  return getSkill(id).catch((error) => {
    throw toHttpError(error);
  });
});
