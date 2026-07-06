import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "h3";
import { listSkills, toHttpError } from "#server/utils/skills-sh.ts";
import { skillsListQuerySchema } from "#server/schema.ts";

defineRouteMeta({
  openAPI: {
    tags: ["skills"],
    description: "List skills, optionally sorted by view (all-time, trending, hot).",
    parameters: [
      {
        in: "query",
        name: "view",
        schema: { type: "string", enum: ["all-time", "trending", "hot"] },
      },
      { in: "query", name: "page", schema: { type: "integer" } },
      { in: "query", name: "per_page", schema: { type: "integer" } },
    ],
    responses: {
      200: {
        description: "Paginated skill list",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SkillsShListResponse" },
          },
        },
      },
      503: { description: "skills.sh is not configured (missing Vercel OIDC token)" },
    },
    $global: {
      components: {
        schemas: {
          SkillsShSkill: {
            type: "object",
            properties: {
              id: { type: "string" },
              slug: { type: "string" },
              name: { type: "string" },
              source: { type: "string" },
              installs: { type: "number" },
              sourceType: { type: "string", enum: ["github", "well-known"] },
              installUrl: { type: ["string", "null"] },
              url: { type: "string" },
              isDuplicate: { type: "boolean" },
              installsYesterday: { type: "number" },
              change: { type: "number" },
            },
            required: ["id", "slug", "name", "source", "installs", "sourceType", "installUrl", "url"],
          },
          SkillsShPagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              perPage: { type: "integer" },
              total: { type: "integer" },
              hasMore: { type: "boolean" },
            },
            required: ["page", "perPage", "total", "hasMore"],
          },
          SkillsShListResponse: {
            type: "object",
            properties: {
              data: { type: "array", items: { $ref: "#/components/schemas/SkillsShSkill" } },
              pagination: { $ref: "#/components/schemas/SkillsShPagination" },
            },
            required: ["data", "pagination"],
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const { view, page, per_page: perPage } = await getValidatedQuery(event, skillsListQuerySchema);

  return listSkills({ view, page, perPage }).catch((error) => {
    throw toHttpError(error);
  });
});
