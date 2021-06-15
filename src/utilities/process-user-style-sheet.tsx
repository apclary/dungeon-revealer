import postcss, { Root, stringify, Plugin, AnyNode, rule } from "postcss";

const prefixRulesPlugin = (prefix: string): Plugin => ({
  postcssPlugin: "prefix-rules",
  Rule: (ruleNode) => {
    if (!ruleNode.selector.startsWith(prefix)) {
      ruleNode.assign({ selector: `${prefix} ${ruleNode.selector}` });
    }
  },
});

const allowList = {
  color: true,
};

const filterPropertiesPlugin = (): Plugin => ({
  postcssPlugin: "filter-properties",
  Declaration: (declarationNode, helpers) => {
    if (declarationNode.prop in allowList) {
    } else {
      declarationNode.replaceWith(
        new helpers.Comment({ text: `REDACTED '${declarationNode.prop}'.` })
      );
    }
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
    postcss(prefixRulesPlugin(opts.selectorScope), filterPropertiesPlugin())
      .process(css, { from: undefined })
      .then((result) => result.root.nodes.map((node) => stringifyAst(node)));
