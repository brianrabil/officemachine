import { getVercelOidcToken } from "@vercel/oidc";
import { HTTPError } from "nitro";
import type {
  SkillsShCuratedResponse,
  SkillsShDetail,
  SkillsShListResponse,
  SkillsShSearchResponse,
  SkillsShAuditResponse,
} from "#server/schema.ts";

const SKILLS_SH_BASE = "https://skills.sh/api/v1";

// Not configured until this project is `vercel link`ed and `vercel env pull`ed
// (or VERCEL_OIDC_TOKEN is otherwise set) — skills.sh has no anonymous tier.
export class SkillsShNotConfiguredError extends Error {
  constructor() {
    super(
      "skills.sh requires a Vercel OIDC token. Run `vercel link && vercel env pull` for this project.",
    );
    this.name = "SkillsShNotConfiguredError";
  }
}

async function skillsShFetch<T>(path: string): Promise<T> {
  const token = await getVercelOidcToken().catch(() => undefined);
  if (!token) {
    throw new SkillsShNotConfiguredError();
  }

  const res = await fetch(`${SKILLS_SH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: "unknown", message: res.statusText }))) as {
      error?: string;
      message?: string;
    };
    throw new Error(`skills.sh ${path} failed (${res.status}): ${body.message ?? body.error}`);
  }

  return res.json() as Promise<T>;
}

export function listSkills(
  params: { view?: "all-time" | "trending" | "hot"; page?: number; perPage?: number } = {},
): Promise<SkillsShListResponse> {
  const search = new URLSearchParams();
  if (params.view) search.set("view", params.view);
  if (params.page != null) search.set("page", String(params.page));
  if (params.perPage != null) search.set("per_page", String(params.perPage));
  const qs = search.toString();
  return skillsShFetch(`/skills${qs ? `?${qs}` : ""}`);
}

export function searchSkills(params: {
  q: string;
  limit?: number;
  owner?: string;
}): Promise<SkillsShSearchResponse> {
  const search = new URLSearchParams({ q: params.q });
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.owner) search.set("owner", params.owner);
  return skillsShFetch(`/skills/search?${search.toString()}`);
}

export function getCuratedSkills(): Promise<SkillsShCuratedResponse> {
  return skillsShFetch("/skills/curated");
}

export function getSkill(id: string): Promise<SkillsShDetail> {
  return skillsShFetch(`/skills/${id}`);
}

export function getSkillAudit(id: string): Promise<SkillsShAuditResponse> {
  return skillsShFetch(`/skills/audit/${id}`);
}

// Routes call this from a catch block so an unconfigured OIDC token surfaces
// as a clean 503 instead of an opaque 500.
export function toHttpError(error: unknown): Error {
  return error instanceof SkillsShNotConfiguredError
    ? new HTTPError(error.message, { status: 503 })
    : error instanceof Error
      ? error
      : new Error(String(error));
}
