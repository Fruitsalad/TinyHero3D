import {
  GL, initGraphics, aspectRatio, setResizeCallback,
  finishDrawing, startDrawing, vec3,
  Mesh, Submesh, Geometry, Material, SceneTree3D, MeshNode3D, Camera3D
} from "render_engine/src/bundles/unlit3D";
import {
  initPhong3D,
  phongFlatColorShader
} from "../../src/extension/phong3D.ts";
import {
  DirectionalLight3D,
  Light3DExtension
} from "../../src/extension/light3D.ts";



const targetFramerate = 30;
let tree = new SceneTree3D();
let cube: MeshNode3D;
let cube2: MeshNode3D;
let cube3: MeshNode3D;
let cube4: MeshNode3D;

main();


function main() {
  // Initialize.
  console.log("Starting initialization...");
  const canvas = document.body.querySelector("canvas")! as HTMLCanvasElement;
  initGraphics(canvas);
  Light3DExtension.init(tree);
  initPhong3D();

  // Update the scene tree's aspect ratio when the canvas is resized.
  tree.setAspectRatio(aspectRatio);
  setResizeCallback(() => tree.setAspectRatio(aspectRatio));

  // Set up the scene.
  console.log("Setting up the scene...");
  initScene();

  // Start drawing!
  console.log("Starting rendering...");
  loop();
}

function initScene() {
  // Create a cube mesh. In this example I provide the vertex data by hand.
  const i = 0.5;
  const o = -0.5;
  const cubeGeometry = Geometry.from_indexed(24,
    [
      0,1,2, 0,2,3,
      4,5,6, 4,6,7,
      8,9,10, 8,10,11,
      12,13,14, 12,14,15,
      16,17,18, 16,18,19,
      20,21,22, 20,22,23
    ],
    ["position", GL.FLOAT_VEC3, [
      i,o,i, i,i,i, o,i,i, o,o,i,  // North face
      i,o,o, i,o,i, i,i,i, i,i,o,  // East face
      o,o,o, o,i,o, i,i,o, i,o,o,  // South face
      o,o,i, o,i,i, o,i,o, o,o,o,  // West face
      o,i,o, o,i,i, i,i,i, i,i,o,  // Top face
      o,o,i, o,o,o, i,o,o, i,o,i   // Bottom face
    ]],
    // It's worth noting that the unlit shader does not actually use normals or
    // texture coordinates, but I already put them here. No point in removing it
    ["normal", GL.FLOAT_VEC3, [
      0,0,1,    0,0,1,    0,0,1,    0,0,1,    // North face
      1,0,0,    1,0,0,    1,0,0,    1,0,0,    // East face
      0,0,-1,   0,0,-1,   0,0,-1,   0,0,-1,   // South face
      -1,0,0,   -1,0,0,   -1,0,0,   -1,0,0,   // West face
      0,1,0,    0,1,0,    0,1,0,    0,1,0,    // Top face
      0,-1,0,   0,-1,0,   0,-1,0,   0,-1,0,   // Bottom face
    ]],
    ["uv", GL.FLOAT_VEC2, [
      0,0, 0,1, 1,1, 1,0,  // North face
      0,0, 0,1, 1,1, 1,0,  // East face
      0,0, 0,1, 1,1, 1,0,  // South face
      0,0, 0,1, 1,1, 1,0,  // West face
      0,0, 0,1, 1,1, 1,0,  // Top face
      0,0, 0,1, 1,1, 1,0,  // Bottom face
    ]]
  );

  const material = Material.from(phongFlatColorShader, ["color", [.8,.3,.3]]);
  const cubeMesh = new Mesh([new Submesh(cubeGeometry, material)]);

  // Use the mesh to add some cubes to the scene.
  cube = MeshNode3D.from(cubeMesh, "cube");
  tree.root.addChild(cube);

  cube2 = MeshNode3D.from(cubeMesh, "cube2");
  cube2.eulerAngles = vec3(0, -Math.PI/4, Math.PI/4);
  cube2.position = vec3(2, 0, -3);
  cube2.scale = vec3(1.1);
  tree.root.addChild(cube2);

  cube3 = MeshNode3D.from(cubeMesh, "cube3");
  cube3.position = vec3(1);
  cube3.scale = vec3(0.3);
  cube.addChild(cube3);

  cube4 = MeshNode3D.from(cubeMesh, "cube4");
  cube3.addChild(cube4);

  const light = new DirectionalLight3D();
  cube4.addChild(light);

  // Lastly add a camera to the scene.
  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  tree.root.addChild(camera);
}

function loop() {
  // Keep running `draw()` at the requested framerate.
  draw();
  setTimeout(() => requestAnimationFrame(loop), 1000/targetFramerate)
}

function draw() {
  // Rotate the cubes each frame.
  const milliseconds = performance.now();
  const time = milliseconds/1000;
  const t = Math.sin(time)*0.5 + 0.5;

  cube.eulerAngles = vec3(time/2, time/5, time/9);
  cube.scale = vec3(0.8 + (1-t)*0.2);

  const newRotation = cube2.eulerAngles;
  newRotation.y = time/2;
  cube2.scale = vec3(0.5 + t*0.5);
  cube2.eulerAngles = newRotation;
  cube2.position = vec3(t*5 - 2.5, 0.5, -3);

  cube3.eulerAngles = vec3(time/8, time/7, time/6);
  cube4.globalPosition = vec3(-2.5, 0, 0);

  // Draw!
  startDrawing();
  tree.draw();
  finishDrawing();
}