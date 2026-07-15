import { StorageService } from "../database/Storage";

async function main() {
  console.log("Initializing database connection...");
  const storage = new StorageService();
  await storage.initialize();

  console.log("Simulating an error insertion...");
  await storage.logEvent({
    category: "TEST_ERROR",
    message: "This is a simulated test error from test-error.ts",
    details: new Error("Test stack trace").stack || "No stack",
    isError: true
  });

  console.log("Error successfully logged. Run the fixer agent to see if it picks it up.");
  
  // Optional: Print it to confirm
  const logs = await storage.getRecentLogs(5);
  console.log("Recent logs in DB:", logs.filter(l => l.isError));
  
  await storage.close();
}

main().catch(console.error);
