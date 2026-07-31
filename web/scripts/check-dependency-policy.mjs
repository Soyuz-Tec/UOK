import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const packagePath = path.join(webRoot, "package.json");
const lockPath = path.join(webRoot, "package-lock.json");
const allowedRuntimeDependencies = new Set([
  "lucide-react",
  "react",
  "react-dom",
]);
const governedToolingDependencies = new Set([
  "@eslint/js",
  "eslint",
  "eslint-plugin-react-hooks",
  "globals",
  "stylelint",
  "stylelint-config-standard",
  "typescript-eslint",
]);
const exactVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read valid JSON from ${file}: ${detail}`, {
      cause: error,
    });
  }
}

function asDependencyMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function dependencySectionEntries(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.keys(value);
  return value == null ? [] : [`<invalid:${typeof value}>`];
}

function rejectAlternateRuntimeSections(owner, source, failures) {
  for (const section of [
    "optionalDependencies",
    "peerDependencies",
    "bundleDependencies",
    "bundledDependencies",
  ]) {
    const entries = dependencySectionEntries(source[section]);
    if (entries.length > 0) {
      failures.push(
        `${owner}.${section} must be empty; keep the approved runtime stack exclusively in dependencies (found ${entries.sort().join(", ")})`,
      );
    }
  }
}

function compareDependencyMaps(label, manifestMap, lockMap, failures) {
  const names = new Set([...Object.keys(manifestMap), ...Object.keys(lockMap)]);

  for (const name of [...names].sort()) {
    if (!(name in manifestMap)) {
      failures.push(`${label}.${name} exists only in package-lock.json`);
    } else if (!(name in lockMap)) {
      failures.push(`${label}.${name} is missing from package-lock.json`);
    } else if (manifestMap[name] !== lockMap[name]) {
      failures.push(
        `${label}.${name} differs: package.json=${manifestMap[name]}, package-lock.json=${lockMap[name]}`,
      );
    }
  }
}

function resolvedVersions(lockPackages, dependencyName, failures) {
  const suffix = `/node_modules/${dependencyName}`;
  const entries = Object.entries(lockPackages).filter(
    ([packagePath]) =>
      packagePath === `node_modules/${dependencyName}` ||
      packagePath.endsWith(suffix),
  );
  const versions = new Set();

  for (const [packagePath, metadata] of entries) {
    const version = metadata?.version;
    if (typeof version !== "string" || version.length === 0) {
      failures.push(`${packagePath} does not declare a resolved version`);
    } else {
      versions.add(version);
    }
  }

  if (entries.length === 0) {
    failures.push(`${dependencyName} has no resolved package-lock.json entry`);
  } else if (versions.size > 1) {
    failures.push(
      `${dependencyName} resolves to multiple versions: ${[...versions].sort().join(", ")}`,
    );
  }

  return versions;
}

async function main() {
  const [manifest, lock] = await Promise.all([
    readJson(packagePath),
    readJson(lockPath),
  ]);
  const failures = [];
  const runtimeDependencies = asDependencyMap(manifest.dependencies);
  const developmentDependencies = asDependencyMap(manifest.devDependencies);
  const runtimeNames = Object.keys(runtimeDependencies).sort();
  rejectAlternateRuntimeSections("package.json", manifest, failures);

  for (const dependencyName of runtimeNames) {
    if (!allowedRuntimeDependencies.has(dependencyName)) {
      failures.push(
        `${dependencyName} is not an allowed direct runtime dependency`,
      );
    }
    if (!exactVersionPattern.test(runtimeDependencies[dependencyName])) {
      failures.push(
        `${dependencyName} must use an exact semantic version, found ${runtimeDependencies[dependencyName]}`,
      );
    }
  }

  for (const dependencyName of [...allowedRuntimeDependencies].sort()) {
    if (!(dependencyName in runtimeDependencies)) {
      failures.push(`${dependencyName} is a required direct runtime dependency`);
    }
  }

  for (const dependencyName of [...governedToolingDependencies].sort()) {
    const version = developmentDependencies[dependencyName];
    if (typeof version !== "string") {
      failures.push(`${dependencyName} is a required frontend quality dependency`);
    } else if (!exactVersionPattern.test(version)) {
      failures.push(
        `${dependencyName} must use an exact semantic version, found ${version}`,
      );
    }
  }

  if (
    runtimeDependencies.react &&
    runtimeDependencies["react-dom"] &&
    runtimeDependencies.react !== runtimeDependencies["react-dom"]
  ) {
    failures.push(
      `react and react-dom must use the same version: ${runtimeDependencies.react} != ${runtimeDependencies["react-dom"]}`,
    );
  }

  if (lock.lockfileVersion !== 3) {
    failures.push(
      `package-lock.json must use lockfileVersion 3, found ${String(lock.lockfileVersion)}`,
    );
  }

  const lockPackages = asDependencyMap(lock.packages);
  const lockRoot = asDependencyMap(lockPackages[""]);
  rejectAlternateRuntimeSections(
    "package-lock.json packages[\"\"]",
    lockRoot,
    failures,
  );
  compareDependencyMaps(
    "dependencies",
    runtimeDependencies,
    asDependencyMap(lockRoot.dependencies),
    failures,
  );
  compareDependencyMaps(
    "devDependencies",
    developmentDependencies,
    asDependencyMap(lockRoot.devDependencies),
    failures,
  );

  const resolved = new Map();
  for (const dependencyName of [...allowedRuntimeDependencies].sort()) {
    const versions = resolvedVersions(
      lockPackages,
      dependencyName,
      failures,
    );
    resolved.set(dependencyName, versions);

    if (
      versions.size === 1 &&
      runtimeDependencies[dependencyName] &&
      !versions.has(runtimeDependencies[dependencyName])
    ) {
      failures.push(
        `${dependencyName} lock resolution ${[...versions][0]} does not match package.json ${runtimeDependencies[dependencyName]}`,
      );
    }
  }

  const resolvedReact = resolved.get("react");
  const resolvedReactDom = resolved.get("react-dom");
  if (
    resolvedReact?.size === 1 &&
    resolvedReactDom?.size === 1 &&
    [...resolvedReact][0] !== [...resolvedReactDom][0]
  ) {
    failures.push(
      `resolved react and react-dom versions differ: ${[...resolvedReact][0]} != ${[...resolvedReactDom][0]}`,
    );
  }

  console.log("Frontend dependency policy evidence");
  console.log(`Manifest: ${packagePath}`);
  console.log(`Lockfile: ${lockPath} (version ${String(lock.lockfileVersion)})`);
  for (const dependencyName of runtimeNames) {
    const versions = [...(resolved.get(dependencyName) ?? [])].sort();
    console.log(
      `${dependencyName}: direct ${runtimeDependencies[dependencyName]}, resolved ${versions.join(", ") || "missing"}`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`ERROR: ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Frontend dependency policy passed.");
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
