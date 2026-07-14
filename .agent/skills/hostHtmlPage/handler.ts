import { join, resolve } from "path";
import { writeFile, mkdir } from "fs/promises";

export async function execute(args: { fileName: string; htmlContent: string }) {
  const { fileName, htmlContent } = args;

  if (!fileName || !fileName.endsWith(".html")) {
    throw new Error("File name must end with '.html'.");
  }

  // Validate filename to prevent directory traversal
  const nameWithoutExtension = fileName.slice(0, -5);
  if (!/^[a-zA-Z0-9_-]+$/.test(nameWithoutExtension)) {
    throw new Error("File name must be alphanumeric (letters, numbers, hyphens, and underscores only).");
  }

  const publicDir = join(process.cwd(), "src", "public");
  const targetPath = resolve(join(publicDir, fileName));

  // Security check: ensure targetPath is inside the public folder
  if (!targetPath.startsWith(publicDir)) {
    throw new Error("Security check failed: Path traversal outside the public directory is blocked.");
  }

  // Ensure public directory exists
  await mkdir(publicDir, { recursive: true });

  // Write file
  await writeFile(targetPath, htmlContent, "utf-8");

  // Determine hosted URL
  let hostedUrl = "";
  if (process.env.WEBAPP_URL) {
    const base = process.env.WEBAPP_URL.endsWith("/") 
      ? process.env.WEBAPP_URL.slice(0, -1) 
      : process.env.WEBAPP_URL;
    hostedUrl = `${base}/${fileName}`;
  } else if (process.env.RAILWAY_STATIC_URL) {
    hostedUrl = `https://${process.env.RAILWAY_STATIC_URL}/${fileName}`;
  } else {
    // Local fallback
    const port = process.env.PORT || 3000;
    hostedUrl = `http://localhost:${port}/${fileName}`;
  }

  return {
    success: true,
    message: `HTML page has been successfully hosted!`,
    fileName,
    url: hostedUrl
  };
}
