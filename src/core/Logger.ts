import { appendFile } from "node:fs/promises";
import { join } from "node:path";

export class Logger {
  private static logFile = join(process.cwd(), "orchestrator.log");

  private static async writeToFile(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : "";
    const logLine = `[${timestamp}] [${level}] ${message}${metaStr}\n`;
    try {
      await appendFile(this.logFile, logLine);
    } catch (err) {
      console.error("Failed to write to orchestrator.log", err);
    }
  }

  static info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta || "");
    this.writeToFile("INFO", message, meta);
  }

  static warn(message: string, meta?: any) {
    console.warn(`[WARN] ${message}`, meta || "");
    this.writeToFile("WARN", message, meta);
  }

  static error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error || "");
    this.writeToFile("ERROR", message, error instanceof Error ? error.stack : error);
  }
}
