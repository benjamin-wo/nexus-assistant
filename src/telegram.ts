import { Bot } from "grammy";
import { Orchestrator } from "./core/Orchestrator";
import { SkillRegistry } from "./core/SkillRegistry";
import { Scheduler } from "./services/Scheduler";
import { TaskRegistry } from "./core/TaskRegistry";
import { StorageService } from "./database/Storage";
import { join } from "path";
import { startEmailPoller } from "./emailPoller";

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

  // 4. Bold: **bold** -> <b>bold</b> (enforce non-space inner boundaries, no nested asterisks)
  html = html.replace(/(?<!\*)\*\*(?!\*)(?=\S)([\s\S]*?)(?<=\S)\*\*(?!\*)/g, "<b>$1</b>");
 
  // 5. Italic: *italic* -> <i>italic</i> (enforce non-space boundaries to avoid matching bullet points)
  html = html.replace(/(?<!\*)\*(?!\*)(?=\S)([\s\S]*?)(?<=\S)\*(?!\*)/g, "<i>$1</i>");
 
  // 6. Italic: _italic_ -> <i>italic</i>
  html = html.replace(/(?<!_)_(?!_)(?=\S)([\s\S]*?)(?<=\S)_(?!_)/g, "<i>$1</i>");
 
  // 7. Links: [text](url) -> <a href="$2">$1</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
 
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
  const storage = new StorageService();
  await storage.initialize();

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

  // Register mid-task update callback (used by polling tasks like trackBus to push live messages)
  TaskRegistry.getInstance().setUpdateCallback(async (chatId, message) => {
    try {
      await bot.api.sendMessage(chatId, markdownToHtml(message), { parse_mode: "HTML" });
    } catch (err: any) {
      console.error(`[Telegram Task Update] Failed to send live update to ${chatId}:`, err.message);
    }
  });

  function getWebAppUrl(chatId: string): string {
    if (process.env.WEBAPP_URL) {
      const base = process.env.WEBAPP_URL.endsWith("/") 
        ? process.env.WEBAPP_URL.slice(0, -1) 
        : process.env.WEBAPP_URL;
      return `${base}?chatId=${chatId}`;
    }
    const domain = process.env.RAILWAY_STATIC_URL;
    if (domain) {
      return `https://${domain}?chatId=${chatId}`;
    }
    return `http://localhost:3000?chatId=${chatId}`;
  }

  // 4a. Handle /cancel <taskId> to stop a running tracking session
  bot.on("message", async (ctx, next) => {
    const text = (ctx.message.text || "").trim();
    if (text.startsWith("/cancel ")) {
      const taskId = text.split(" ")[1]?.trim();
      if (taskId) {
        const cancelled = await TaskRegistry.getInstance().cancelTask(taskId);
        if (cancelled) {
          await ctx.reply(`✅ Tracking session <code>${taskId}</code> has been stopped.`, { parse_mode: "HTML" });
        } else {
          await ctx.reply(`⚠️ No active task found with ID <code>${taskId}</code>.`, { parse_mode: "HTML" });
        }
        return; // Don't forward to main handler
      }
    }
    return next();
  });

  // 4. Handle incoming messages (text, photos, voice notes)
  bot.on("message", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const text = (ctx.message.text || ctx.message.caption || "").trim();

    // Check for /fixingtime
    if (text === "/fixingtime") {
      await ctx.replyWithChatAction("typing");
      try {
        const logs = await storage.getLogsPastHours(24);
        if (logs.length === 0) {
          await ctx.reply("No errors or improvements logged in the last 24 hours. Great job!");
          return;
        }

        const logContext = logs.map(l => `[${l.category}] ${l.message}\nDetails: ${l.details || "None"}`).join("\n---\n");
        const promptText = `
You are a Staff Software Engineer handing off work. The user uses an advanced AI coding assistant (Antigravity) locally.
Your job is to generate a comprehensive summary of the errors and improvements logged today, followed by a "Solid Prompt" that the user can copy and paste directly into their local Antigravity IDE.
The solid prompt should instruct the local AI to fix the specific errors and implement the requested improvements in their codebase. Keep the prompt extremely detailed so the AI knows exactly what to do.

Here are the raw logs from the past 24 hours:
${logContext}

Output format MUST be EXACTLY:
1. **Summary of Issues** (bullet points)
2. **Requested Features** (bullet points)
3. **The Magic Prompt** (Put the actual prompt text inside a standard markdown code block so the user can click to copy it)
`;

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: promptText }],
            temperature: 0.3
          })
        });

        if (!response.ok) throw new Error("DeepSeek API failed");
        const data = await response.json();
        const llmReply = data.choices[0].message.content;

        await ctx.reply(markdownToHtml(llmReply), { parse_mode: "HTML" });
      } catch (err: any) {
        await ctx.reply(`❌ Failed to generate fixing time summary: ${err.message}`);
      }
      return;
    }

    // Check if the user is asking to open the dashboard/expenses/notes
    const isExpenses = text.startsWith("/expenses") || text.toLowerCase().includes("show expense") || text.toLowerCase().includes("expense dashboard");
    const isNotes = text.startsWith("/notes") || text.toLowerCase().includes("show note") || text.toLowerCase().includes("notes library");

    if (isExpenses) {
      const url = getWebAppUrl(chatId);
      const isHttps = url.startsWith("https://");
      
      if (isHttps) {
        await ctx.reply("Here is your <b>Personal Expense Tracker</b> dashboard:", {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "📊 Open Expense Dashboard", web_app: { url } }
            ]]
          }
        });
      } else {
        await ctx.reply(`Here is your <b>Personal Expense Tracker</b> dashboard link:\n\n<a href="${url}">📊 Open Expense Dashboard</a>\n\n(Local testing link: <code>${url}</code>)`, {
          parse_mode: "HTML"
        });
      }
      return;
    }

    if (isNotes) {
      const url = `${getWebAppUrl(chatId)}&tab=notes`;
      const isHttps = url.startsWith("https://");
      
      if (isHttps) {
        await ctx.reply("Here is your <b>Research Notes</b> library:", {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "📝 Open Research Notes", web_app: { url } }
            ]]
          }
        });
      } else {
        await ctx.reply(`Here is your <b>Research Notes</b> library link:\n\n<a href="${url}">📝 Open Research Notes</a>\n\n(Local testing link: <code>${url}</code>)`, {
          parse_mode: "HTML"
        });
      }
      return;
    }

    // Resolve voice, photo, or audio attachments
    let media: any[] | undefined = undefined;

    if (ctx.message.photo) {
      try {
        const photo = ctx.message.photo[ctx.message.photo.length - 1]; // largest resolution
        const file = await ctx.api.getFile(photo.file_id);
        if (file.file_path) {
          const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
          const res = await fetch(fileUrl);
          const buffer = await res.arrayBuffer();
          media = [{
            mimeType: "image/jpeg",
            data: Buffer.from(buffer).toString("base64")
          }];
        }
      } catch (err) {
        console.error("[Telegram Media Fetch Error] Photo:", err);
      }
    } else if (ctx.message.voice) {
      try {
        const voice = ctx.message.voice;
        const file = await ctx.api.getFile(voice.file_id);
        if (file.file_path) {
          const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
          const res = await fetch(fileUrl);
          const buffer = await res.arrayBuffer();
          media = [{
            mimeType: voice.mime_type || "audio/ogg",
            data: Buffer.from(buffer).toString("base64")
          }];
        }
      } catch (err) {
        console.error("[Telegram Media Fetch Error] Voice:", err);
      }
    } else if (ctx.message.audio) {
      try {
        const audio = ctx.message.audio;
        const file = await ctx.api.getFile(audio.file_id);
        if (file.file_path) {
          const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
          const res = await fetch(fileUrl);
          const buffer = await res.arrayBuffer();
          media = [{
            mimeType: audio.mime_type || "audio/mpeg",
            data: Buffer.from(buffer).toString("base64")
          }];
        }
      } catch (err) {
        console.error("[Telegram Media Fetch Error] Audio:", err);
      }
    }

    if (!text && !media) {
      return; // Ignore empty / unsupported types
    }

    // Send typing action to Telegram
    await ctx.replyWithChatAction("typing");

    try {
      const response = await orchestrator.processMessage(chatId, text, media);
      await ctx.reply(markdownToHtml(response), { parse_mode: "HTML" });
    } catch (err: any) {
      console.error(`[Telegram Message Error] Chat: ${chatId}`, err);
      try {
        await storage.logEvent({
          category: "TELEGRAM_MESSAGE_ERROR",
          message: err.message,
          details: err.stack || JSON.stringify(err),
          isError: true
        });
      } catch (dbErr) {
        console.error("Failed to log error to DB:", dbErr);
      }
      await ctx.reply(`❌ An execution error occurred: ${err.message}`);
    }
  });

  // 5. Global error handler
  bot.catch(async (err) => {
    console.error("[Telegram Global Bot Error]", err.error);
    try {
      const errorObj = err.error instanceof Error ? err.error : new Error(String(err.error));
      await storage.logEvent({
        category: "TELEGRAM_GLOBAL_ERROR",
        message: errorObj.message,
        details: errorObj.stack || JSON.stringify(err.error),
        isError: true
      });
    } catch (dbErr) {
      console.error("Failed to log global error to DB:", dbErr);
    }
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
            createdAt: body.date,
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

        // 7. GET /api/oauth/callback
        if (url.pathname === "/api/oauth/callback" && req.method === "GET") {
          const code = url.searchParams.get("code");
          const chatId = url.searchParams.get("state");
          if (!code || !chatId) {
            return new Response("Missing code or state", { status: 400 });
          }

          // Exchange code for tokens
          const webappUrl = process.env.WEBAPP_URL || `http://localhost:${port}`;
          const base = webappUrl.endsWith("/") ? webappUrl.slice(0, -1) : webappUrl;
          const redirectUri = `${base}/api/oauth/callback`;

          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: process.env.GOOGLE_CLIENT_ID || "",
              client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
              redirect_uri: redirectUri,
              grant_type: "authorization_code"
            })
          });

          if (!tokenRes.ok) {
            const err = await tokenRes.text();
            return new Response(`Failed to exchange Google OAuth token: ${err}`, { status: 500 });
          }

          const tokens = await tokenRes.json() as any;

          // Preserve existing refresh_token if Google does not return a new one on re-auth
          let refresh = tokens.refresh_token;
          if (!refresh) {
            const existing = await storage.getGoogleCredentials(chatId);
            if (existing) refresh = existing.refresh_token;
          }

          await storage.saveGoogleCredentials(chatId, {
            access_token: tokens.access_token,
            refresh_token: refresh || "",
            expiry_date: Date.now() + (tokens.expires_in * 1000)
          });

          return new Response(`
            <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body {
                    background-color: #121214;
                    color: #ffffff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                  }
                  .card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 40px;
                    border-radius: 16px;
                    text-align: center;
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                    max-width: 400px;
                  }
                  h1 { color: #4caf50; margin-bottom: 10px; font-size: 24px; }
                  p { color: #b3b3b3; font-size: 16px; line-height: 1.5; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>✓ Authenticated successfully!</h1>
                  <p>Nexus has been granted Google access. You can now safely close this window and return to your Telegram chat.</p>
                </div>
              </body>
            </html>
          `, { headers: { "Content-Type": "text/html" } });
        }

        // 8. Serve Static Files
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
  
  // 7. Start the Email Poller background loop (every 15 minutes)
  startEmailPoller(15 * 60 * 1000);

  console.log("[Telegram] Bot starting...");
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal startup error in Telegram service:", err);
  process.exit(1);
});
