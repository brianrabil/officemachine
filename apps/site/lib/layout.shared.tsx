import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: "Harness",
        url: "/products/harness",
        description: "A durable, sandboxed agent runtime built on AI SDK v7",
      },
      {
        text: "Blocks",
        url: "/blocks",
        description: "An installable shadcn block registry",
      },
      {
        type: "menu",
        text: "Tools",
        items: [
          {
            text: "Harness",
            url: "/products/harness",
            description: "A durable, sandboxed agent runtime built on AI SDK v7",
          },
          {
            text: "Memory (coming soon)",
            url: "/products/memory",
            description: "Persistent memory for the agent — coming soon",
          },
          {
            text: "CLI",
            url: "/products/cli",
            description: "Scripting and piping against the same harness",
          },
          {
            text: "Terminal",
            url: "/products/terminal",
            description: "A native shell streaming an in-browser terminal, no PTY",
          },
          {
            text: "ADE (coming soon)",
            url: "/products/ade",
            description: "Details coming soon",
          },
          {
            text: "Browser",
            url: "/products/browser",
            description: "A native shell streaming a real Chromium view into the UI",
          },
        ],
      },
      { type: "main", text: "Docs", url: "/docs" },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
