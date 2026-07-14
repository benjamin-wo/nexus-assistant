import { StorageService, LogEntry } from "../database/Storage";
import { Orchestrator } from "../core/Orchestrator";

export class Scheduler {
  private intervalId: Timer | null = null;
  private devopsIntervalId: Timer | null = null;
  private onReminderTrigger: ((chatId: string, message: string) => Promise<void>) | null = null;

  constructor() {}

  start(onReminderTrigger: (chatId: string, message: string) => Promise<void>): void {
    this.onReminderTrigger = onReminderTrigger;
    
    // Check reminders every 10 seconds for responsive testing
    this.intervalId = setInterval(() => this.checkReminders(), 10000);

    // Schedule DevOps maintenance checks every 12 hours
    this.devopsIntervalId = setInterval(() => this.runDevOpsMaintenance(), 12 * 60 * 60 * 1000);
    
    console.log("[Scheduler] Background scheduler loop started.");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.devopsIntervalId) {
      clearInterval(this.devopsIntervalId);
      this.devopsIntervalId = null;
    }
    console.log("[Scheduler] Background scheduler loop stopped.");
  }

  async checkReminders(): Promise<void> {
    const storage = new StorageService();
    await storage.initialize();

    try {
      const pending = await storage.getPendingReminders();
      if (pending.length === 0) return;

      console.log(`[Scheduler] Found ${pending.length} pending reminders due.`);

      for (const item of pending) {
        if (this.onReminderTrigger) {
          try {
            await this.onReminderTrigger(item.chatId, `🔔 **Reminder:** ${item.message}`);
            await storage.markReminderSent(item.id!);
          } catch (err: any) {
            console.error(`[Scheduler] Failed to trigger reminder ${item.id}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error("[Scheduler] Error checking reminders:", err.message);
    } finally {
      await storage.close();
    }
  }

  async runDevOpsMaintenance(manualChatId?: string): Promise<string> {
    console.log("[Scheduler] Running DevOps maintenance trace audits...");
    const storage = new StorageService();
    await storage.initialize();

    try {
      // Query recent logs (last 50 logs)
      // SQLite/PG
      const dbUrl = process.env.DATABASE_URL;
      let logs: any[] = [];
      
      if (dbUrl && dbUrl.trim() !== "") {
        const pgPool = new pg.Pool({ connectionString: dbUrl });
        const res = await pgPool.query("SELECT * FROM logs ORDER BY id DESC LIMIT 50");
        logs = res.rows;
        await pgPool.end();
      } else {
        const sqliteDb = new Database("assistant.db");
        logs = sqliteDb.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 50").all() as any[];
        sqliteDb.close();
      }

      const errors = logs.filter((l) => l.is_error || l.is_error === 1);
      const totalRequests = logs.filter((l) => l.category === "orchestrator").length;
      
      let maintenanceReport = `## System Health Audit Report (${new Date().toLocaleString()})\n\n`;
      maintenanceReport += `- **Total Requests Handled**: ${totalRequests}\n`;
      maintenanceReport += `- **Logged Errors**: ${errors.length} / ${logs.length} entries\n\n`;

      if (errors.length > 0) {
        maintenanceReport += "### Logged Failures:\n";
        errors.forEach((err) => {
          maintenanceReport += `- [${err.category}] ${err.message} (${err.created_at})\n`;
        });
      } else {
        maintenanceReport += "✅ No system or execution anomalies detected in the logs directory.\n";
      }

      // If user triggered this manually or we have a active chat channel, write the report
      const reportPath = join(process.cwd(), ".agent", "devops_report.md");
      const Bun = (globalThis as any).Bun;
      await Bun.write(reportPath, maintenanceReport);

      if (manualChatId && this.onReminderTrigger) {
        await this.onReminderTrigger(
          manualChatId,
          `🛠️ **DevOps Audit Completed**\nReport saved to \`.agent/devops_report.md\`\n\n${maintenanceReport}`
        );
      }

      return maintenanceReport;
    } catch (err: any) {
      console.error("[Scheduler] DevOps maintenance check failed:", err.message);
      return `Error performing audit: ${err.message}`;
    } finally {
      await storage.close();
    }
  }
}

// Quick helper to resolve PG/Database loading in scheduler context
import pg from "pg";
import { Database } from "bun:sqlite";
import { join } from "path";
