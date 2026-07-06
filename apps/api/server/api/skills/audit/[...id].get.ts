import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedRouterParams } from "h3";
import { getSkillAudit, toHttpError } from "#server/utils/skills-sh.ts";
import { skillAuditIdParamsSchema } from "#server/schema.ts";

defineRouteMeta({
  openAPI: {
    tags: ["skills"],
    description: "Get audit history for a single skill.",
    responses: {
      200: {
        description: "Skill audit history",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SkillsShAuditResponse" },
          },
        },
      },
      503: { description: "skills.sh is not configured (missing Vercel OIDC token)" },
    },
    $global: {
      components: {
        schemas: {
          SkillsShAuditEntry: {
            type: "object",
            properties: {
              provider: { type: "string" },
              slug: { type: "string" },
              status: { type: "string", enum: ["pass", "warn", "fail"] },
              summary: { type: "string" },
              auditedAt: { type: "string" },
              riskLevel: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
              categories: { type: "array", items: { type: "string" } },
            },
            required: ["provider", "slug", "status", "summary", "auditedAt"],
          },
          SkillsShAuditResponse: {
            type: "object",
            properties: {
              id: { type: "string" },
              source: { type: "string" },
              slug: { type: "string" },
              audits: { type: "array", items: { $ref: "#/components/schemas/SkillsShAuditEntry" } },
            },
            required: ["id", "source", "slug", "audits"],
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, skillAuditIdParamsSchema);

  return getSkillAudit(id).catch((error) => {
    throw toHttpError(error);
  });
});
