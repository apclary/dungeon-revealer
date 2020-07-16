import * as React from "react";
import { Canvas, useLoader, useUpdate, useFrame } from "react-three-fiber";
import { Line } from "drei";
import * as THREE from "three";
import { getOptimalDimensions } from "./util";
import { TextureLoader, Vector3 } from "three";
import { animated, useSpring, SpringValue } from "@react-spring/three";
import { useGesture } from "react-use-gesture";
import { darken, lighten } from "polished";
import { useStaticRef } from "./hooks/use-static-ref";
import { buildUrl } from "./public-url";
import { useUniqueId } from "./hooks/use-unique-id";
import uniqueId from "lodash/uniqueId";

// convert image relative to three.js
const calculateX = (x: number, factor: number, dimensionsWidth: number) =>
  x * factor - dimensionsWidth / 2;

const calculateY = (y: number, factor: number, dimensionsHeight: number) =>
  -y * factor + dimensionsHeight / 2;

// convert three.js to image relative
const calculateRealX = (x: number, factor: number, dimensionsWidth: number) =>
  (x + dimensionsWidth / 2) / factor;

const calculateRealY = (y: number, factor: number, dimensionsHeight: number) =>
  ((y - dimensionsHeight / 2) / factor) * -1;

type Viewport = { height: number; width: number; factor: number };

type Dimensions = { width: number; height: number; ratio: number };

type Token = {
  id: string;
  radius: number;
  color: string;
  label: string;
  x: number;
  y: number;
  isVisibleForPlayers: boolean;
};

type MarkedArea = {
  id: string;
  x: number;
  y: number;
};

type Grid = {
  x: number;
  y: number;
  sideLength: number;
  color: string;
};

const Plane: React.FC<{
  position: SpringValue<[number, number, number]>;
  scale: SpringValue<[number, number, number]>;
}> = (props) => {
  return (
    <animated.group {...props}>
      <mesh>
        <planeBufferGeometry attach="geometry" args={[10000, 10000]} />
        <meshPhongMaterial attach="material" color="black" />
      </mesh>
      {props.children}
    </animated.group>
  );
};

const TokenRenderer: React.FC<{
  x: number;
  y: number;
  color: string;
  radius: number;
  textLabel: string;
  viewport: Viewport;
  dimensions: Dimensions;
  factor: number;
  updateTokenPosition: ({ x, y }: { x: number; y: number }) => void;
  mapScale: SpringValue<[number, number, number]>;
  hoveredElementRef: React.MutableRefObject<null | unknown>;
}> = (props) => {
  const initialRadius = useStaticRef(() => props.radius * props.factor);
  const id = useUniqueId();
  const font = useLoader(THREE.FontLoader, buildUrl("/fonts/roboto-bold.json"));

  const [isHover, setIsHover] = React.useState(false);

  const [animatedProps, set] = useSpring(() => ({
    position: [
      calculateX(props.x, props.factor, props.dimensions.width),
      calculateY(props.y, props.factor, props.dimensions.height),
      0,
    ] as [number, number, number],
    circleScale: [1, 1, 1] as [number, number, number],
  }));

  React.useEffect(() => {
    const newRadius = props.factor * props.radius;
    set({
      position: [
        calculateX(props.x, props.factor, props.dimensions.width),
        calculateY(props.y, props.factor, props.dimensions.height),
        0,
      ],
      circleScale: [newRadius / initialRadius, newRadius / initialRadius, 1],
    });
  }, [props.x, props.y, props.radius, props.factor, set, props.dimensions]);

  const isDraggingRef = React.useRef(false);

  const dragProps = useGesture({
    onDrag: ({ movement, last, memo = animatedProps.position.get() }) => {
      isDraggingRef.current = true;

      const mapScale = props.mapScale.get();
      const newX = memo[0] + movement[0] / props.viewport.factor / mapScale[0];
      const newY = memo[1] - movement[1] / props.viewport.factor / mapScale[1];

      set({
        position: [newX, newY, 0],
        immediate: true,
      });

      if (last) {
        props.updateTokenPosition({
          x: calculateRealX(newX, props.factor, props.dimensions.width),
          y: calculateRealY(newY, props.factor, props.dimensions.height),
        });
        isDraggingRef.current = false;
      }

      return memo;
    },
    onPointerDown: (event) => {
      setIsHover(true);
      event.stopPropagation();
    },
    onPointerOver: () => {
      setIsHover(true);
      props.hoveredElementRef.current = id;
    },
    onPointerUp: () => {
      // TODO: only on tablet
      setIsHover(false);
      props.hoveredElementRef.current = null;
    },
    onPointerOut: () => {
      if (isDraggingRef.current === false) {
        setIsHover(false);
        props.hoveredElementRef.current = null;
      }
    },
    onClick: () => {
      setIsHover(false);
      props.hoveredElementRef.current = null;
    },
  });

  const meshRef = useUpdate<THREE.Mesh>((self) => {
    const size = new THREE.Vector3();
    self.geometry.computeBoundingBox();
    self.geometry.boundingBox?.getSize(size);
    self.position.x = -size.x / 2;
    self.position.y = -size.y / 2;
  }, []);

  const color = isHover ? lighten(0.1, props.color) : props.color;

  return (
    <animated.group
      renderOrder={1}
      position={animatedProps.position}
      scale={animatedProps.circleScale}
      {...dragProps()}
    >
      <mesh>
        <circleBufferGeometry attach="geometry" args={[initialRadius, 128]} />
        <meshStandardMaterial
          attach="material"
          color={color}
          transparent={true}
        />
      </mesh>
      <mesh>
        <ringBufferGeometry
          attach="geometry"
          args={[initialRadius * (1 - 0.05), initialRadius, 128]}
        />
        <meshStandardMaterial
          attach="material"
          color={darken(0.1, color)}
          transparent={true}
        />
      </mesh>
      <mesh ref={meshRef}>
        <textBufferGeometry
          attach="geometry"
          args={[
            props.textLabel,
            {
              font,
              size: 0.8 * initialRadius,
              height: 0,
            },
          ]}
        />
        <meshBasicMaterial attach="material" color="black" transparent={true} />
      </mesh>
    </animated.group>
  );
};

const MarkedAreaRenderer: React.FC<{
  x: number;
  y: number;
  factor: number;
  dimensions: Dimensions;
}> = (props) => {
  const initialRadius = 10 * props.factor;

  const spring = useSpring({
    from: {
      scale: [1, 1, 1] as [number, number, number],
      opacity: 1,
    },
    to: {
      scale: [10, 10, 10] as [number, number, number],
      opacity: 0,
    },
    config: {
      duration: 1250,
    },
  });

  return (
    <animated.mesh
      scale={spring.scale}
      position={[
        calculateX(props.x, props.factor, props.dimensions.width),
        calculateY(props.y, props.factor, props.dimensions.height),
        0,
      ]}
    >
      <ringBufferGeometry
        attach="geometry"
        args={[initialRadius * (1 - 0.1), initialRadius, 128]}
      />
      <animated.meshStandardMaterial
        attach="material"
        color={"red"}
        transparent={true}
        opacity={spring.opacity}
      />
    </animated.mesh>
  );
};

const reduceOffsetToMinimum = (offset: number, sideLength: number): number => {
  const newOffset = offset - sideLength;
  if (newOffset > 0) return reduceOffsetToMinimum(newOffset, sideLength);
  return offset;
};

const GridRenderer: React.FC<{
  x: number;
  y: number;
  sideLength: number;
  color: string;
  dimensions: Dimensions;
  factor: number;
  imageHeight: number;
  imageWidth: number;
}> = (props) => {
  const lines = React.useMemo(() => {
    const lines: React.ReactNodeArray = [];

    // vertical lines
    for (
      let currentY = reduceOffsetToMinimum(props.y, props.sideLength);
      currentY <= props.imageHeight;
      currentY = currentY + props.sideLength
    ) {
      lines.push(
        <Line
          key={uniqueId()}
          linewidth={0.5}
          color={props.color}
          points={[
            [
              -props.dimensions.width / 2,
              calculateY(currentY, props.factor, props.dimensions.height),
              0,
            ],
            [
              props.dimensions.width / 2,
              calculateY(currentY, props.factor, props.dimensions.height),
              0,
            ],
          ]}
        />
      );
    }
    for (
      let currentX = reduceOffsetToMinimum(props.x, props.sideLength);
      currentX <= props.imageWidth;
      currentX = currentX + props.sideLength
    ) {
      lines.push(
        <Line
          key={uniqueId()}
          linewidth={0.5}
          color={props.color}
          points={[
            [
              calculateX(currentX, props.factor, props.dimensions.width),
              -props.dimensions.height / 2,
              0,
            ],
            [
              calculateX(currentX, props.factor, props.dimensions.width),
              props.dimensions.height / 2,
              0,
            ],
          ]}
        />
      );
    }

    return lines;
  }, [props.x, props.y, props.sideLength, props.factor, props.dimensions]);

  return <React.Fragment>{lines}</React.Fragment>;
};

const MapRenderer: React.FC<{
  mapImageTexture: THREE.Texture;
  fogTexture: THREE.Texture;
  viewport: Viewport;
  tokens: Token[];
  markedAreas: MarkedArea[];
  grid: Grid | null;
  scale: SpringValue<[number, number, number]>;
  updateTokenPosition: (id: string, position: { x: number; y: number }) => void;
  hoveredElementRef: React.MutableRefObject<null | unknown>;
  mapTextureNeedsUpdateRef: React.MutableRefObject<boolean>;
  factor: number;
  dimensions: Dimensions;
}> = (props) => {
  return (
    <>
      <group renderOrder={0}>
        <mesh>
          <planeBufferGeometry
            attach="geometry"
            args={[props.dimensions.width, props.dimensions.height]}
          />
          <meshStandardMaterial attach="material" map={props.mapImageTexture} />
        </mesh>
        <mesh>
          <planeBufferGeometry
            attach="geometry"
            args={[props.dimensions.width, props.dimensions.height]}
          />
          <meshBasicMaterial
            attach="material"
            map={props.fogTexture}
            transparent={true}
          />
        </mesh>
        {props.grid ? (
          <GridRenderer
            x={props.grid.x}
            y={props.grid.y}
            sideLength={props.grid.sideLength}
            color={props.grid.color}
            dimensions={props.dimensions}
            factor={props.factor}
            imageHeight={props.mapImageTexture.image.naturalHeight}
            imageWidth={props.mapImageTexture.image.naturalWidth}
          />
        ) : null}
      </group>
      {props.tokens
        .filter((token) => token.isVisibleForPlayers)
        .map((token) => (
          <TokenRenderer
            key={token.id}
            x={token.x}
            y={token.y}
            color={token.color}
            textLabel={token.label}
            factor={props.factor}
            radius={token.radius}
            dimensions={props.dimensions}
            viewport={props.viewport}
            updateTokenPosition={(position) =>
              props.updateTokenPosition(token.id, position)
            }
            mapScale={props.scale}
            hoveredElementRef={props.hoveredElementRef}
          />
        ))}
      {props.markedAreas.map((markedArea) => (
        <MarkedAreaRenderer
          key={markedArea.id}
          x={markedArea.x}
          y={markedArea.y}
          factor={props.factor}
          dimensions={props.dimensions}
        />
      ))}
    </>
  );
};

const calculateScreenPosition = ({
  imageDimensions: { width, height },
  viewportDimensions,
  scale,
  translateX,
  translateY,
  aspect,
}: {
  imageDimensions: { width: number; height: number };
  viewportDimensions: { width: number; height: number };
  scale: number;
  translateX: number;
  translateY: number;
  aspect: number;
}) => {
  const imageWidth = width * scale * aspect;
  const imageHeight = height * scale * aspect;
  const imageTopLeftX =
    translateX * aspect + viewportDimensions.width / 2 - imageWidth / 2;
  const imageTopLeftY =
    viewportDimensions.height / 2 - translateY * aspect - imageHeight / 2;
  return { imageWidth, imageHeight, imageTopLeftY, imageTopLeftX };
};

const getTranslateOffsetsFromScale = ({
  imageTopLeftY,
  imageTopLeftX,
  imageWidth,
  imageHeight,
  scale,
  pinchDelta,
  touchOrigin: [touchOriginX, touchOriginY],
  currentTranslate: [translateX, translateY],
  aspect,
}: {
  imageTopLeftY: number;
  imageTopLeftX: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
  pinchDelta: number;
  touchOrigin: [number, number];
  currentTranslate: [number, number];
  aspect: number;
}) => {
  // Get the (x,y) touch position relative to image origin at the current scale
  const imageCoordX = (touchOriginX - imageTopLeftX - imageWidth / 2) / scale;
  const imageCoordY = (touchOriginY - imageTopLeftY - imageHeight / 2) / scale;
  // Calculate translateX/Y offset at the next scale to zoom to touch position
  const newTranslateX =
    (-imageCoordX * pinchDelta + translateX * aspect) / aspect;
  const newTranslateY =
    (imageCoordY * pinchDelta + translateY * aspect) / aspect;

  return [newTranslateX, newTranslateY];
};

type ControlInterface = {
  center: () => void;
};

export const MapView: React.FC<{
  mapImageUrl: string;
  fogCanvas: HTMLCanvasElement;
  tokens: Token[];
  controlRef?: React.MutableRefObject<ControlInterface>;
  updateTokenPosition: (id: string, props: { x: number; y: number }) => void;
  markedAreas: MarkedArea[];
  markArea: (coordinates: { x: number; y: number }) => void;
  grid: Grid | null;
  mapTextureNeedsUpdateRef: React.MutableRefObject<boolean>;
}> = (props) => {
  const [viewport, setViewport] = React.useState<Viewport | null>(null);
  const hoveredElementRef = React.useRef(null);

  const [spring, set] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
  }));

  const mapImageTexture = useLoader(TextureLoader, props.mapImageUrl);
  const fogTexture = React.useMemo(() => new THREE.Texture(props.fogCanvas), [
    props.fogCanvas,
  ]);

  const dimensions = React.useMemo(() => {
    if (mapImageTexture.image instanceof HTMLImageElement && viewport) {
      const optimalDimensions = getOptimalDimensions(
        mapImageTexture.image.naturalWidth,
        mapImageTexture.image.naturalHeight,
        viewport.width * 0.95,
        viewport.height * 0.95
      );

      return optimalDimensions;
    }

    return null;
  }, [mapImageTexture, viewport]);

  React.useEffect(() => {
    const wheelHandler = (ev: WheelEvent) => {
      ev.preventDefault();
    };
    // without this the pinch-zoom on desktop (chrome osx) is interfered by wheel events
    document.addEventListener("wheel", wheelHandler, { passive: false });

    const gestureStartHandler = (ev: Event) => ev.preventDefault();
    const gestureChangeHandler = (ev: Event) => ev.preventDefault();

    return () => {
      document.removeEventListener("wheel", wheelHandler);
      document.removeEventListener("gesturestart", gestureStartHandler);
      document.removeEventListener("gesturestart", gestureChangeHandler);
    };
  }, []);

  React.useEffect(() => {
    if (props.controlRef) {
      props.controlRef.current = {
        center: () =>
          set({
            scale: [1, 1, 1] as [number, number, number],
            position: [0, 0, 0] as [number, number, number],
            immediate: true,
          }),
      };
    }
  });

  const isDragDisabledRef = React.useRef(false);
  const pointerTimer = React.useRef<NodeJS.Timeout>();

  const bind = useGesture(
    {
      onPointerDown: (state) => {
        if (pointerTimer.current) {
          clearTimeout(pointerTimer.current);
        }

        // TODO: figure out why the typing do not show our point
        // @ts-ignore
        const point = (state as any).point as Vector3;

        pointerTimer.current = setTimeout(() => {
          if (dimensions) {
            const factor =
              dimensions.width / mapImageTexture.image.naturalWidth;
            const x = calculateRealX(
              // We need to convert the point to the point local to our element.
              (point.x - spring.position.get()[0]) / spring.scale.get()[0],
              factor,
              dimensions.width
            );
            const y = calculateRealY(
              // We need to convert the point to the point local to our element.
              (point.y - spring.position.get()[1]) / spring.scale.get()[1],
              factor,
              dimensions.height
            );
            props.markArea({ x, y });
          }
        }, 200);
      },
      onPointerUp: () => {
        if (pointerTimer.current) {
          clearTimeout(pointerTimer.current);
        }
      },
      onPointerMove: () => {
        if (pointerTimer.current) {
          clearTimeout(pointerTimer.current);
        }
      },
      onDrag: ({
        movement: [xMovement, yMovement],
        memo = spring.position.get(),
        cancel,
      }) => {
        if (
          !viewport ||
          isDragDisabledRef.current === true ||
          hoveredElementRef.current !== null
        ) {
          cancel();
          return;
        }
        set({
          position: [
            memo[0] + xMovement / viewport.factor,
            memo[1] - yMovement / viewport.factor,
            0,
          ],
          immediate: true,
        });
        return memo;
      },
    },
    {}
  );

  useGesture(
    {
      onPinchEnd: () => {
        setTimeout(() => {
          isDragDisabledRef.current = false;
        }, 100);
      },
      onPinch: ({
        movement: [xMovement],
        event,
        origin,
        ctrlKey,
        last,
        cancel,
      }) => {
        if (!viewport || !event) {
          return;
        }
        isDragDisabledRef.current = true;

        const position = spring.position.get();
        const [scale] = spring.scale.get();
        let [touchOriginX, touchOriginY] = origin;

        // Don't calculate new translate offsets on final frame
        if (last) {
          cancel?.();
          return;
        }

        // Speed up pinch zoom when using mouse versus touch
        const SCALE_FACTOR = 100;
        const pinchScale = Math.max(scale + xMovement / SCALE_FACTOR, 0.1);
        const pinchDelta = pinchScale - scale;

        // // @ts-ignore
        // const { clientX, clientY } = event;

        const clientX =
          "clientX" in event ? event.clientX : event?.touches?.[0]?.clientX;
        const clientY =
          "clientX" in event ? event.clientY : event?.touches?.[0]?.clientY;

        if (clientX === undefined || clientY === undefined) {
          return;
        }

        const {
          imageWidth,
          imageHeight,
          imageTopLeftY,
          imageTopLeftX,
        } = calculateScreenPosition({
          imageDimensions: { width: 5, height: 7 },
          viewportDimensions: {
            width: viewport.width * viewport.factor,
            height: viewport.height * viewport.factor,
          },
          scale,
          translateX: position[0],
          translateY: position[1],
          aspect: viewport.factor,
        });

        // Calculate the amount of x, y translate offset needed to
        // zoom-in to point as image scale grows
        const [newTranslateX, newTranslateY] = getTranslateOffsetsFromScale({
          imageTopLeftY,
          imageTopLeftX,
          imageWidth,
          imageHeight,
          scale,
          aspect: viewport.factor,
          pinchDelta: pinchDelta,
          currentTranslate: [position[0], position[1]],
          // Use the [x, y] coords of mouse if a track-pad or ctrl + wheel event
          // Otherwise use touch origin
          touchOrigin: ctrlKey
            ? [clientX, clientY]
            : [touchOriginX, touchOriginY],
        });

        set({
          scale: [pinchScale, pinchScale, 1],
          position: [newTranslateX, newTranslateY, 0],
        });
      },
    },
    {
      domTarget: window.document,
    }
  );

  return (
    <div style={{ height: "100%", touchAction: "manipulation" }}>
      <Canvas
        camera={{ position: [0, 0, 5] }}
        onCreated={(props) => {
          setViewport({
            factor: props.viewport.factor,
            width: props.viewport.width,
            height: props.viewport.height,
          });
        }}
      >
        <UseTextureUpdater
          fogTexture={fogTexture}
          mapTextureNeedsUpdateRef={props.mapTextureNeedsUpdateRef}
        >
          <React.Suspense fallback={null}>
            <ambientLight intensity={1} />
            {dimensions && viewport ? (
              <Plane
                position={spring.position}
                scale={spring.scale}
                {...bind()}
              >
                <MapRenderer
                  mapImageTexture={mapImageTexture}
                  fogTexture={fogTexture}
                  viewport={viewport}
                  tokens={props.tokens}
                  markedAreas={props.markedAreas}
                  grid={props.grid}
                  updateTokenPosition={props.updateTokenPosition}
                  scale={spring.scale}
                  hoveredElementRef={hoveredElementRef}
                  mapTextureNeedsUpdateRef={props.mapTextureNeedsUpdateRef}
                  dimensions={dimensions}
                  factor={dimensions.width / mapImageTexture.image.naturalWidth}
                />
              </Plane>
            ) : null}
          </React.Suspense>
        </UseTextureUpdater>
      </Canvas>
    </div>
  );
};

const UseTextureUpdater: React.FC<{
  fogTexture: THREE.Texture;
  mapTextureNeedsUpdateRef: React.MutableRefObject<boolean>;
}> = (props) => {
  useFrame(() => {
    if (props.mapTextureNeedsUpdateRef.current) {
      props.fogTexture.needsUpdate = true;
      props.mapTextureNeedsUpdateRef.current = false;
    }
  });
  return <React.Fragment>{props.children}</React.Fragment>;
};
