import postcss, { Root, stringify, Plugin, AnyNode, rule } from "postcss";

const prefixRulesPlugin = (prefix: string): Plugin => ({
  postcssPlugin: "prefix-rules",
  Rule: (ruleNode) => {
    if (!ruleNode.selector.startsWith(prefix)) {
      ruleNode.assign({ selector: `${prefix} ${ruleNode.selector}` });
    }
  },
});

/**
 * Verify whether a property is potential XSS.
 */
const regexJavascriptUrl = /javascript\s*\:/gim;
const isXSSValue = (value: string) => regexJavascriptUrl.test(value);

type CSSRule = boolean | ((value: string) => boolean);

const allowList: Record<string, CSSRule | undefined> = {
  color: true,
  "background-color": true,
  padding: true,
  "padding-left": true,
  "padding-right": true,
  "padding-top": true,
  "padding-bottom": true,
  margin: true,
  "margin-left": true,
  "margin-right": true,
  "margin-bottom": true,
  "margin-top": true,
};

const applyPropertyAllowListPLugin = (): Plugin => ({
  postcssPlugin: "fapply-property-allow-list",
  Declaration: (declarationNode, helpers) => {
    const rule = allowList[declarationNode.prop];

    if (isXSSValue(declarationNode.value) === false) {
      if (rule === true) {
        return;
      }
      if (typeof rule === "function" && rule(declarationNode.value) === true) {
        return;
      }
    }

    declarationNode.replaceWith(
      new helpers.Comment({ text: `REDACTED '${declarationNode.prop}'.` })
    );
  },
});

const stringifyAst = (root: AnyNode) => {
  let result = "";
  stringify(root, (part) => {
    result += part;
  });
  return result;
};

type ProcessUserStyleSheetOptions = {
  selectorScope: string;
};

/**
 * Process a user-defined StyleSheet.
 *
 * Prefixes all rules to be scoped to the provided scope selector in order to avoid user-styles to affect any other styles within dungeon-revealer.
 */
export const processUserStyleSheet =
  (opts: ProcessUserStyleSheetOptions) =>
  (css: string): Promise<Array<string>> =>
    postcss(
      prefixRulesPlugin(opts.selectorScope),
      applyPropertyAllowListPLugin()
    )
      .process(css, { from: undefined })
      .then((result) => result.root.nodes.map((node) => stringifyAst(node)));
