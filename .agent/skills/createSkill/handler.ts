import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { SkillRegistry } from "../../../src/core/SkillRegistry";
import YAML from "yaml";

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

  const skillDir = join(process.cwd(), ".agent", "skills", name);
  await mkdir(skillDir, { recursive: true });

  // Generate SKILL.md content
  const frontmatter = {
    name,
    description,
    parameters,
  };
  const skillMdContent = `---
${YAML.stringify(frontmatter)}---
${instructions}
`;

  const mdPath = join(skillDir, "SKILL.md");
  const tsPath = join(skillDir, "handler.ts");

  // Write temporary files to verify compilation
  await writeFile(mdPath, skillMdContent, "utf-8");
  await writeFile(tsPath, codeContent, "utf-8");

  try {
    // Compile-check using Bun.build
    const buildResult = await Bun.build({
      entrypoints: [tsPath],
      minify: false,
    });

    if (!buildResult.success) {
      const logMsg = buildResult.logs.map((log) => `${log.level}: ${log.message}`).join("\n");
      throw new Error(`TypeScript compilation failed:\n${logMsg}`);
    }

    // Trigger dynamic reload of capabilities
    await SkillRegistry.getInstance().reload();

    return {
      success: true,
      message: `Skill '${name}' has been successfully created, verified, and loaded at runtime!`,
      path: skillDir,
    };
  } catch (error: any) {
    // If compilation fails, do not leave broken files on disk or at least report it
    throw new Error(`Failed to create skill '${name}': ${error.message}`);
  }
}
