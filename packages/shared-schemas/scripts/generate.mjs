#!/usr/bin/env node
import { compileFromFile } from "json-schema-to-typescript";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = path.join(root, "schemas");
const srcDir = path.join(root, "src", "generated");
const pythonDir = path.join(root, "python", "screen_time_schemas");
const kotlinDir = path.join(root, "kotlin", "screen_time_schemas");

fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(pythonDir, { recursive: true });
fs.mkdirSync(kotlinDir, { recursive: true });

const schemaFiles = fs
  .readdirSync(schemasDir)
  .filter((f) => f.endsWith(".json") && f !== "common.json")
  .sort();

const exports = [];
for (const file of schemaFiles) {
  const base = file.replace(".json", "");
  const pascal = base
    .split("-")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
  const ts = await compileFromFile(path.join(schemasDir, file), {
    cwd: schemasDir,
    bannerComment: "/* Auto-generated from JSON Schema — do not edit. */",
  });
  const outName = `${base}.ts`;
  fs.writeFileSync(path.join(srcDir, outName), ts);
  exports.push(`export type { ${pascal} } from "./generated/${base}.js";`);
}

fs.writeFileSync(
  path.join(root, "src", "index.ts"),
  `/* Auto-generated index — run pnpm gen */\n${exports.join("\n")}\nexport * from "@screen-time-control/shared-rules-engine";\n`,
);

// Python via datamodel-codegen (optional if installed)
try {
  execSync(
    `python3 -m datamodel_code_generator --input ${schemasDir} --input-file-type jsonschema --output ${pythonDir} --output-model-type pydantic_v2.BaseModel`,
    { stdio: "inherit" },
  );
} catch {
  fs.writeFileSync(
    path.join(pythonDir, "__init__.py"),
    '"""Run pnpm gen with datamodel-code-generator installed."""\n',
  );
  console.warn("datamodel-code-generator not available; python stub only");
}

// Kotlin: minimal hand-maintained re-export marker (full POJO gen optional)
fs.writeFileSync(
  path.join(kotlinDir, "README.md"),
  "Kotlin models live in the Android app `rules/Models.kt` until jsonschema2pojo is wired.\n",
);

console.log(`Generated ${schemaFiles.length} TypeScript types in src/generated/`);
