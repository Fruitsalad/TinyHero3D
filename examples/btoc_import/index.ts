import {
  aspectRatio, vec3, initGraphics, setResizeCallback, initUnlitShaders,
  startDrawing, finishDrawing, BtocMeshReader, SceneTree3D, Node3D, Camera3D
} from "render_engine";


const TARGET_FRAMERATE = 30;
let tree = new SceneTree3D();
let cameraController: Node3D;

await main();


async function main() {
  // Initialize.
  const canvas = document.body.querySelector("canvas")! as HTMLCanvasElement;
  initGraphics(canvas);
  initUnlitShaders();

  // Update the scene tree's aspect ratio when the canvas is resized.
  tree.setAspectRatio(aspectRatio);
  setResizeCallback(() => tree.setAspectRatio(aspectRatio));

  // Set up the scene and start drawing!
  await initScene();
  loop();
}

async function initScene() {
  // Load the 3D model and add it to the scene tree.
  const scene = await BtocMeshReader.loadSceneFromURL("./scene.mesh");
  tree.root.addChild(scene);

  // Create a camera that orbits the model.
  cameraController = new Node3D("camera controller");
  tree.root.addChild(cameraController);
  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  cameraController.addChild(camera);
}

function loop() {
  // Keep running `draw()` at the requested framerate.
  draw();
  setTimeout(() => requestAnimationFrame(loop), 1000/TARGET_FRAMERATE)
}

function draw() {
  // Rotate the camera.
  const time = performance.now()/1000;
  const t = Math.sin(time) * 0.5 + 0.5;
  cameraController.eulerAngles = vec3(t * 0.6, time/2, 0);

  // Draw the scene.
  startDrawing();
  tree.draw();
  finishDrawing();
}
