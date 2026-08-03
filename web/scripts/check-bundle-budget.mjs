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
    gzipLimit: 290 * KIBIBYTE,
    split: {
      minimumFiles: 12,
      entryRawLimit: 250 * KIBIBYTE,
      entryGzipLimit: 75 * KIBIBYTE,
      deferredRawLimit: 240 * KIBIBYTE,
      deferredGzipLimit: 65 * KIBIBYTE,
    },
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

async function measureFile(file) {
  const contents = await readFile(file);
  return {
    file,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents, { level: 9 }).byteLength,
  };
}

async function verifySplitBudget(measurement, split, failures) {
  if (measurement.files.length < split.minimumFiles) {
    failures.push(`JavaScript: expected at least ${split.minimumFiles} compiled chunks, found ${measurement.files.length}`);
    return;
  }
  const indexHtml = await readFile(path.join(path.dirname(assetsDirectory), "index.html"), "utf8");
  const entrySource = indexHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/)?.[1];
  const entryFile = entrySource
    ? measurement.files.find((file) => path.basename(file) === path.basename(entrySource))
    : undefined;
  if (!entryFile) {
    failures.push("JavaScript: the compiled HTML entry script could not be identified");
    return;
  }
  const entry = await measureFile(entryFile);
  const deferred = await Promise.all(measurement.files.filter((file) => file !== entryFile).map(measureFile));
  const largestDeferredRaw = deferred.reduce((largest, item) => item.rawBytes > largest.rawBytes ? item : largest);
  const largestDeferredGzip = deferred.reduce((largest, item) => item.gzipBytes > largest.gzipBytes ? item : largest);
  console.log(
    `JavaScript split: entry ${path.basename(entry.file)} raw ${formatKibibytes(entry.rawBytes)} / ${formatKibibytes(split.entryRawLimit)}, `
      + `gzip ${formatKibibytes(entry.gzipBytes)} / ${formatKibibytes(split.entryGzipLimit)}; `
      + `largest deferred raw ${path.basename(largestDeferredRaw.file)} ${formatKibibytes(largestDeferredRaw.rawBytes)} / ${formatKibibytes(split.deferredRawLimit)}, `
      + `gzip ${path.basename(largestDeferredGzip.file)} ${formatKibibytes(largestDeferredGzip.gzipBytes)} / ${formatKibibytes(split.deferredGzipLimit)}`,
  );
  if (entry.rawBytes > split.entryRawLimit) failures.push(`JavaScript entry raw size ${formatKibibytes(entry.rawBytes)} exceeds ${formatKibibytes(split.entryRawLimit)}`);
  if (entry.gzipBytes > split.entryGzipLimit) failures.push(`JavaScript entry gzip size ${formatKibibytes(entry.gzipBytes)} exceeds ${formatKibibytes(split.entryGzipLimit)}`);
  if (largestDeferredRaw.rawBytes > split.deferredRawLimit) failures.push(`Largest deferred JavaScript raw size ${formatKibibytes(largestDeferredRaw.rawBytes)} exceeds ${formatKibibytes(split.deferredRawLimit)}`);
  if (largestDeferredGzip.gzipBytes > split.deferredGzipLimit) failures.push(`Largest deferred JavaScript gzip size ${formatKibibytes(largestDeferredGzip.gzipBytes)} exceeds ${formatKibibytes(split.deferredGzipLimit)}`);
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

    if (budget.split) await verifySplitBudget(measurement, budget.split, failures);

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
