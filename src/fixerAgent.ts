import { StorageService } from "./database/Storage";
import { execSync } from "child_process";
import fs from "fs";

// The maximum number of self-correction attempts (persistent flag)
const MAX_RETRIES = process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES, 10) : 3;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function askDeepSeek(messages: any[]): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) {
    console.error("[FixerAgent] Error: DEEPSEEK_API_KEY is missing. Cannot proceed with auto-fix.");
    return null;
  }

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat", // Note: use appropriate model string for deepseek-v4-pro
      messages: messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    console.error("[FixerAgent] API call failed:", await response.text());
    return null;
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function main() {
  console.log("[FixerAgent] Starting end-of-day error check...");
  const storage = new StorageService();
  await storage.initialize();

  // 1. Fetch recent errors
  const recentLogs = await storage.getRecentLogs(100);
  const errors = recentLogs.filter(log => log.isError);

  if (errors.length === 0) {
    console.log("[FixerAgent] No errors found. Exiting.");
    await storage.close();
    return;
  }

  console.log(`[FixerAgent] Found ${errors.length} errors. Analyzing...`);

  const errorSummary = errors.map(e => `[${e.createdAt}] ${e.category}: ${e.message}\nDetails:\n${e.details}`).join("\n\n");

  const telegramTs = fs.readFileSync("./src/telegram.ts", "utf-8");

  const systemPrompt = `
You are an autonomous debugging agent. 
If you provide a fix, format your response EXACTLY as a JSON object:
{
  "file": "src/telegram.ts",
  "newContent": "..."
}
If no fix is possible, return { "error": "Cannot fix" }.
`;

  const initialUserPrompt = `
The following unhandled errors occurred in production today:

${errorSummary}

Here is the main application code (src/telegram.ts):
\`\`\`typescript
${telegramTs}
\`\`\`

Please analyze the errors and provide a unified git diff or file replacement to fix them.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: initialUserPrompt }
  ];

  let success = false;

  // Retry loop for self-correction based on test results
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[FixerAgent] Attempt ${attempt} of ${MAX_RETRIES} to generate a fix...`);
    
    const content = await askDeepSeek(messages);
    if (!content) {
      console.error("[FixerAgent] LLM failed to respond.");
      break;
    }

    // Append assistant's response to history
    messages.push({ role: "assistant", content });

    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*?}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const fix = JSON.parse(jsonStr);

      if (fix.error) {
        console.log("[FixerAgent] LLM could not determine a fix:", fix.error);
        break;
      } else if (fix.file && fix.newContent) {
        console.log(`[FixerAgent] Applying fix to ${fix.file}...`);
        fs.writeFileSync(fix.file, fix.newContent, "utf-8");
        
        // Run tests to verify the fix
        console.log("[FixerAgent] Running tests with 'bun test'...");
        try {
          const testOutput = execSync("bun test", { encoding: "utf-8", stdio: "pipe" });
          console.log("[FixerAgent] Tests passed successfully!\n" + testOutput);
          success = true;
          break; // Exit the retry loop on success
        } catch (testErr: any) {
          console.warn("[FixerAgent] Tests failed after applying fix.");
          const stdout = testErr.stdout ? testErr.stdout.toString() : "";
          const stderr = testErr.stderr ? testErr.stderr.toString() : testErr.message;
          const fullError = stdout + "\n" + stderr;

          console.log("[FixerAgent] Test output:\n", fullError);

          if (attempt < MAX_RETRIES) {
            console.log("[FixerAgent] Requesting LLM to self-correct based on test failure...");
            messages.push({
              role: "user",
              content: `The tests failed after applying your fix. Here is the output of 'bun test':\n\n${fullError}\n\nPlease correct the code and provide the JSON payload again.`
            });
          } else {
            console.error("[FixerAgent] Max retries reached. Discarding fix and aborting.");
            // Revert changes
            execSync("git checkout -- " + fix.file);
          }
        }
      }
    } catch (err) {
      console.error("[FixerAgent] Failed to parse LLM response.", err);
      if (attempt < MAX_RETRIES) {
        messages.push({
          role: "user",
          content: "Your response was not valid JSON. Please provide EXACTLY the JSON object requested."
        });
      }
    }
  }

  // 3. GitOps - Commit and Push if successful
  if (success) {
    console.log("[FixerAgent] Fix verified by tests. Committing and pushing to trigger Railway deploy...");
    try {
      execSync('git config user.name "FixerAgent"');
      execSync('git config user.email "agent@example.com"');
      execSync('git add .');
      execSync('git commit -m "Auto-fix: Resolving end-of-day errors"');
      // execSync(`git push https://\${process.env.GITHUB_TOKEN}@github.com/your-username/your-repo.git main`);
      console.log("[FixerAgent] Successfully committed. Push command is commented out for safety until GITHUB_TOKEN is configured.");
    } catch (gitErr) {
      console.error("[FixerAgent] Git operation failed:", gitErr);
    }
  }

  await storage.close();
  console.log("[FixerAgent] Done.");
}

main().catch(console.error);
