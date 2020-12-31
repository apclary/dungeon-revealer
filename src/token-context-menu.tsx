import * as React from "react";
import { animated, to } from "react-spring";
import { CirclePicker } from "react-color";
import {
  TokenContextMenuContext,
  TokenContextMenuState,
} from "./token-context-menu-context";
import { useOnClickOutside } from "./hooks/use-on-click-outside";
import { useResetState } from "./hooks/use-reset-state";
import { useAnimatedWindowDimensions } from "./hooks/use-window-dimensions";
import { Input } from "./input";
import { MapTokenEntity } from "./map-typings";
import { ToggleSwitch } from "./toggle-switch";
import { useDebounceCallback } from "./hooks/use-debounce-callback";
import * as Button from "./button";
import * as Icon from "./feather-icons";
import { useNoteWindowActions } from "./dm-area/token-info-aside";
import { useShowSelectNoteModal } from "./dm-area/select-note-modal";
import { StepInput } from "./step-input";
import { ConfigureGridMapToolContext } from "./map-tools/configure-grid-map-tool";

export const TokenContextRenderer = (props: {
  updateToken: (
    tokenId: string,
    changes: Omit<Partial<MapTokenEntity>, "id">
  ) => void;
  deleteToken: (tokenId: string) => void;
  tokens: Array<MapTokenEntity>;
  children: React.ReactNode;
}) => {
  const [state, setState] = React.useState<TokenContextMenuState>(() => ({
    type: "none-selected",
  }));

  const ref = useOnClickOutside<HTMLDivElement>(() => {
    setState((state) =>
      state.type === "none-selected"
        ? state
        : {
            type: "none-selected",
          }
    );
  });
  const activeToken = React.useMemo(() => {
    if (state.type === "none-selected") {
      return null;
    }
    return props.tokens.find((token) => token.id === state.tokenId) ?? null;
  }, [props.tokens, state]);

  const width = 600;
  const windowDimensions = useAnimatedWindowDimensions();

  return (
    <TokenContextMenuContext.Provider value={{ state, setState }}>
      {props.children}
      {state.type === "selected" && activeToken ? (
        <animated.div
          ref={ref}
          style={{
            position: "absolute",
            background: "white",
            padding: 12,
            top: 0,
            left: 0,
            borderRadius: 12,
            transform: to(
              [state.position, windowDimensions] as const,
              ([clickX, clickY], [windowWidth]) => {
                const x =
                  clickX + width / 2 > windowWidth
                    ? windowWidth - width
                    : clickX - width / 2;
                return `translate(${x}px, ${clickY}px)`;
              }
            ),
            width: width,
          }}
          onKeyPress={(ev) => {
            ev.stopPropagation();
          }}
        >
          <TokenContextMenu
            key={activeToken.id}
            token={activeToken}
            updateToken={(changes) =>
              props.updateToken(activeToken.id, changes)
            }
            deleteToken={() => props.deleteToken(activeToken.id)}
            close={() => setState({ type: "none-selected" })}
          />
        </animated.div>
      ) : null}
    </TokenContextMenuContext.Provider>
  );
};

const TokenContextMenu = (props: {
  token: MapTokenEntity;
  updateToken: (changes: Omit<Partial<MapTokenEntity>, "id">) => void;
  deleteToken: () => void;
  close: () => void;
}): React.ReactElement => {
  const noteWindowActions = useNoteWindowActions();
  const [
    showSelectTokenMarkerModalNode,
    showSelectTokenMarkerModal,
  ] = useShowSelectNoteModal();

  const [label, setLabel] = useResetState(props.token.label, [
    props.token.label,
  ]);
  const [radius, setRadius] = useResetState(props.token.radius, [
    props.token.radius,
  ]);
  const [isVisibleForPlayers, setIsVisibleForPlayers] = useResetState(
    props.token.isVisibleForPlayers,
    [props.token.isVisibleForPlayers]
  );
  const [isMovableByPlayers, setIsMovableByPlayers] = useResetState(
    props.token.isMovableByPlayers,
    [props.token.isMovableByPlayers]
  );

  const [color, setColor] = useResetState(props.token.color, [
    props.token.color,
  ]);

  const [isLocked, setIsLocked] = useResetState(props.token.isLocked, [
    props.token.isLocked,
  ]);

  const sync = useDebounceCallback(() => {
    props.updateToken({
      label,
      isVisibleForPlayers,
      isMovableByPlayers,
      radius,
      color,
    });
  }, 300);

  const gridContext = React.useContext(ConfigureGridMapToolContext);

  return (
    <>
      {showSelectTokenMarkerModalNode}
      <div style={{ display: "flex" }}>
        <div style={{ paddingRight: 8, flex: 1 }}>
          <div style={{ display: "flex", width: "100%" }}>
            <div style={{ flexGrow: 1 }}>
              <label>
                <h6 style={{ marginBottom: 8, marginTop: 0 }}>Label</h6>
                <Input
                  placeholder="Label"
                  value={label}
                  onChange={(ev) => {
                    setLabel(ev.target.value);
                    sync();
                  }}
                  style={{ marginBottom: 24 }}
                />
              </label>
            </div>
          </div>
          <label>
            <h6 style={{ marginBottom: 8, marginTop: 0 }}>Size</h6>
            <StepInput
              label={null}
              value={radius}
              onStepChangeValue={(increment) => {
                setRadius((value) => value + (increment ? 1 : -1) * 1);
                sync();
              }}
              onChangeValue={(value) => {
                setRadius(value);
                sync();
              }}
            />
            <div>
              <Button.Tertiary
                small
                onClick={() => {
                  props.updateToken({
                    radius: (gridContext.state.columnWidth / 2) * 0.25 - 5,
                  });
                }}
              >
                0.25x
              </Button.Tertiary>
              <Button.Tertiary
                small
                onClick={() => {
                  props.updateToken({
                    radius: (gridContext.state.columnWidth / 2) * 0.5 - 8,
                  });
                }}
              >
                0.5x
              </Button.Tertiary>
              <Button.Tertiary
                small
                onClick={() => {
                  props.updateToken({
                    radius: (gridContext.state.columnWidth / 2) * 1 - 8,
                  });
                }}
              >
                1x
              </Button.Tertiary>
              <Button.Tertiary
                small
                onClick={() => {
                  props.updateToken({
                    radius: (gridContext.state.columnWidth / 2) * 2 - 8,
                  });
                }}
              >
                2x
              </Button.Tertiary>
              <Button.Tertiary
                small
                onClick={() => {
                  props.updateToken({
                    radius: (gridContext.state.columnWidth / 2) * 3 - 8,
                  });
                }}
              >
                3x
              </Button.Tertiary>
            </div>
          </label>
          <div>
            <h6 style={{ marginBottom: 16, marginTop: 0 }}>Color</h6>
            <ColorPicker
              color={color}
              onChange={(color) => {
                setColor(color);
                sync();
              }}
            />
          </div>
        </div>
        <div style={{ paddingLeft: 8, flex: 1 }}>
          <label>
            <h6 style={{ marginBottom: 8, marginTop: 0 }}>Player Appearance</h6>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <div style={{ flexGrow: 1 }}>Visible to Players</div>
              <div style={{ marginLeft: 8 }}>
                <ToggleSwitch
                  checked={isVisibleForPlayers}
                  onChange={(checked) => {
                    setIsVisibleForPlayers(checked);
                    sync();
                  }}
                />
              </div>
            </div>
          </label>
          <label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              <div style={{ flexGrow: 1 }}>Moveable by Players</div>
              <div style={{ marginLeft: 8 }}>
                <ToggleSwitch
                  checked={isMovableByPlayers}
                  onChange={(checked) => {
                    setIsMovableByPlayers(checked);
                    sync();
                  }}
                />
              </div>
            </div>
          </label>
          <div>
            <h6 style={{ marginBottom: 8 }}>Reference</h6>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <div>{props.token.reference ? "Note" : "None"}</div>
              <div
                style={{
                  flexGrow: 1,
                  paddingLeft: 8,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                {props.token.reference ? (
                  <>
                    <div>
                      <Button.Tertiary
                        small
                        onClick={() => {
                          props.updateToken({ reference: null });
                        }}
                      >
                        <Icon.TrashIcon size={16} />
                        <span>Remove</span>
                      </Button.Tertiary>
                    </div>
                    <div style={{ paddingLeft: 8 }}>
                      <Button.Tertiary
                        small
                        onClick={() => {
                          noteWindowActions.focusOrShowNoteInNewWindow(
                            props.token.reference!.id
                          );
                          props.close();
                        }}
                      >
                        <Icon.EditIcon height={16} />
                        <span>Edit</span>
                      </Button.Tertiary>
                    </div>
                  </>
                ) : (
                  <div>
                    <Button.Tertiary
                      small
                      onClick={() =>
                        showSelectTokenMarkerModal((documentId) => {
                          props.updateToken({
                            reference: {
                              type: "note",
                              id: documentId,
                            },
                          });
                          noteWindowActions.focusOrShowNoteInNewWindow(
                            documentId
                          );
                        })
                      }
                    >
                      <Icon.Link height={16} />
                      <span>Link</span>
                    </Button.Tertiary>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <hr style={{ borderWidth: 0.3, marginTop: 12, marginBottom: 12 }} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div>
          <Button.Tertiary
            small
            onClick={() => {
              props.updateToken({ isLocked: !isLocked });
            }}
            title={isLocked ? "Unlock" : "Lock"}
          >
            {isLocked ? (
              <Icon.LockIcon height={16} />
            ) : (
              <Icon.UnlockIcon height={16} />
            )}
            <span>{isLocked ? "Unlock" : "Lock"}</span>
          </Button.Tertiary>
        </div>
        <div style={{ marginLeft: 8 }}>
          <Button.Tertiary
            small
            onClick={() => {
              props.deleteToken();
            }}
            disabled={isLocked}
            title="Delete Token"
          >
            <Icon.TrashIcon size={16} />
            <span>Delete</span>
          </Button.Tertiary>
        </div>
      </div>
    </>
  );
};

const ColorPicker = React.memo(
  (props: { color: string; onChange: (color: string) => void }) => {
    return (
      <CirclePicker
        color={props.color}
        onChangeComplete={(color) => props.onChange(color.hex)}
      />
    );
  }
);