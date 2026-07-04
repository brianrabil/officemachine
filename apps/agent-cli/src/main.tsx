#!/usr/bin/env bun

import { render } from "ink";

import { AgentApp } from "./agent-app";
import { HelpApp } from "./help-app";
import type { CliOptions } from "./options";
import { parseCliOptions } from "./options";
import { SetupApp } from "./setup-app";

const renderHelp = async () => {
  const help = render(<HelpApp />);
  await help.waitUntilExit();
};

const renderSetup = async (cwd: string) => {
  if (!process.stdin.isTTY) {
    process.stderr.write("--setup requires an interactive terminal.\n");
    process.exitCode = 1;
    return;
  }

  const setup = render(<SetupApp cwd={cwd} />);
  await setup.waitUntilExit();
};

const main = async () => {
  let options: CliOptions;
  try {
    options = parseCliOptions(process.argv.slice(2), process.cwd());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n`);
    process.exitCode = 1;
    await renderHelp();
    return;
  }

  if (options.help) {
    await renderHelp();
    return;
  }

  if (options.setup) {
    await renderSetup(options.cwd);
    return;
  }

  if (!process.stdin.isTTY) {
    process.stderr.write("agent-cli requires an interactive terminal.\n");
    process.exitCode = 1;
    return;
  }

  render(<AgentApp options={options} />);
};

void main();
