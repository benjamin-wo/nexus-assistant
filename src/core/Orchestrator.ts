import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { StorageService, Message } from "../database/Storage";
import { LlmService } from "./LlmService";
import { WorkerAgent } from "./WorkerAgent";
import { TaskRegistry } from "./TaskRegistry";

export class Orchestrator {
  private llmService: LlmService;

  constructor() {
    this.llmService = new LlmService();
  }

  async processMessage(chatId: string, userText: string): Promise<string> {
    const storage = new StorageService();
    await storage.initialize();

    const startTime = Date.now();
    let isError = false;
    let logMsg = "";
    let finalResponse = "";

    try {
      // 1. Intercept Task Commands
      const statusMatch = userText.match(/^\/status|^what's running|^status/i);
      if (statusMatch) {
        const active = await storage.getActiveTasks(chatId);
        if (active.length === 0) {
          return "ℹ️ There are no active background tasks running for this chat.";
        }
        return "⏳ **Active Background Tasks:**\n" + active
          .map((t) => `- \`${t.taskId}\`: ${t.description} (Started ${t.createdAt.toLocaleTimeString()})`)
          .join("\n");
      }

      const cancelMatch = userText.match(/^(?:cancel|stop)\s+(task_[a-z0-9]+)/i);
      if (cancelMatch) {
        const taskId = cancelMatch[1];
        const success = await TaskRegistry.getInstance().cancelTask(taskId);
        if (success) {
          return `🛑 Task \`${taskId}\` has been cancelled successfully.`;
        }
        return `⚠️ Task \`${taskId}\` was not found or is not running.`;
      }

      // 2. Fetch Chat History and personality/user context
      const history = await storage.getHistory(chatId, 15);
      
      const soulPath = join(process.cwd(), ".agent", "soul.md");
      const userPath = join(process.cwd(), ".agent", "user.md");
      let soulPrompt = "";
      let userMemory = "";

      if (existsSync(soulPath)) {
        soulPrompt = `\n\n# Your Personality & Tone (Soul)\n${await readFile(soulPath, "utf-8")}`;
      }
      if (existsSync(userPath)) {
        userMemory = `\n\n# User Memory & Preferences\n${await readFile(userPath, "utf-8")}`;
      }

      // Add current message to temporary history for classification
      const tempHistory: Message[] = [
        ...history,
        { role: "user", content: userText },
      ];

      // 3. Load Router Instructions
      const routerPath = join(process.cwd(), ".agent", "orchestrator.md");
      if (!existsSync(routerPath)) {
        throw new Error("Orchestrator instruction profile (.agent/orchestrator.md) is missing.");
      }
      const routerInstructions = await readFile(routerPath, "utf-8");
      const routerInstructionsWithContext = `${routerInstructions}${soulPrompt}${userMemory}`;

      // Prepend router instructions to system prompt
      const classificationMessages: Message[] = [
        { role: "system", content: routerInstructionsWithContext },
        ...tempHistory,
      ];

      console.log("[Orchestrator] Routing user request...");
      const routeResponse = await this.llmService.generateResponse(classificationMessages);

      // Check if routing requires spawning a subagent
      const spawnMatch = routeResponse.match(/<spawn>([a-zA-Z0-9]+)<\/spawn>/i);

      if (spawnMatch) {
        const workerName = spawnMatch[1];
        console.log(`[Orchestrator] Spawning worker: ${workerName}`);

        // 4. Load Worker Profile and allowed skills
        const workerPath = join(process.cwd(), ".agent", "agents", `${workerName}.md`);
        if (!existsSync(workerPath)) {
          throw new Error(`Worker profile '${workerName}' (.agent/agents/${workerName}.md) is missing.`);
        }
        const workerMd = await readFile(workerPath, "utf-8");

        // Simple markdown bullet parser to extract allowed skills list
        const skillsSection = workerMd.match(/## Available Skills\r?\n([\s\S]*?)(?:\r?\n##|$)/i);
        const allowedSkills: string[] = [];
        if (skillsSection) {
          const lines = skillsSection[1].split("\n");
          for (const line of lines) {
            const skillMatch = line.match(/^[-*]\s+`?([a-zA-Z0-9_]+)`?/);
            if (skillMatch) {
              allowedSkills.push(skillMatch[1].trim());
            }
          }
        }

        console.log(`[Orchestrator] Allowed skills parsed for ${workerName}:`, allowedSkills);

        // Prepend soul and user memory to worker instructions so they carry over
        const workerInstructionsWithContext = `${workerMd}${soulPrompt}${userMemory}`;

        // Instantiate and run Worker
        const worker = new WorkerAgent(workerName, workerInstructionsWithContext, allowedSkills);
        finalResponse = await worker.execute(history.concat({ role: "user", content: userText }), chatId);
      } else {
        // Direct response from Router (greetings, direct answers, errors)
        finalResponse = routeResponse.replace(/<spawn>.*?<\/spawn>/gi, "").trim();
      }

      // 5. Commit conversations to history
      await storage.saveMessage(chatId, { role: "user", content: userText });
      await storage.saveMessage(chatId, { role: "assistant", content: finalResponse });

      logMsg = `Successfully processed request in ${Date.now() - startTime}ms`;
      return finalResponse;
    } catch (error: any) {
      isError = true;
      logMsg = `Orchestration error: ${error.message}`;
      console.error("[Orchestrator Error]", error);
      return `❌ An internal agent error occurred: ${error.message}`;
    } finally {
      // Telemetry log tracking
      await storage.logEvent({
        category: "orchestrator",
        message: logMsg,
        durationMs: Date.now() - startTime,
        isError,
      });
      await storage.close();
    }
  }
}
