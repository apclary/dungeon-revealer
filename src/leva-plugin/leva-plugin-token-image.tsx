import * as React from "react";
import { createPlugin, useInputContext, Row, Label } from "leva/plugin";
import {
  Button,
  HStack,
  Popover,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Box,
  Input,
  InputLeftElement,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Image,
  Center,
  Text,
  VStack,
} from "@chakra-ui/react";
import graphql from "babel-plugin-relay/macro";
import { ChakraIcon } from "../feather-icons";
import { usePagination, useQuery } from "relay-hooks";
import { levaPluginTokenImage_TokenImagesFragment$key } from "./__generated__/levaPluginTokenImage_TokenImagesFragment.graphql";
import { levaPluginTokenImage_TokenImagesQuery } from "./__generated__/levaPluginTokenImage_TokenImagesQuery.graphql";
import { useTokenImageUpload } from "../dm-area/token-image-upload";

const normalize = (opts: { value: string | null }) => opts;
const sanitize = (value: string): string => value;

const TokenImageReference = () => {
  const { displayValue, setValue } = useInputContext<any>();
  const [node, selectFile] = useTokenImageUpload();

  return (
    <>
      <Portal>{node}</Portal>
      <Row input>
        <Label>Image</Label>
        <HStack alignItems="center" spacing={1}>
          {displayValue ? (
            <>
              <Box>
                <Popover
                  isLazy
                  placement="top-start"
                  closeOnBlur={node === null}
                >
                  <PopoverTrigger>
                    <Button size="xs">Change</Button>
                  </PopoverTrigger>
                  <Portal>
                    <PopoverContent width="400px">
                      <TokenImagePopoverContent
                        onSelect={(value) => setValue(value)}
                        onSelectFile={(file, connection) =>
                          selectFile(file, [connection])
                        }
                      />
                    </PopoverContent>
                  </Portal>
                </Popover>
              </Box>
              <Box>
                <Button
                  size="xs"
                  onClick={() => {
                    setValue(null);
                  }}
                >
                  Remove
                </Button>
              </Box>
            </>
          ) : (
            <Box>
              <Popover isLazy placement="top-start" closeOnBlur={node === null}>
                <PopoverTrigger>
                  <Button size="xs">Add</Button>
                </PopoverTrigger>
                <Portal>
                  <PopoverContent width="400px">
                    <TokenImagePopoverContent
                      onSelect={(value) => setValue(value)}
                      onSelectFile={(file, connection) =>
                        selectFile(file, [connection])
                      }
                    />
                  </PopoverContent>
                </Portal>
              </Popover>
            </Box>
          )}
        </HStack>
      </Row>
    </>
  );
};

const TokenImagesFragment = graphql`
  fragment levaPluginTokenImage_TokenImagesFragment on Query
  @argumentDefinitions(
    count: { type: "Int", defaultValue: 20 }
    cursor: { type: "String" }
  )
  @refetchable(queryName: "levaPluginTokenImage_MoreTokenImagesQuery") {
    tokenImages(first: $count, after: $cursor)
      @connection(key: "levaPluginTokenImage_tokenImages", filters: []) {
      __id
      edges {
        node {
          id
          title
          url
        }
      }
    }
  }
`;

const TokenImagesQuery = graphql`
  query levaPluginTokenImage_TokenImagesQuery($count: Int) {
    ...levaPluginTokenImage_TokenImagesFragment @arguments(count: $count)
  }
`;

const TokenImageList = (props: {
  data: levaPluginTokenImage_TokenImagesFragment$key;
  onSelect: (tokenImageId: string) => void;
  onSelectFile: (file: File, connection: string) => void;
}) => {
  const { data } = usePagination(TokenImagesFragment, props.data);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = React.useState("");

  return (
    <>
      <PopoverHeader>Select Token Image</PopoverHeader>
      <PopoverCloseButton />
      <PopoverBody>
        <Box height="200px" overflowY="scroll">
          <SimpleGrid columns={4} spacing={2}>
            {data.tokenImages?.edges.map((edge) => (
              <Center key={edge.node.id}>
                <VStack
                  as="button"
                  spacing={0}
                  onClick={() => props.onSelect(edge.node.id)}
                >
                  <Image
                    borderRadius="full"
                    boxSize="50px"
                    src={edge.node.url}
                    alt={edge.node.title}
                  />
                  <Text fontSize="xs" noOfLines={1}>
                    {edge.node.title}
                  </Text>
                </VStack>
              </Center>
            ))}
          </SimpleGrid>
        </Box>
      </PopoverBody>
      <PopoverFooter>
        <HStack alignItems="center" justifyContent="flex-end" spacing={1}>
          <Box marginRight="auto" marginLeft={0}>
            <InputGroup size="xs">
              <InputLeftElement
                pointerEvents="none"
                children={<ChakraIcon.Filter color="gray.300" />}
              />
              <Input
                variant="flushed"
                placeholder="Filter"
                value={filter}
                onChange={(ev) => {
                  setFilter(ev.target.value);
                }}
              />
              <InputRightElement width="1rem">
                {filter !== "" ? (
                  <Button
                    size="xs"
                    onClick={() => setFilter("")}
                    variant="unstyled"
                  >
                    <ChakraIcon.X color="black" />
                  </Button>
                ) : null}
              </InputRightElement>
            </InputGroup>
          </Box>
          <input
            style={{ display: "none" }}
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(ev) => {
              if (!ev.target.files) {
                return;
              }
              props.onSelectFile(ev.target.files[0]!, data.tokenImages?.__id!);
            }}
          />
          <Button
            size="xs"
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            Upload new Image
          </Button>
        </HStack>
      </PopoverFooter>
    </>
  );
};

const TokenImagePopoverContent = (props: {
  onSelect: (tokenImageId: string) => void;
  onSelectFile: (file: File, connection: string) => void;
}) => {
  const query = useQuery<levaPluginTokenImage_TokenImagesQuery>(
    TokenImagesQuery
  );

  // TODO: implement filter
  // TODO: fetch more!

  return query.data ? (
    <TokenImageList
      data={query.data}
      onSelect={props.onSelect}
      onSelectFile={props.onSelectFile}
    />
  ) : null;
};

export const levaPluginTokenImage = createPlugin({
  normalize,
  sanitize,
  component: TokenImageReference,
});
