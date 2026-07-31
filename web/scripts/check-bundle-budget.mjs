import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const KIBIBYTE = 1024;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const assetsDirectory = path.join(
  repositoryRoot,
  "src",
  "uok",
  "static",
  "app",
  "assets",
);

const budgets = [
  {
    label: "JavaScript",
    extensions: new Set([".js"]),
    rawLimit: 1000 * KIBIBYTE,
    gzipLimit: 270 * KIBIBYTE,
  },
  {
    label: "CSS",
    extensions: new Set([".css"]),
    rawLimit: 220 * KIBIBYTE,
    gzipLimit: 30 * KIBIBYTE,
  },
];

function formatKibibytes(bytes) {
  return `${(bytes / KIBIBYTE).toFixed(2)} KiB`;
}

function formatUtilization(bytes, limit) {
  return `${((bytes / limit) * 100).toFixed(1)}%`;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function measureAssets(files, extensions) {
  const selectedFiles = files.filter((file) =>
    extensions.has(path.extname(file).toLowerCase()),
  );
  let rawBytes = 0;
  let gzipBytes = 0;

  for (const file of selectedFiles) {
    const contents = await readFile(file);
    rawBytes += contents.byteLength;
    gzipBytes += gzipSync(contents, { level: 9 }).byteLength;
  }

  return { files: selectedFiles, rawBytes, gzipBytes };
}

async function main() {
  let assetFiles;
  try {
    assetFiles = await listFiles(assetsDirectory);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Compiled frontend assets were not found at ${assetsDirectory}. Run npm run build:static first. ${detail}`,
      { cause: error },
    );
  }

  const failures = [];

  console.log("Frontend bundle budget evidence");
  console.log(`Assets: ${assetsDirectory}`);

  for (const budget of budgets) {
    const measurement = await measureAssets(assetFiles, budget.extensions);
    if (measurement.files.length === 0) {
      failures.push(`${budget.label}: no matching compiled asset was found`);
      continue;
    }

    console.log(
      `${budget.label}: ${measurement.files.length} file(s), ` +
        `raw ${formatKibibytes(measurement.rawBytes)} / ${formatKibibytes(budget.rawLimit)} ` +
        `(${formatUtilization(measurement.rawBytes, budget.rawLimit)}), ` +
        `gzip ${formatKibibytes(measurement.gzipBytes)} / ${formatKibibytes(budget.gzipLimit)} ` +
        `(${formatUtilization(measurement.gzipBytes, budget.gzipLimit)})`,
    );

    if (measurement.rawBytes > budget.rawLimit) {
      failures.push(
        `${budget.label} raw size ${formatKibibytes(measurement.rawBytes)} exceeds ${formatKibibytes(budget.rawLimit)}`,
      );
    }
    if (measurement.gzipBytes > budget.gzipLimit) {
      failures.push(
        `${budget.label} gzip size ${formatKibibytes(measurement.gzipBytes)} exceeds ${formatKibibytes(budget.gzipLimit)}`,
      );
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`ERROR: ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Frontend bundle budgets passed.");
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
