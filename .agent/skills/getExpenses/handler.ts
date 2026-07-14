import { StorageService } from "../../../src/database/Storage";

export async function execute(args: {}, context?: any) {
  const chatId = context?.chatId || "cli_chat_session";
  const storage = new StorageService();
  await storage.initialize();
  const expenses = await storage.getExpenses(chatId);
  await storage.close();
  return { success: true, expenses };
}
