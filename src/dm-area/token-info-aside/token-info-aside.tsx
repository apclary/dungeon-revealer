import React from "react";
import styled from "@emotion/styled/macro";
import graphql from "babel-plugin-relay/macro";
import { ActiveNoteIdContext, SetActiveNoteIdContext } from ".";
import { NoteEditorActiveItem } from "../note-editor/note-editor-active-item";
import { QueryRenderer } from "react-relay";
import type { tokenInfoAside_nodeQuery } from "./__generated__/tokenInfoAside_nodeQuery.graphql";
import { useRelayEnvironment, useMutation } from "react-relay/hooks";
import { DraggableWindow } from "../../draggable-window";
import * as Icon from "../../feather-icons";
import { tokenInfoAside_shareNoteMutation } from "./__generated__/tokenInfoAside_shareNoteMutation.graphql";

const TokenInfoAside_nodeQuery = graphql`
  query tokenInfoAside_nodeQuery($activeNoteId: ID!) {
    node(id: $activeNoteId) {
      ... on Note {
        __typename
        id
        title
        viewerCanEdit
        ...noteEditorActiveItem_nodeFragment
      }
    }
  }
`;

const TokenInfoAside_shareResourceMutation = graphql`
  mutation tokenInfoAside_shareNoteMutation($input: ShareResourceInput!) {
    shareResource(input: $input)
  }
`;

const NoteEditorSideReference = styled.div`
  position: absolute;
  right: calc(100% + 12px);
  top: 25%;
  width: 300px;
  background: white;
  border-left: 1px solid lightgrey;
  border-radius: 5px;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
`;

export const TokenInfoAside: React.FC<{}> = () => {
  const environment = useRelayEnvironment();
  const activeNoteId = React.useContext(ActiveNoteIdContext);
  const setActiveNoteId = React.useContext(SetActiveNoteIdContext);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const sideBarRef = React.useRef<HTMLDivElement>(null);

  const [mutate] = useMutation<tokenInfoAside_shareNoteMutation>(
    TokenInfoAside_shareResourceMutation
  );

  if (!activeNoteId) return null;

  return (
    <QueryRenderer<tokenInfoAside_nodeQuery>
      environment={environment}
      variables={{ activeNoteId: activeNoteId }}
      query={TokenInfoAside_nodeQuery}
      render={({ error, props }) => {
        if (error) return null;
        if (props?.node?.__typename !== "Note") return null;
        const { node } = props;

        const canEditOptions = props.node.viewerCanEdit
          ? [
              {
                onClick: () => setIsEditMode((isEditMode) => !isEditMode),
                title: isEditMode ? "Save" : "Edit",
                //TODO: Make types more strict
                Icon: isEditMode
                  ? (Icon.SaveIcon as any)
                  : (Icon.EditIcon as any),
              },
            ]
          : [];

        const options = [
          {
            onClick: () =>
              mutate({ variables: { input: { contentId: node.id } } }),
            title: "Share",
            //TODO: Make types more strict
            Icon: Icon.Share as any,
          },
          ...canEditOptions,
        ];

        return (
          <DraggableWindow
            onKeyDown={(ev) => {
              ev.stopPropagation();
              if (ev.key !== "Escape") return;
              if (!isEditMode) setActiveNoteId(null);
            }}
            headerContent={props.node.title}
            bodyContent={
              <>
                <NoteEditorActiveItem
                  isEditMode={isEditMode}
                  toggleIsEditMode={() =>
                    setIsEditMode((isEditMode) => !isEditMode)
                  }
                  nodeRef={props.node}
                  sideBarRef={sideBarRef}
                />
                <NoteEditorSideReference>
                  <div ref={sideBarRef} />
                </NoteEditorSideReference>
              </>
            }
            close={() => setActiveNoteId(null)}
            style={{
              top: "calc(50vh - 25%)",
              left: "calc(100% - 500px - 12px)",
            }}
            options={options}
          />
        );
      }}
    />
  );
};
