import { Bot } from "grammy";
import { Orchestrator } from "./core/Orchestrator";
import { SkillRegistry } from "./core/SkillRegistry";
import { Scheduler } from "./services/Scheduler";
import { TaskRegistry } from "./core/TaskRegistry";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(markdown: string): string {
  // 1. Escape HTML entities
  let html = escapeHtml(markdown);

  // 2. Code blocks: ```code``` -> <pre><code>code</code></pre>
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const lines = code.split("\n");
    if (lines.length > 0 && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
      lines.shift();
    }
    return `<pre><code>${lines.join("\n").trim()}</code></pre>`;
  });

  // 3. Inline code: `code` -> <code>code</code>
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Bold: **bold** -> <b>bold</b>
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, "<b>$1</b>");

  // 5. Italic: *italic* -> <i>italic</i>
  html = html.replace(/\*([\s\S]*?)\*/g, "<i>$1</i>");

  // 6. Italic: _italic_ (only if it has a boundary)
  html = html.replace(/(?<=^|\s|[.,!?;:])_([^_]+)_(?=$|\s|[.,!?;:])/g, "<i>$1</i>");

  return html;
}

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
      await bot.api.sendMessage(chatId, markdownToHtml(message), { parse_mode: "HTML" });
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
        await bot.api.sendMessage(chatId, markdownToHtml(text), { parse_mode: "HTML" });
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
      await ctx.reply(markdownToHtml(response), { parse_mode: "HTML" });
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
