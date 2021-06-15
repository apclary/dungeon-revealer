import * as React from "react";
import { loader } from "@monaco-editor/react";
import { render } from "react-dom";
import { Global, CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { ChakraProvider } from "@chakra-ui/react";
import { getUrlPrefix, buildUrl } from "./public-url";
import { globalStyles } from "./global-styles";
import { Modal } from "./modal";
import * as UserStyleSheetOrchestrator from "./user-style-sheet-orchestrator";
import { registerSoundPlayback } from "./register-sound-playback";

loader.config({ paths: { vs: buildUrl("/monaco-editor/vs") } });

const emotionCache = createCache({ key: "chache" });
emotionCache.compat = true;

const element = document.querySelector("#root");

// Listen to tab events to enable outlines (accessibility improvement)
document.body.addEventListener("keyup", (ev) => {
  /* tab */
  if (ev.keyCode === 9) {
    document.body.classList.remove("no-focus-outline");
  }
});

const pathname = window.location.pathname.replace(getUrlPrefix(), "");

const urlSearchParameter = new URLSearchParams(window.location.search);

const main = async () => {
  let component = null;
  switch (pathname) {
    case "/dm": {
      const { DmArea } = await import("./dm-area/dm-area");
      component = <DmArea />;
      break;
    }
    default: {
      const isMapOnly = urlSearchParameter.get("map_only") !== null;
      const password = urlSearchParameter.get("password");

      const { PlayerArea } = await import("./player-area");
      component = (
        <PlayerArea isMapOnly={isMapOnly} password={password || ""} />
      );
    }
  }
  if (element) {
    render(
      <CacheProvider value={emotionCache}>
        <ChakraProvider>
          <UserStyleSheetOrchestrator.Provider>
            <Modal.Provider>
              <Global styles={globalStyles} />
              {component}
            </Modal.Provider>
          </UserStyleSheetOrchestrator.Provider>
        </ChakraProvider>
      </CacheProvider>,
      element
    );
  }
};

registerSoundPlayback();
main();
