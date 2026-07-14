import { join } from "path";
import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import YAML from "yaml";

export interface Skill {
  name: string;
  description: string;
  parameters: any;
  instructions: string;
  handlerPath: string;
  execute: (args: any, context?: any) => Promise<any>;
}

export class SkillRegistry {
  private static instance: SkillRegistry | null = null;
  private skills = new Map<string, Skill>();
  private skillsDir: string;

  private constructor() {
    this.skillsDir = join(process.cwd(), ".agent", "skills");
  }

  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  async initialize(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.skills.clear();
    if (!existsSync(this.skillsDir)) {
      return;
    }

    const entries = await readdir(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillName = entry.name;
      const skillFolder = join(this.skillsDir, skillName);
      const mdPath = join(skillFolder, "SKILL.md");
      const tsPath = join(skillFolder, "handler.ts");

      if (!existsSync(mdPath) || !existsSync(tsPath)) {
        console.warn(`[SkillRegistry] Skipping incomplete skill folder: ${skillName}`);
        continue;
      }

      try {
        // 1. Read and parse SKILL.md frontmatter
        const mdText = await readFile(mdPath, "utf-8");
        const match = mdText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

        if (!match) {
          console.warn(`[SkillRegistry] Invalid SKILL.md format in: ${skillName}`);
          continue;
        }

        const frontmatterStr = match[1];
        const instructions = match[2].trim();
        const frontmatter = YAML.parse(frontmatterStr);

        const name = frontmatter.name || skillName;
        const description = frontmatter.description || "";
        const parameters = frontmatter.parameters || { type: "object", properties: {} };

        // 2. Dynamic import handler with cache-busting query parameter
        const importPath = `${tsPath}?t=${Date.now()}`;
        const handlerModule = await import(importPath);

        if (typeof handlerModule.execute !== "function") {
          console.warn(`[SkillRegistry] handler.ts in '${skillName}' must export a function named 'execute'.`);
          continue;
        }

        this.skills.set(name, {
          name,
          description,
          parameters,
          instructions,
          handlerPath: tsPath,
          execute: handlerModule.execute,
        });
      } catch (error: any) {
        console.error(`[SkillRegistry] Failed to load skill '${skillName}':`, error.message);
      }
    }
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  async executeSkill(name: string, args: any, context?: any): Promise<any> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill '${name}' not found in registry.`);
    }
    return skill.execute(args, context);
  }
}
