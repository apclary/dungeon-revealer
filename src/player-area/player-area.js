import React, { useRef, useState, useEffect, useCallback } from "react";
import produce from "immer";
import createPersistedState from "use-persisted-state";
import useAsyncEffect from "@n1ru4l/use-async-effect";
import { loadImage } from "../util";
import { Toolbar } from "../toolbar";
import styled from "@emotion/styled/macro";
import * as Icons from "../feather-icons";
import { SplashScreen } from "../splash-screen";
import { AuthenticationScreen } from "../authentication-screen";
import { buildApiUrl } from "../public-url";
import { ImageLightBoxModal } from "../image-lightbox-modal";
import { AuthenticatedAppShell } from "../authenticated-app-shell";
import { useSocket } from "../socket";
import { useStaticRef } from "../hooks/use-static-ref";
import debounce from "lodash/debounce";
import { MapView } from "../map-view";

const ToolbarContainer = styled.div`
  position: absolute;
  display: flex;
  justify-content: center;
  width: 100%;
  bottom: 12px;
  pointer-events: none;
`;

const AbsoluteFullscreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const PlayerMap = ({ fetch, pcPassword, socket }) => {
  const currentMapRef = useRef(null);
  const [currentMap, setCurrentMap] = useState(null);
  const [fogCanvas, setFogCanvas] = useState(null);
  const fogCanvasRef = React.useRef(fogCanvas);
  const [sharedMediaId, setSharedMediaId] = useState(false);
  const mapNeedsUpdateRef = React.useRef(false);

  const mapId = currentMap ? currentMap.id : null;
  const showSplashScreen = mapId === null;

  const controlRef = React.useRef(null);
  /**
   * used for canceling pending requests in case there is a new update incoming.
   * should be either null or an array of tasks returned by loadImage
   */
  const pendingFogImageLoad = useRef(null);
  const [markedAreas, setMarkedAreas] = useState(() => []);

  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const cacheBusterRef = useRef(0);

  useAsyncEffect(
    function* () {
      const onReceiveMap = async (data) => {
        if (!data) {
          return;
        }

        /**
         * Hide map (show splashscreen)
         */
        if (!data.map) {
          currentMapRef.current = null;
          setCurrentMap(null);
          setFogCanvas(null);
          return;
        }
        /**
         * Fog has updated
         */
        if (currentMapRef.current && currentMapRef.current.id === data.map.id) {
          const imageUrl = buildApiUrl(
            // prettier-ignore
            `/map/${data.map.id}/fog-live?cache_buster=${cacheBusterRef.current}&authorization=${encodeURIComponent(pcPassword)}`
          );
          cacheBusterRef.current = cacheBusterRef.current + 1;

          const task = loadImage(imageUrl);
          pendingFogImageLoad.current = task;

          task.promise.then((fogImage) => {
            const context = fogCanvasRef.current?.getContext("2d");
            if (!context) {
              throw new Error("Invalid state.");
            }
            context.clearRect(
              0,
              0,
              fogImage.naturalWidth,
              fogImage.naturalHeight
            );
            context.drawImage(fogImage, 0, 0);
            mapNeedsUpdateRef.current = true;
          });
          return;
        }

        /**
         * Load new map
         */
        currentMapRef.current = data.map;

        const imageUrl = buildApiUrl(
          // prettier-ignore
          `/map/${data.map.id}/fog-live?cache_buster=${cacheBusterRef.current}&authorization=${encodeURIComponent(pcPassword)}`
        );
        cacheBusterRef.current = cacheBusterRef.current + 1;

        const task = loadImage(imageUrl);
        pendingFogImageLoad.current = task;

        task.promise.then((fogImage) => {
          const canvas = document.createElement("canvas");
          canvas.width = fogImage.naturalWidth;
          canvas.height = fogImage.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Invalid state.");
          }
          context.drawImage(fogImage, 0, 0);
          setFogCanvas(canvas);
          setCurrentMap(data.map);
          fogCanvasRef.current = canvas;
          mapNeedsUpdateRef.current = true;
        });
      };

      const {
        data: { activeMap },
      } = yield fetch("/active-map").then((res) => res.json());

      if (activeMap) {
        yield onReceiveMap({ map: activeMap });
      }

      socket.on("mark area", async (data) => {
        setMarkedAreas((markedAreas) => [
          ...markedAreas,
          {
            id: data.id,
            x: data.x,
            y: data.y,
          },
        ]);
      });

      socket.on("share image", ({ id }) => {
        setSharedMediaId(id);
      });

      socket.on("map update", onReceiveMap);

      const contextmenuListener = (ev) => {
        ev.preventDefault();
      };
      window.addEventListener("contextmenu", contextmenuListener);

      return () => {
        socket.off("mark area");
        socket.off("map update");

        window.removeEventListener("contextmenu", contextmenuListener);
        if (pendingFogImageLoad.current) {
          pendingFogImageLoad.current.cancel();
          pendingFogImageLoad.current = null;
        }
      };
    },
    [socket, fetch, pcPassword, refetchTrigger]
  );

  useEffect(() => {
    if (!mapId) return;
    const eventName = `token:mapId:${mapId}`;

    socket.on(eventName, ({ type, data }) => {
      if (type === "add") {
        setCurrentMap(
          produce((map) => {
            map.tokens.push(data.token);
          })
        );
      } else if (type === "update") {
        setCurrentMap(
          produce((map) => {
            map.tokens = map.tokens.map((token) => {
              if (token.id !== data.token.id) return token;
              return {
                ...token,
                ...data.token,
              };
            });
          })
        );
      } else if (type === "remove") {
        setCurrentMap(
          produce((map) => {
            map.tokens = map.tokens = map.tokens.filter(
              (token) => token.id !== data.tokenId
            );
          })
        );
      }
    });

    return () => socket.off(eventName);
  }, [socket, mapId]);

  useEffect(() => {
    const listener = () => {
      setRefetchTrigger((i) => i + 1);
    };

    window.addEventListener("focus", listener);
    return () => window.removeEventListener("focus", listener);
  }, []);

  const persistTokenChanges = useStaticRef(() =>
    debounce((loadedMapId, id, updates, localFetch) => {
      localFetch(`/map/${loadedMapId}/token/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...updates,
        }),
      });
    }, 100)
  );

  const updateToken = useCallback(
    ({ id, ...updates }) => {
      setCurrentMap(
        produce((map) => {
          map.tokens = map.tokens.map((token) => {
            if (token.id !== id) return token;
            return { ...token, ...updates };
          });
        })
      );

      persistTokenChanges(currentMap.id, id, updates, fetch);
    },
    [currentMap, persistTokenChanges, fetch]
  );

  return (
    <>
      <div
        style={{
          cursor: "grab",
          background: "black",
          height: "100vh",
        }}
      >
        <React.Suspense fallback={null}>
          {currentMap && fogCanvas ? (
            <MapView
              mapImageUrl={buildApiUrl(
                `/map/${currentMap.id}/map?authorization=${encodeURIComponent(
                  pcPassword
                )}`
              )}
              fogCanvas={fogCanvas}
              controlRef={controlRef}
              tokens={currentMap.tokens}
              updateTokenPosition={(id, position) =>
                updateToken({ id, ...position })
              }
              markedAreas={markedAreas}
              markArea={({ x, y }) => {
                socket.emit("mark area", { x, y });
              }}
              mapTextureNeedsUpdateRef={mapNeedsUpdateRef}
              grid={
                currentMap.grid && currentMap.showGridToPlayers
                  ? {
                      x: currentMap.grid.x,
                      y: currentMap.grid.y,
                      sideLength: currentMap.grid.sideLength,
                      color: currentMap.gridColor || "red",
                    }
                  : null
              }
            />
          ) : null}
        </React.Suspense>
      </div>
      {!showSplashScreen ? (
        <ToolbarContainer>
          <Toolbar horizontal>
            <Toolbar.Logo />
            <Toolbar.Group>
              <Toolbar.Item isActive>
                <Toolbar.Button
                  onClick={() => {
                    controlRef.current.center();
                  }}
                  onTouchStart={(ev) => {
                    ev.preventDefault();
                    controlRef.current.center();
                  }}
                >
                  <Icons.Compass />
                  <Icons.Label>Center Map</Icons.Label>
                </Toolbar.Button>
              </Toolbar.Item>
              <Toolbar.Item isActive>
                <Toolbar.LongPressButton
                  onClick={() => {}}
                  onLongPress={() => {}}
                >
                  <Icons.ZoomIn />
                  <Icons.Label>Zoom In</Icons.Label>
                </Toolbar.LongPressButton>
              </Toolbar.Item>
              <Toolbar.Item isActive>
                <Toolbar.LongPressButton
                  onClick={() => {}}
                  onLongPress={() => {}}
                >
                  <Icons.ZoomOut />
                  <Icons.Label>Zoom Out</Icons.Label>
                </Toolbar.LongPressButton>
              </Toolbar.Item>
            </Toolbar.Group>
          </Toolbar>
        </ToolbarContainer>
      ) : (
        <AbsoluteFullscreenContainer>
          <SplashScreen text="Ready." />
        </AbsoluteFullscreenContainer>
      )}
      {sharedMediaId ? (
        <ImageLightBoxModal
          src={buildApiUrl(`/images/${sharedMediaId}`)}
          close={() => setSharedMediaId(null)}
        />
      ) : null}
    </>
  );
};

const usePcPassword = createPersistedState("pcPassword");

const AuthenticatedContent = ({ pcPassword, localFetch }) => {
  const socket = useSocket();

  return (
    <AuthenticatedAppShell password={pcPassword} socket={socket}>
      <PlayerMap fetch={localFetch} pcPassword={pcPassword} socket={socket} />
    </AuthenticatedAppShell>
  );
};

export const PlayerArea = () => {
  const [pcPassword, setPcPassword] = usePcPassword("");

  const [mode, setMode] = useState("LOADING");

  const localFetch = useCallback(
    (input, init = {}) => {
      return fetch(buildApiUrl(input), {
        ...init,
        headers: {
          Authorization: pcPassword ? `Bearer ${pcPassword}` : undefined,
          ...init.headers,
        },
      }).then((res) => {
        if (res.status === 401) {
          console.error("Unauthenticated access.");
          setMode("AUTHENTICATE");
        }
        return res;
      });
    },
    [pcPassword]
  );

  useAsyncEffect(
    function* () {
      const result = yield localFetch("/auth").then((res) => res.json());
      if (!result.data.role) {
        setMode("AUTHENTICATE");
        return;
      }
      setMode("READY");
    },
    [localFetch]
  );

  if (mode === "LOADING") {
    return <SplashScreen text="Loading..." />;
  }

  if (mode === "AUTHENTICATE") {
    return (
      <AuthenticationScreen
        requiredRole="PC"
        fetch={localFetch}
        onAuthenticate={(password) => {
          setPcPassword(password);
        }}
      />
    );
  }

  if (mode === "READY") {
    return (
      <AuthenticatedContent localFetch={localFetch} pcPassword={pcPassword} />
    );
  }

  throw new Error("Invalid mode.");
};
