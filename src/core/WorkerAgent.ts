import { Message } from "../database/Storage";
import { LlmService } from "./LlmService";
import { SkillRegistry } from "./SkillRegistry";

export class WorkerAgent {
  private name: string;
  private systemPrompt: string;
  private allowedSkills: string[];
  private llmService: LlmService;

  constructor(name: string, systemPrompt: string, allowedSkills: string[]) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.allowedSkills = allowedSkills;
    this.llmService = new LlmService();
  }

  async execute(chatHistory: Message[], chatId: string): Promise<string> {
    const registry = SkillRegistry.getInstance();
    const skillsList = registry.getSkills().filter((s) => this.allowedSkills.includes(s.name));

    // Format tool definitions in Hermes standard XML structure
    const toolsXml = skillsList
      .map((s) => {
        return JSON.stringify({
          type: "function",
          function: {
            name: s.name,
            description: s.description,
            parameters: s.parameters,
          },
        });
      })
      .join("\n");

    const skillInstructions = skillsList
      .filter((s) => s.instructions && s.instructions.trim())
      .map((s) => `### Guidelines & Instructions for using tool '${s.name}':\n${s.instructions}`)
      .join("\n\n");

    const systemPromptTemplate = `${this.systemPrompt}

${skillInstructions ? `## Skill Guidelines & Protocols\n${skillInstructions}\n\n` : ""}## System Instructions & Protocols
You are executing in a ReAct loop. You can use the tools provided below.
To reason about your next step, write your reasoning within '<thought></thought>' tags.
If you need to call a tool, you must write a single '<tool_call>{"name": "toolName", "arguments": {...}}</tool_call>' tag directly after your thought block.
When the tool output is received, you will be given a '<tool_response></tool_response>' block. Read it and continue your reasoning.
If you do not need to call any more tools, simply output your final markdown response without any <tool_call> tags.

Available tools:
<tools>
${toolsXml}
</tools>

Format requirements:
- Always think first using <thought>your step-by-step reasoning</thought>.
- Keep tool calls exact: <tool_call>{"name": "...", "arguments": {...}}</tool_call>.
- Do not make assumptions about argument values.
`;

    // Initialize messages array for the ReAct session
    const messages: Message[] = [
      { role: "system", content: systemPromptTemplate },
      ...chatHistory,
    ];

    let turns = 0;
    const maxTurns = 5;

    while (turns < maxTurns) {
      turns++;
      console.log(`[WorkerAgent:${this.name}] Turn ${turns}/${maxTurns}...`);

      const completion = await this.llmService.generateResponse(messages);
      
      // Save LLM turn to the execution dialogue
      messages.push({ role: "assistant", content: completion, subagent: this.name });

      // Extract thought and tool_call
      const thoughtMatch = completion.match(/<thought>([\s\S]*?)<\/thought>/i);
      const toolCallMatch = completion.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);

      if (thoughtMatch) {
        console.log(`[Thought] ${thoughtMatch[1].trim()}`);
      }

      if (toolCallMatch) {
        const rawJson = toolCallMatch[1].trim();
        let toolName = "";
        let toolArgs: any = {};

        try {
          const parsed = JSON.parse(rawJson);
          toolName = parsed.name;
          toolArgs = parsed.arguments || parsed.args || {};
        } catch (err: any) {
          console.warn(`[WorkerAgent] JSON parse error on tool call: ${rawJson}`);
          messages.push({
            role: "user",
            content: `<tool_response>{"success": false, "error": "Invalid JSON format in tool call: ${err.message}. Please correct the formatting and try again."}</tool_response>`,
          });
          continue;
        }

        console.log(`[Tool Call] Executing '${toolName}' with args:`, toolArgs);

        if (!this.allowedSkills.includes(toolName)) {
          messages.push({
            role: "user",
            content: `<tool_response>{"success": false, "error": "Permission denied: Tool '${toolName}' is not allowed for worker '${this.name}'."}</tool_response>`,
          });
          continue;
        }

        try {
          // Execute skill, passing chatId as context metadata
          const result = await registry.executeSkill(toolName, toolArgs, { chatId });
          console.log(`[Tool Response] '${toolName}' succeeded.`);
          
          if (result && result.success === false && result.error === "NOT_AUTHENTICATED") {
            return `🔒 **Google Authentication Required**\n\nTo allow me to access your Google account, please authorize access by visiting this link:\n\n👉 [Authorize Google Account](${result.authUrl})\n\nAfter authorizing, return here and run your command again!`;
          }

          messages.push({
            role: "user",
            content: `<tool_response>${JSON.stringify(result)}</tool_response>`,
          });
        } catch (err: any) {
          console.error(`[Tool Error] '${toolName}' failed:`, err.message);
          messages.push({
            role: "user",
            content: `<tool_response>{"success": false, "error": "${err.message}"}</tool_response>`,
          });
        }
      } else {
        // No tool call: ReAct loop has completed and returned the final answer
        // Clean out instructions/thoughts and return the final text block response
        const cleanResponse = completion.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
        return cleanResponse;
      }
    }

    return "⚠️ I reached my maximum reasoning steps (5 turns) without resolving the query. Please refine your request or check logs.";
  }
}
