import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "h3";
import { searchSkills, toHttpError } from "#server/utils/skills-sh.ts";
import { skillsSearchQuerySchema } from "#server/schema.ts";

defineRouteMeta({
  openAPI: {
    tags: ["skills"],
    description: "Search skills by name/description (fuzzy or semantic).",
    parameters: [
      { in: "query", name: "q", required: true, schema: { type: "string", minLength: 2 } },
      { in: "query", name: "limit", schema: { type: "integer" } },
      { in: "query", name: "owner", schema: { type: "string" } },
    ],
    responses: {
      200: {
        description: "Search results",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SkillsShSearchResponse" },
          },
        },
      },
      400: { description: "`q` must be at least 2 characters" },
      503: { description: "skills.sh is not configured (missing Vercel OIDC token)" },
    },
    $global: {
      components: {
        schemas: {
          SkillsShSearchResponse: {
            type: "object",
            properties: {
              data: { type: "array", items: { $ref: "#/components/schemas/SkillsShSkill" } },
              query: { type: "string" },
              searchType: { type: "string", enum: ["fuzzy", "semantic"] },
              count: { type: "integer" },
              durationMs: { type: "number" },
            },
            required: ["data", "query", "searchType", "count", "durationMs"],
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const { q, limit, owner } = await getValidatedQuery(event, skillsSearchQuerySchema);

  return searchSkills({ q, limit, owner }).catch((error) => {
    throw toHttpError(error);
  });
});
