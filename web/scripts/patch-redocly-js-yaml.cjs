const fs = require("node:fs");
const path = require("node:path");

const dependencyRoot = path.join(path.dirname(__dirname), "node_modules");
const redoclyCandidates = [
  path.join(dependencyRoot, "openapi-typescript", "node_modules", "@redocly", "openapi-core"),
  path.join(dependencyRoot, "@redocly", "openapi-core"),
];
const redoclyRoot = redoclyCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, "package.json")),
);
if (!redoclyRoot) {
  throw new Error("Unable to locate the locked @redocly/openapi-core package.");
}
const packageJson = JSON.parse(
  fs.readFileSync(path.join(redoclyRoot, "package.json"), "utf8"),
);
const supportedVersions = new Set(["1.34.17", "1.34.18"]);
if (!supportedVersions.has(packageJson.version)) {
  throw new Error(
    `Unsupported @redocly/openapi-core version ${packageJson.version}; ` +
      "review and remove or update the js-yaml compatibility patch.",
  );
}

const adapterPath = path.join(redoclyRoot, "lib", "js-yaml", "index.js");
let adapterSource = fs.readFileSync(adapterPath, "utf8");
const vulnerableAdapter = `const js_yaml_1 = require("js-yaml");
const DEFAULT_SCHEMA_WITHOUT_TIMESTAMP = js_yaml_1.JSON_SCHEMA.extend({
    implicit: [js_yaml_1.types.merge],
    explicit: [js_yaml_1.types.binary, js_yaml_1.types.omap, js_yaml_1.types.pairs, js_yaml_1.types.set],
});
const parseYaml = (str, opts) => (0, js_yaml_1.load)(str, { schema: DEFAULT_SCHEMA_WITHOUT_TIMESTAMP, ...opts });`;
const patchedAdapter = `const js_yaml_1 = require("js-yaml");
const DEFAULT_SCHEMA_WITHOUT_TIMESTAMP = js_yaml_1.CORE_SCHEMA.withTags(
    js_yaml_1.mergeTag,
    js_yaml_1.binaryTag,
    js_yaml_1.omapTag,
    js_yaml_1.pairsTag,
    js_yaml_1.setTag,
);
const parseYaml = (str, opts) => {
    const documents = (0, js_yaml_1.loadAll)(str, {
        schema: DEFAULT_SCHEMA_WITHOUT_TIMESTAMP,
        ...opts,
    });
    if (documents.length === 0) {
        return str.trim() === "" ? undefined : null;
    }
    if (documents.length > 1) {
        throw new js_yaml_1.YAMLException(
            "expected a single document in the stream, but found more",
        );
    }
    return documents[0];
};`;

if (adapterSource.includes(vulnerableAdapter)) {
  adapterSource = adapterSource.replace(vulnerableAdapter, patchedAdapter);
  fs.writeFileSync(adapterPath, adapterSource, "utf8");
} else if (!adapterSource.includes(patchedAdapter)) {
  throw new Error(
    "The Redocly js-yaml adapter no longer matches the reviewed source.",
  );
}

const utilsPath = path.join(redoclyRoot, "lib", "utils.js");
let utilsSource = fs.readFileSync(utilsPath, "utf8");
const vulnerableMinimatchImport = `const minimatch = require("minimatch");`;
const patchedMinimatchImport = `const minimatch = require("minimatch").minimatch;`;

if (utilsSource.includes(vulnerableMinimatchImport)) {
  utilsSource = utilsSource.replace(
    vulnerableMinimatchImport,
    patchedMinimatchImport,
  );
  fs.writeFileSync(utilsPath, utilsSource, "utf8");
} else if (!utilsSource.includes(patchedMinimatchImport)) {
  throw new Error(
    "The Redocly minimatch import no longer matches the reviewed source.",
  );
}
