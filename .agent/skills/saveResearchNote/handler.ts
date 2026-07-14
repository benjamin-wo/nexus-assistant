import { StorageService } from "../../../src/database/Storage";

export async function execute(args: { title: string; content: string }, context?: any) {
  const chatId = context?.chatId || "cli_chat_session";
  const storage = new StorageService();
  await storage.initialize();
  const id = await storage.createResearchNote({
    chatId,
    title: args.title,
    content: args.content,
  });
  await storage.close();
  return { success: true, id, message: `Successfully saved research note: '${args.title}'` };
}
