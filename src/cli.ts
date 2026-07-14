import { Orchestrator } from "./core/Orchestrator";
import { SkillRegistry } from "./core/SkillRegistry";
import { Scheduler } from "./services/Scheduler";
import { TaskRegistry } from "./core/TaskRegistry";

async function main() {
  console.log("=========================================");
  console.log("   Hermes Personal Assistant - Local CLI  ");
  console.log("=========================================");

  // 1. Initialize Skill Registry
  const registry = SkillRegistry.getInstance();
  await registry.initialize();
  console.log(`[System] Registered ${registry.getSkills().length} modular skills.`);

  const orchestrator = new Orchestrator();
  const scheduler = new Scheduler();

  // 2. Start Background Scheduler (Secretary/DevOps alert logs print to console)
  scheduler.start(async (chatId, message) => {
    console.log(`\n\n[PROACTIVE ALERT - ${chatId}]`);
    console.log(message);
    console.log("\nYou > ");
  });

  // 3. Register TaskRegistry Completion Hook
  TaskRegistry.getInstance().setCompletionCallback(
    async (taskId, chatId, description, success, resultOrError) => {
      console.log(`\n\n[BACKGROUND TASK ALERT - ${chatId}]`);
      if (success) {
        console.log(`✅ Task '${taskId}' completed successfully!\nDescription: ${description}\nOutput:\n`, resultOrError);
      } else {
        console.log(`❌ Task '${taskId}' failed!\nDescription: ${description}\nError: ${resultOrError}`);
      }
      console.log("\nYou > ");
    }
  );

  console.log("\nType your message below (or type 'exit' / 'quit' to stop).");
  console.log("Type 'status' to view active background jobs.");
  console.log("=========================================\n");

  const chatId = "cli_chat_session";

  while (true) {
    // Read user input from terminal
    const userText = prompt("You > ");
    
    if (userText === null) continue;
    const cleanText = userText.trim();
    
    if (cleanText.toLowerCase() === "exit" || cleanText.toLowerCase() === "quit") {
      console.log("\nExiting assistant...");
      break;
    }
    
    if (cleanText === "") continue;

    console.log("\nThinking...");
    const response = await orchestrator.processMessage(chatId, cleanText);
    console.log(`\nAssistant > ${response}\n`);
  }

  scheduler.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
