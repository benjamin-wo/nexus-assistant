import { StorageService } from "../../../src/database/Storage";

export async function execute(args: { amount: number; category: string; description: string; date?: string }, context?: any) {
  const chatId = context?.chatId || "cli_chat_session";
  const storage = new StorageService();
  await storage.initialize();
  const id = await storage.createExpense({
    chatId,
    amount: args.amount,
    category: args.category,
    description: args.description,
    createdAt: args.date,
  });
  await storage.close();
  const dateMsg = args.date ? ` on ${args.date}` : "";
  return { success: true, id, message: `Successfully logged expense of $${args.amount} under '${args.category}'${dateMsg}` };
}
