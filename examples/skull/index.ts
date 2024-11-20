import {
  aspectRatio, vec3, vec4, initGraphics, setResizeCallback, initLambertian3D,
  startDrawing, finishDrawing, setBackgroundColor,
  BtocMeshReader, SceneTree3D, Node3D, Camera3D,
  DirectionalLight3D, Light3DExtension
} from "render_engine";
import {PointLight3D} from "../../src/modules/light3D";


const TARGET_FRAMERATE = 30;
let tree = new SceneTree3D();
let cameraController: Node3D;
let orangeLight: PointLight3D;
let purpleLight: PointLight3D;

await main();


async function main() {
  // Initialize.
  console.log("Starting initialization...");
  const canvas = document.body.querySelector("canvas")! as HTMLCanvasElement;
  initGraphics(canvas);
  Light3DExtension.init(tree);
  initLambertian3D();

  // Update the scene tree's aspect ratio when the canvas is resized.
  tree.setAspectRatio(aspectRatio);
  setResizeCallback(() => tree.setAspectRatio(aspectRatio));

  // Set up the scene.
  console.log("Setting up the scene...");
  await initScene();

  // Start drawing!
  console.log("Starting rendering...");
  loop();
}

async function initScene() {
  setBackgroundColor(vec4(.2, .1, .15, 1));

  // Load the 3D model and add it to the scene tree.
  const scene = await BtocMeshReader.loadSceneFromURL("./skull.mesh");
  tree.root.addChild(scene);

  // Lighting
  const directionalLight = new DirectionalLight3D();
  directionalLight.eulerAngles = vec3(0.4, 1.2, 0.1);
  tree.root.addChild(directionalLight);

  orangeLight = new PointLight3D();
  orangeLight.color = vec3(0.8, 0.4, 0.4);
  tree.root.addChild(orangeLight);

  purpleLight = new PointLight3D();
  purpleLight.color = vec3(0.47, 0.28, 0.64);
  tree.root.addChild(purpleLight);

  // Create a camera that orbits the model.
  cameraController = new Node3D("camera controller");
  cameraController.position = vec3(0);
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
  const wiggle = Math.sin(time) * 0.5 + 0.5;
  cameraController.eulerAngles = vec3(-0.5*wiggle, time/2, 0);

  // Move the lights around.
  orangeLight.position = vec3(wiggle, 0, 1-wiggle);
  purpleLight.position = vec3(Math.sin(time*2)*2, 0, Math.cos(time*2)*2);

  // Draw the scene.
  startDrawing();
  tree.draw();
  finishDrawing();
}
