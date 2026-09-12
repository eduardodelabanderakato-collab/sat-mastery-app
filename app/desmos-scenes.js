// The Desmos walkthroughs, defined once.
//
// A scene is a sequence of frames: what the screen looks like after step one,
// after step two, and so on. tools/desmos-shots.html draws each frame and
// saves it as <scene>-<n>.png; the app shows the frame beside the step that
// produces it, and places its callouts using the same bounds the picture was
// drawn with, so a label can never drift off the point it names.
//
// An expression appears from its `at` frame onward, so frame n is every
// expression with at <= n. No text labels are set here: the callouts are HTML
// over the image, which stays sharp at any size.

const BLUE = "#1b36de";
const ORANGE = "#eb6834";
const GREEN = "#0a7f3f";
const GREY = "#6b7186";

export const SCENES = [
  {
    name: "solve-equation",
    bounds: { left: -2, right: 9, bottom: -6, top: 20 },
    frames: 3,
    expressions: [
      { id: "l", latex: "y=2\\left(x+3\\right)", color: BLUE, at: 1 },
      { id: "r", latex: "y=5x-9", color: ORANGE, at: 2 },
      { id: "p", latex: "\\left(5,16\\right)", color: GREEN, pointSize: 20, at: 3 },
    ],
  },
  {
    name: "system",
    bounds: { left: -3, right: 8, bottom: -3, top: 7 },
    frames: 3,
    expressions: [
      { id: "a", latex: "2x+3y=12", color: BLUE, at: 1 },
      { id: "b", latex: "x-y=1", color: ORANGE, at: 2 },
      { id: "p", latex: "\\left(3,2\\right)", color: GREEN, pointSize: 20, at: 3 },
    ],
  },
  {
    name: "quadratic",
    bounds: { left: -1, right: 6, bottom: -2.5, top: 7 },
    frames: 3,
    expressions: [
      { id: "q", latex: "y=x^{2}-5x+6", color: BLUE, at: 1 },
      { id: "r1", latex: "\\left(2,0\\right)", color: GREEN, pointSize: 18, at: 2 },
      { id: "r2", latex: "\\left(3,0\\right)", color: GREEN, pointSize: 18, at: 2 },
      { id: "v", latex: "\\left(2.5,-0.25\\right)", color: ORANGE, pointSize: 18, at: 3 },
    ],
  },
  {
    name: "inequality",
    bounds: { left: -3, right: 7, bottom: -4, top: 7 },
    frames: 3,
    expressions: [
      { id: "a", latex: "y<-2x+4", color: BLUE, at: 1 },
      { id: "b", latex: "y\\ge x-1", color: ORANGE, at: 2 },
      { id: "p", latex: "\\left(0.6,-0.2\\right)", color: GREEN, pointSize: 20, at: 3 },
    ],
  },
  {
    name: "scatter",
    bounds: { left: -1, right: 11, bottom: -1, top: 24 },
    frames: 3,
    expressions: [
      {
        id: "t",
        type: "table",
        at: 1,
        columns: [
          { latex: "x_1", values: ["1", "2", "3", "4", "5", "6", "7", "8"] },
          { latex: "y_1", values: ["3", "5", "8", "9", "12", "14", "16", "19"], color: BLUE, pointSize: 15 },
        ],
      },
      { id: "f", latex: "y_1\\sim mx_1+b", color: ORANGE, at: 2 },
      { id: "p", latex: "\\left(10,23.6\\right)", color: GREEN, pointSize: 20, at: 3 },
    ],
  },
  {
    name: "circle",
    bounds: { left: -4, right: 10, bottom: -9, top: 5 },
    frames: 3,
    expressions: [
      { id: "c", latex: "\\left(x-3\\right)^{2}+\\left(y+2\\right)^{2}=25", color: BLUE, at: 1 },
      { id: "p", latex: "\\left(3,-2\\right)", color: ORANGE, pointSize: 18, at: 2 },
      { id: "r", latex: "\\left(\\left(3,-2\\right),\\left(8,-2\\right)\\right)", color: GREEN, lines: true, points: false, lineWidth: 5, at: 3 },
    ],
  },
  {
    name: "exponential",
    bounds: { left: -0.5, right: 4, bottom: -10, top: 95 },
    frames: 3,
    expressions: [
      { id: "e", latex: "y=86\\left(0.2\\right)^{x}", color: BLUE, at: 1 },
      { id: "v", latex: "x=2", color: GREY, lineStyle: "DASHED", at: 2 },
      { id: "p", latex: "\\left(2,3.44\\right)", color: GREEN, pointSize: 20, at: 3 },
    ],
  },
  {
    name: "equivalent",
    bounds: { left: -5, right: 4, bottom: -8, top: 6 },
    frames: 2,
    expressions: [
      { id: "a", latex: "y=\\left(x+3\\right)\\left(x-2\\right)", color: BLUE, lineWidth: 10, at: 1 },
      { id: "b", latex: "y=x^{2}+x-6", color: ORANGE, lineWidth: 3.5, at: 2 },
    ],
  },
];

export const SCENE_BOUNDS = Object.fromEntries(SCENES.map((scene) => [scene.name, scene.bounds]));
export const SCENE_FRAMES = Object.fromEntries(SCENES.map((scene) => [scene.name, scene.frames]));

// Every frame that has to exist on disk, in capture order.
export function everyFrame() {
  return SCENES.flatMap((scene) =>
    Array.from({ length: scene.frames }, (_, i) => ({ scene: scene.name, frame: i + 1, file: `${scene.name}-${i + 1}.png` }))
  );
}

// The expressions visible in one frame of a scene.
export function frameExpressions(sceneName, frame) {
  const scene = SCENES.find((s) => s.name === sceneName);
  if (!scene) return [];
  return scene.expressions
    .filter((expression) => expression.at <= frame)
    .map(({ at, ...rest }) => rest);
}

// Where a graph point sits in the picture, as percentages, so a callout can be
// placed over it without anyone measuring pixels by eye.
export function pointToPercent(sceneName, [x, y]) {
  const bounds = SCENE_BOUNDS[sceneName];
  if (!bounds) return null;
  return {
    left: (100 * (x - bounds.left)) / (bounds.right - bounds.left),
    top: (100 * (bounds.top - y)) / (bounds.top - bounds.bottom),
  };
}
