import { join, resolve } from "path";
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { existsSync } from "fs";

export async function execute(args: {
  operation: "read" | "write" | "list";
  path: string;
  content?: string;
}) {
  const { operation, path, content } = args;

  if (!operation) throw new Error("Parameter 'operation' is required (read | write | list).");
  if (!path || typeof path !== "string") throw new Error("Parameter 'path' is required and must be a string.");

  const workspaceRoot = process.cwd();
  // Safe resolution: resolve absolute path, and prevent escaping directory using path traversal
  const targetPath = resolve(join(workspaceRoot, path));

  if (!targetPath.startsWith(workspaceRoot)) {
    throw new Error("Security check failed: Directory traversal outside workspace is blocked.");
  }

  switch (operation) {
    case "read": {
      if (!existsSync(targetPath)) {
        throw new Error(`File does not exist: ${path}`);
      }
      const text = await readFile(targetPath, "utf-8");
      return {
        path,
        content: text,
      };
    }
    case "write": {
      if (content === undefined) {
        throw new Error("Parameter 'content' is required for the 'write' operation.");
      }
      // Ensure target directory exists before writing
      const dirPath = resolve(join(targetPath, ".."));
      await mkdir(dirPath, { recursive: true });

      await writeFile(targetPath, content, "utf-8");
      return {
        path,
        success: true,
        bytesWritten: content.length,
      };
    }
    case "list": {
      if (!existsSync(targetPath)) {
        throw new Error(`Directory does not exist: ${path}`);
      }
      const files = await readdir(targetPath, { withFileTypes: true });
      const list = files.map((f) => ({
        name: f.name,
        isDirectory: f.isDirectory(),
      }));
      return {
        path,
        files: list,
      };
    }
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}
