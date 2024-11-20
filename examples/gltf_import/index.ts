import {
  initGraphics, setResizeCallback, aspectRatio, vec3,
  initUnlit3D, unlitTexturedShader, unlitFlatColorShader,
  startDrawing, finishDrawing, loadGltfRoot, loadMainScene, loadTexture,
  SceneTree3D, Node3D, Camera3D, Material,
} from "render_engine";
import * as GLTF from "@gltf-transform/core";
import {KHRMaterialsUnlit} from "@gltf-transform/extensions";



const TARGET_FRAMERATE = 30;
let tree = new SceneTree3D();
let cameraController: Node3D;
let defaultMaterial: Material;

await main();


async function main() {
  // Initialize.
  console.log("Starting initialization...");
  const canvas = document.body.querySelector("canvas")! as HTMLCanvasElement;
  initGraphics(canvas);
  initUnlit3D();

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
  // Create a default material, used for unsupported/unset GLTF materials.
  const PURPLE = vec3(0.47, 0.28, 0.64);
  defaultMaterial = Material.from(unlitFlatColorShader, ["color", PURPLE]);

  // Load the 3D model and add it to the scene tree.
  // It's important to note that you need to provide your own `loadMaterial`
  // function!
  const gltf = await loadGltfRoot("./shiba/scene.gltf", [KHRMaterialsUnlit]);
  const scene = await loadMainScene(gltf, { loadMaterial });
  tree.root.addChild(scene);

  // Create a camera that orbits the model.
  cameraController = new Node3D("camera controller");
  tree.root.addChild(cameraController);
  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  cameraController.addChild(camera);
}

// This function takes material data from the GLTF file and gives back the best
// available material for this rendering engine.
async function loadMaterial(material: GLTF.Material|null): Promise<Material> {
  if (material === null)
    return defaultMaterial;

  const unlit = material.getExtension(KHRMaterialsUnlit.EXTENSION_NAME);
  if (unlit) {
    const texture = await loadTexture(material.getBaseColorTexture()!);
    return Material.from(unlitTexturedShader, ["color_texture", texture]);
  }

  return defaultMaterial;
}

function loop() {
  // Keep running `draw()` at the requested framerate.
  draw();
  setTimeout(() => requestAnimationFrame(loop), 1000/TARGET_FRAMERATE)
}

function draw() {
  // Rotate the camera each frame.
  const time = performance.now()/1000;
  const t = Math.sin(time) * 0.5 + 0.5;
  cameraController.eulerAngles = vec3(-0.6*t, time/2, 0);

  // Draw!
  startDrawing();
  tree.draw();
  finishDrawing();
}
