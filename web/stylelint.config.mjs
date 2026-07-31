/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "node_modules/**",
    "../src/uok/static/**",
  ],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  rules: {
    "color-no-hex": true,
    "declaration-no-important": true,
    "declaration-property-value-disallowed-list": {
      "text-align": [/^(left|right)$/],
    },
    // State and breakpoint selectors intentionally follow their base rules across layered files.
    // Reordering them to satisfy this heuristic would change the cascade.
    "no-descending-specificity": null,
    "property-disallowed-list": [
      "border-left",
      "border-right",
      "left",
      "margin-left",
      "margin-right",
      "padding-left",
      "padding-right",
      "right",
    ],
    "selector-max-id": 0,
  },
  overrides: [
    {
      files: ["src/design-tokens.css"],
      rules: {
        "color-no-hex": null,
      },
    },
    {
      files: ["src/styles/responsive.css"],
      rules: {
        "declaration-no-important": null,
      },
    },
  ],
};
