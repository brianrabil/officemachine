import { env } from "@workspace/config/env";

export const appName = env.APP_NAME;
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";
export const docsContentRoute = "/llms.mdx/docs";

export const gitConfig = {
  user: env.APP_GITHUB_USER,
  repo: env.APP_GITHUB_REPO,
  branch: env.APP_GITHUB_BRANCH,
};
