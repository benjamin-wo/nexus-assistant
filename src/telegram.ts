import { Bot } from "grammy";
import { Orchestrator } from "./core/Orchestrator";
import { SkillRegistry } from "./core/SkillRegistry";
import { Scheduler } from "./services/Scheduler";
import { TaskRegistry } from "./core/TaskRegistry";
import { StorageService } from "./database/Storage";
import { join } from "path";

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

  function getWebAppUrl(chatId: string): string {
    const domain = process.env.RAILWAY_STATIC_URL;
    if (domain) {
      return `https://${domain}?chatId=${chatId}`;
    }
    return `http://localhost:3000?chatId=${chatId}`;
  }

  // 4. Handle incoming text messages
  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const text = ctx.message.text.trim();

    // Check if the user is asking to open the dashboard/expenses/notes
    const isExpenses = text.startsWith("/expenses") || text.toLowerCase().includes("show expense") || text.toLowerCase().includes("expense dashboard");
    const isNotes = text.startsWith("/notes") || text.toLowerCase().includes("show note") || text.toLowerCase().includes("notes library");

    if (isExpenses) {
      const url = getWebAppUrl(chatId);
      await ctx.reply("Here is your <b>Personal Expense Tracker</b> dashboard:", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "📊 Open Expense Dashboard", web_app: { url } }
          ]]
        }
      });
      return;
    }

    if (isNotes) {
      const url = `${getWebAppUrl(chatId)}&tab=notes`;
      await ctx.reply("Here is your <b>Research Notes</b> library:", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "📝 Open Research Notes", web_app: { url } }
          ]]
        }
      });
      return;
    }

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

  // 6. Start Web Server using Bun.serve
  const port = process.env.PORT || 3000;
  Bun.serve({
    port: Number(port),
    async fetch(req) {
      const url = new URL(req.url);
      const storage = new StorageService();

      try {
        await storage.initialize();

        // 1. GET /api/expenses?chatId=...
        if (url.pathname === "/api/expenses" && req.method === "GET") {
          const chatId = url.searchParams.get("chatId");
          if (!chatId) return new Response("Missing chatId", { status: 400 });
          const expenses = await storage.getExpenses(chatId);
          return Response.json(expenses);
        }

        // 2. POST /api/expenses
        if (url.pathname === "/api/expenses" && req.method === "POST") {
          const body = await req.json() as any;
          if (!body.chatId || !body.amount || !body.category || !body.description) {
            return new Response("Missing fields", { status: 400 });
          }
          const id = await storage.createExpense({
            chatId: body.chatId,
            amount: Number(body.amount),
            category: body.category,
            description: body.description,
          });
          return Response.json({ success: true, id });
        }

        // 3. POST /api/expenses/delete
        if (url.pathname === "/api/expenses/delete" && req.method === "POST") {
          const body = await req.json() as any;
          if (!body.id || !body.chatId) {
            return new Response("Missing fields", { status: 400 });
          }
          await storage.deleteExpense(Number(body.id), body.chatId);
          return Response.json({ success: true });
        }

        // 4. GET /api/notes?chatId=...
        if (url.pathname === "/api/notes" && req.method === "GET") {
          const chatId = url.searchParams.get("chatId");
          if (!chatId) return new Response("Missing chatId", { status: 400 });
          const notes = await storage.getResearchNotes(chatId);
          return Response.json(notes);
        }

        // 5. POST /api/notes
        if (url.pathname === "/api/notes" && req.method === "POST") {
          const body = await req.json() as any;
          if (!body.chatId || !body.title || !body.content) {
            return new Response("Missing fields", { status: 400 });
          }
          const id = await storage.createResearchNote({
            chatId: body.chatId,
            title: body.title,
            content: body.content,
          });
          return Response.json({ success: true, id });
        }

        // 6. POST /api/notes/delete
        if (url.pathname === "/api/notes/delete" && req.method === "POST") {
          const body = await req.json() as any;
          if (!body.id || !body.chatId) {
            return new Response("Missing fields", { status: 400 });
          }
          await storage.deleteResearchNote(Number(body.id), body.chatId);
          return Response.json({ success: true });
        }

        // 7. Serve Static Files
        let filePath = url.pathname;
        if (filePath === "/") filePath = "/index.html";
        const publicPath = join(process.cwd(), "src", "public", filePath);
        const file = Bun.file(publicPath);
        if (await file.exists()) {
          return new Response(file);
        }

        return new Response("Not Found", { status: 404 });
      } catch (err: any) {
        console.error("[Web Server Error]", err);
        return new Response(`Server Error: ${err.message}`, { status: 500 });
      } finally {
        await storage.close();
      }
    }
  });

  console.log(`[Telegram] Web Server started on port ${port}`);
  console.log("[Telegram] Bot starting...");
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal startup error in Telegram service:", err);
  process.exit(1);
});
