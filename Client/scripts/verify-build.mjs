import fs from "fs";
import path from "path";

const distIndex = path.resolve(process.cwd(), "dist", "index.html");

if (!fs.existsSync(distIndex)) {
  console.error("Build failed - dist/index.html not found");
  process.exit(1);
}

console.log("Build successful - dist/index.html generated");
