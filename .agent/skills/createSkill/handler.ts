import { SkillRegistry } from "../../../src/core/SkillRegistry";
import { StorageService } from "../../../src/database/Storage";

export async function execute(args: {
  name: string;
  description: string;
  parameters: any;
  instructions: string;
  codeContent: string;
}) {
  const { name, description, parameters, instructions, codeContent } = args;

  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("Skill name must be alphanumeric (letters, numbers, underscores only).");
  }

  try {
    // 1. Verify compilation using Transpiler
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    transpiler.transformSync(codeContent); // Throws if syntax is invalid
  } catch (error: any) {
    throw new Error(`TypeScript compilation failed: ${error.message}`);
  }

  try {
    // 2. Insert directly into Database
    const storage = new StorageService();
    await storage.initialize(); // Ensure db is ready
    
    // Convert parameters to JSON string or leave as object based on how StorageService handles it
    // Actually insertSkill accepts object/string for parameters.
    await storage.insertSkill(name, description, JSON.stringify(parameters), codeContent);

    // 3. Trigger dynamic reload of capabilities
    await SkillRegistry.getInstance().reload();

    return {
      success: true,
      message: `Skill '${name}' has been successfully verified and loaded directly into the database runtime!`,
    };
  } catch (error: any) {
    throw new Error(`Failed to create skill '${name}': ${error.message}`);
  }
}
