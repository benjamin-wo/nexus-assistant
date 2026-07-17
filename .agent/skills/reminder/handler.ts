import { StorageService } from "../../../src/database/Storage";

export async function execute(
  args: { duration: string; message: string },
  context?: { chatId: string }
) {
  const { duration, message } = args;
  const chatId = context?.chatId || "default_cli_chat";

  // Parse duration
  let dueAt: Date;
  
  const match = duration.match(/^(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day)s?$/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let offsetMs = 0;
    if (unit.startsWith("s")) {
      offsetMs = value * 1000;
    } else if (unit.startsWith("m")) {
      offsetMs = value * 60 * 1000;
    } else if (unit.startsWith("h")) {
      offsetMs = value * 60 * 60 * 1000;
    } else if (unit.startsWith("d")) {
      offsetMs = value * 24 * 60 * 60 * 1000;
    }
    dueAt = new Date(Date.now() + offsetMs);
  } else {
    // Try parsing as absolute date
    dueAt = new Date(duration);
    if (isNaN(dueAt.getTime())) {
      throw new Error("Invalid duration/time format. Use e.g. '5 minutes' or an ISO date string like '2026-10-28T09:00:00Z'.");
    }
  }

  const storage = new StorageService();
  await storage.initialize();
  
  try {
    const id = await storage.createReminder({
      chatId,
      message,
      dueAt,
      sent: false,
    });

    return {
      success: true,
      reminderId: id,
      message,
      dueAt: dueAt.toISOString(),
      chatId,
    };
  } finally {
    await storage.close();
  }
}
