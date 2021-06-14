import * as React from "react";
import styled from "@emotion/styled/macro";
import { ShowdownExtension } from "showdown";
import MarkdownView from "react-showdown";
import {
  Heading,
  UnorderedList,
  OrderedList,
  ListItem,
  Text,
  Divider,
} from "@chakra-ui/react";
import _sanitizeHtml from "sanitize-html";
import { StyleSheet } from "@emotion/sheet";
import { useStaticRef } from "../../hooks/use-static-ref";
import {
  parseTemplateAttributes,
  Attribute,
} from "../../utilities/attribute-parser";
import { NoteLink } from "./note-link";
import { SharableImage } from "./sharable-image";
import { ChatMessageButton } from "./chat-message-button";
import { randomHash } from "../../utilities/random-hash";
import { processUserStyleSheet } from "../../utilities/process-user-style-sheet";
import { useGetIsMounted } from "../../hooks/use-get-is-mounted";

const H1: React.FC = (props) => <Heading as="h1">{props.children}</Heading>;
const H2: React.FC = (props) => (
  <Heading as="h2" size="md">
    {props.children}
  </Heading>
);
const H3: React.FC = (props) => (
  <Heading as="h3" size="sm">
    {props.children}
  </Heading>
);
const H4: React.FC = (props) => (
  <Heading as="h4" size="xs">
    {props.children}
  </Heading>
);

const components = {
  Image: SharableImage,
  ChatMessage: ChatMessageButton,
  ChatMacro: ChatMessageButton,
  Link: NoteLink,
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  hr: Divider,
  p: (props: React.ComponentProps<typeof Text>) => <Text {...props} as="div" />,
};

const allowedTags = [
  "a",
  "div",
  "p",
  "blockquote",
  "span",
  "em",
  "strong",
  "pre",
  "code",
  "h1",
  "h2",
  "h3",
  "h4",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "li",
  "hr",
  "img",
  "style",
  ...Object.keys(components),
];

type Template = { content: string; variables: Map<string, Attribute> };
type TemplateMap = Map<string, Template>;

const transformTemplateExtension = (
  templateMap: TemplateMap
): ShowdownExtension => ({
  type: "lang",
  filter: (text) => {
    let finalText = "";
    let startTagMatch: null | RegExpExecArray;

    const START_TAG = /(<Template(?:[^>]*)>)/;
    const END_TAG = "</Template>";

    while ((startTagMatch = START_TAG.exec(text)) !== null) {
      let endTagIndex = text.indexOf(END_TAG);
      if (endTagIndex === -1) {
        break;
      }

      const matchStringLength = startTagMatch[0].length;
      const rawTemplateAttributes = startTagMatch[1];
      const templateAttributes = parseTemplateAttributes(rawTemplateAttributes);
      if (templateAttributes) {
        const templateContents = text.substring(
          startTagMatch.index + matchStringLength,
          endTagIndex
        );
        templateMap.set(templateAttributes.id.value.value, {
          content: templateContents.replace(/^\s*/gm, ""),
          variables: templateAttributes.variables,
        });
      }

      finalText = finalText + text.substring(0, startTagMatch.index);
      text = text.substr(endTagIndex + END_TAG.length);
    }
    finalText = finalText + text;
    return finalText;
  },
});

const scopedStyleBlockExtension = (
  selectorScope: string,
  onCSSNodes: (nodes: Array<string>) => void
): ShowdownExtension => ({
  type: "lang",
  filter: (text) => {
    let finalText = "";
    let startTagMatch: null | RegExpExecArray;

    const START_TAG = /(<style(?:[^>]*)>)/;
    const END_TAG = "</style>";

    while ((startTagMatch = START_TAG.exec(text)) !== null) {
      let endTagIndex = text.indexOf(END_TAG);
      if (endTagIndex === -1) {
        break;
      }
      finalText += text.substring(0, startTagMatch.index);

      const cssStyleSheet = text.substring(
        startTagMatch.index + startTagMatch[1].length,
        endTagIndex
      );

      text = text.substr(endTagIndex + END_TAG.length);

      processUserStyleSheet({ selectorScope })(cssStyleSheet)
        .then((rules) => {
          onCSSNodes(rules);
        })
        .catch((err) => {
          console.error(err);
        });
    }
    finalText += text;
    return finalText;
  },
});

const sanitizeHtml = (html: string) =>
  _sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      Image: ["id"],
      ChatMacro: ["message", "templateId", "var-*"],
      // alias for ChatMessage
      ChatMessage: ["message", "templateId", "var-*"],
      Link: ["id"],
      div: ["style", "class"],
      span: ["style", "class"],
      a: ["target", "rel", "href", "id", "class"],
      img: ["src", "title", "class"],
    },
    nonTextTags: ["script", "textarea", "option", "noscript"],
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href"],
    selfClosing: ["Image"],
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
    transformTags: {
      a: (_, attribs) => {
        if (attribs.href && /^https?:\/\//.test(attribs.href)) {
          return {
            tagName: "a",
            attribs: {
              ...attribs,
              href: attribs.href,
              target: "_BLANK",
              rel: "noopener",
            },
          };
        }
        return {
          tagName: "Link",
          attribs: {
            id: attribs.href || "",
          } as { [key: string]: string },
        };
      },
    },
  });

const HtmlContainerStyled = styled.div`
  flex-grow: 1;
  overflow-wrap: break-word;
  min-height: 100%;
  font-size: 12px;
  line-height: 1.5;

  > div > * {
    margin-bottom: 6px;
  }

  blockquote {
    margin-left: 0;
    border-left: gray 12px solid;
    padding-left: 24px;
  }

  img {
    max-width: 100%;
  }

  a {
    color: blue;
    text-decoration: underline;
  }

  p {
    margin-top: 0;
    margin-bottom: 4px;
    max-width: 40em;
  }

  pre {
    border: 0.5px solid lightgray;
    border-radius: 2px;
    padding: 4px;
    background: #f8f8f8;
  }

  table {
    border-collapse: collapse;
  }

  td,
  th {
    border: 1px solid #999;
    padding: 0.5rem;
    text-align: left;
  }
`;

export const TemplateContext = React.createContext<TemplateMap>(new Map());

export const HtmlContainer = React.memo(
  (props: { markdown: string; scopeHash?: string }) => {
    const templateMap: TemplateMap = useStaticRef(() => new Map());

    const scope = React.useMemo(
      () => props.scopeHash ?? randomHash(),
      [props.scopeHash]
    );

    /**
     * We store the styles in a StyleSheet block that is appended to the document head.
     */
    const [styleSheet, setStyleSheet] = React.useState<null | StyleSheet>(null);
    React.useLayoutEffect(() => {
      const container = window.document.createElement("div");
      window.document.head.appendChild(container);

      const styleSheet = new StyleSheet({ container, key: scope });
      setStyleSheet(styleSheet);

      return () => {
        window.document.head.removeChild(container);
      };
    }, [scope]);

    const getIsMounted = useGetIsMounted();

    if (styleSheet === null) {
      return null;
    }

    return (
      <TemplateContext.Provider value={templateMap}>
        <HtmlContainerStyled className={scope} data-css-scope-hash={scope}>
          <MarkdownView
            sanitizeHtml={sanitizeHtml}
            markdown={props.markdown}
            extensions={[
              transformTemplateExtension(templateMap),
              scopedStyleBlockExtension(
                `[data-css-scope-hash="${scope}"]`,
                (nodes) => {
                  if (getIsMounted()) {
                    for (const node of nodes) {
                      styleSheet.insert(node);
                    }
                  }
                }
              ),
            ]}
            components={components}
            options={{
              simpleLineBreaks: true,
              tables: true,
            }}
          />
        </HtmlContainerStyled>
      </TemplateContext.Provider>
    );
  }
);
