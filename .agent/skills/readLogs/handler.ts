import { StorageService } from "../../../src/database/Storage";

export async function execute(args: { limit?: number }) {
  const limit = args.limit || 20;
  const storage = new StorageService();
  await storage.initialize();

  try {
    const logs = await storage.getRecentLogs(limit);
    return {
      success: true,
      limit,
      logs: logs.map((l) => ({
        time: l.createdAt,
        category: l.category,
        message: l.message,
        isError: l.isError,
        details: l.details || "",
        durationMs: l.durationMs || 0,
      })),
    };
  } finally {
    await storage.close();
  }
}
