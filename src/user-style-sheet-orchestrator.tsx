import * as React from "react";
import { StyleSheet } from "@emotion/sheet";
import once from "lodash/once";

type StyleSheetInterface = {
  /* Register rules for the given style-sheet */
  addRules: (rules: Array<string>) => void;
  /* Notify that we no longer rely on the style sheet and it can be disposed. */
  dispose: () => void;
  flush: () => void;
};

type PrivateInterface = {
  consumerCount: number;
  styleSheet: null | StyleSheet;
};

type ContextType = {
  register: (id: string) => StyleSheetInterface;
};

const Context = React.createContext<ContextType>(undefined as any);

export const Provider = (props: { children: React.ReactNode }) => {
  const [value] = React.useState<ContextType>(() => {
    const interfaces = new Map<string, PrivateInterface>();

    const register: ContextType["register"] = (key) => {
      let privateInterface = interfaces.get(key);
      if (privateInterface == null) {
        privateInterface = {
          consumerCount: 0,
          styleSheet: null,
        };
      }

      const stablePrivateInterface = privateInterface;
      stablePrivateInterface.consumerCount++;

      const dispose = once(() => {
        stablePrivateInterface.consumerCount--;
        if (stablePrivateInterface.consumerCount === 0) {
          interfaces.delete(key);
          if (stablePrivateInterface.styleSheet != null) {
            stablePrivateInterface.styleSheet.flush();
          }
        }
      });

      const styleSheetInterface: StyleSheetInterface = {
        dispose,
        addRules: (rules) => {
          if (stablePrivateInterface.consumerCount === 0) {
            return;
          }

          if (stablePrivateInterface.styleSheet === null) {
            stablePrivateInterface.styleSheet = new StyleSheet({
              container: window.document.head,
              key,
            });
          }

          for (const rule of rules) {
            stablePrivateInterface.styleSheet.insert(rule);
          }
        },
        flush: () => stablePrivateInterface.styleSheet?.flush(),
      };

      return styleSheetInterface;
    };

    return { register };
  });
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
};

export const useUserStyleSheetOrchestrator = (key: string) => {
  const { register } = React.useContext(Context);

  const [state] = React.useState(() => register(key));
  React.useEffect(() => state.dispose, [state]);
  return state;
};
