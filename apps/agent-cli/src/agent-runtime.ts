import {
  type LanguageModel,
  type ModelMessage,
  pruneMessages,
  stepCountIs,
  ToolLoopAgent,
  type ToolSet,
} from "ai";
import { createBashTool, experimental_createSkillTool } from "bash-tool";

export type AgentRuntime = ToolLoopAgent<never, ToolSet>;

export type AgentRuntimeOptions = {
  cwd: string;
  maxSteps: number;
  model: LanguageModel;
  skillsDirectory?: string;
};

const COMPACT_AFTER_TOKENS = 100_000;

const workspaceInstructions = `You are an expert coding agent running inside a terminal CLI.
Use the bash-tool readFile, writeFile, and bash tools directly.
Use readFile before editing files when you need current contents.
Use writeFile for concrete file edits.
Use bash for shell commands, tests, build commands, and focused inspection.
When a tool execution is denied, do not retry the same operation.
Be concise, make concrete code changes when asked, and report commands you run.`;

export const estimateMessageTokens = (messages: ModelMessage[]) =>
  Math.ceil(JSON.stringify(messages).length / 4);

export async function createAgentRuntime(options: AgentRuntimeOptions) {
  let agentTools: ToolSet;

  if (options.skillsDirectory) {
    const { files, instructions, skill } = await experimental_createSkillTool({
      skillsDirectory: options.skillsDirectory,
    });
    const { tools } = await createBashTool({
      extraInstructions: instructions,
      files,
      uploadDirectory: { source: options.cwd },
    });

    agentTools = { skill, ...tools };
  } else {
    const { tools } = await createBashTool({
      uploadDirectory: { source: options.cwd },
    });
    agentTools = tools;
  }

  return new ToolLoopAgent({
    id: "agent-cli",
    instructions: workspaceInstructions,
    model: options.model,
    prepareStep: ({ messages }) => {
      if (estimateMessageTokens(messages) > COMPACT_AFTER_TOKENS) {
        return {
          messages: pruneMessages({
            emptyMessages: "remove",
            messages,
            reasoning: "all",
            toolCalls: "before-last-3-messages",
          }),
        };
      }
    },
    stopWhen: stepCountIs(options.maxSteps),
    tools: agentTools,
  });
}
