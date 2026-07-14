import { Bot } from "grammy";
import { Orchestrator } from "./core/Orchestrator";
import { SkillRegistry } from "./core/SkillRegistry";
import { Scheduler } from "./services/Scheduler";
import { TaskRegistry } from "./core/TaskRegistry";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN is not defined in the environment.");
    process.exit(1);
  }

  console.log("[Telegram] Initializing bot...");

  // 1. Initialize Skill Registry
  const registry = SkillRegistry.getInstance();
  await registry.initialize();
  console.log(`[Telegram] Loaded ${registry.getSkills().length} skills.`);

  const bot = new Bot(token);
  const orchestrator = new Orchestrator();
  const scheduler = new Scheduler();

  // 2. Start Scheduler (Secretary alert callback routes directly to Telegram Chat ID)
  scheduler.start(async (chatId, message) => {
    try {
      await bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (err: any) {
      console.error(`[Telegram Scheduler Alert] Failed to send to ${chatId}:`, err.message);
    }
  });

  // 3. Register TaskRegistry Completion Hook to notify Telegram Chat ID
  TaskRegistry.getInstance().setCompletionCallback(
    async (taskId, chatId, description, success, resultOrError) => {
      try {
        let text = "";
        if (success) {
          text = `✅ **Task Completed!**\nTask ID: \`${taskId}\`\nDescription: ${description}\n\n*Output:*\n${resultOrError}`;
        } else {
          text = `❌ **Task Failed!**\nTask ID: \`${taskId}\`\nDescription: ${description}\n\n*Error:*\n${resultOrError}`;
        }
        await bot.api.sendMessage(chatId, text, { parse_mode: "Markdown" });
      } catch (err: any) {
        console.error(`[Telegram Task Callback] Failed to alert ${chatId}:`, err.message);
      }
    }
  );

  // 4. Handle incoming text messages
  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const text = ctx.message.text;

    // Send typing action to Telegram
    await ctx.replyWithChatAction("typing");

    try {
      const response = await orchestrator.processMessage(chatId, text);
      await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (err: any) {
      console.error(`[Telegram Message Error] Chat: ${chatId}`, err);
      await ctx.reply(`❌ An execution error occurred: ${err.message}`);
    }
  });

  // 5. Global error handler
  bot.catch((err) => {
    console.error("[Telegram Global Bot Error]", err.error);
  });

  console.log("[Telegram] Bot starting...");
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal startup error in Telegram service:", err);
  process.exit(1);
});
