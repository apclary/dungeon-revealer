import { parse, Root, stringify } from "postcss";
import { flow } from "fp-ts/function";

const prefixRules =
  (prefix: string) =>
  (root: Root): Root => {
    for (const node of root.nodes) {
      if (node.type !== "rule") {
        continue;
      }
      node.selector = `${prefix} ${node.selector}`;
    }

    return root;
  };

const stringifyAst = (root: Root) => {
  let result = "";
  stringify(root, (part) => {
    result += part;
  });
  return result;
};

export const prefixStyleSheet = (selector: string) =>
  flow(parse, prefixRules(selector), stringifyAst);
