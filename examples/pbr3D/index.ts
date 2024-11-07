import {
  EnvironmentUniforms,
  initGraphics, Material, Mesh, Model,
  setResizeCallback, Shader, vec3
} from "../../index";
import {Camera3D, ModelNode3D, Node3D, SceneTree3D} from "./3D";


const vertex_source = `

`;
const fragment_source = `

`;



const GL = WebGLRenderingContext;
const targetFramerate = 30;
let tree = new SceneTree3D();
let cube: ModelNode3D;

initGraphics($("canvas") as HTMLCanvasElement);
initScene();
frame();


function $(cssQuery: string): Element|null {
  return document.body.querySelector(cssQuery);
}

function initScene() {
  const cube_mesh = Mesh.from(24,
    ["position", GL.FLOAT_VEC3, [
      1,0,1, 1,1,1, 0,1,1, 0,0,1,  // North face
      1,0,0, 1,0,1, 1,1,1, 1,1,0,  // East face
      0,0,0, 0,1,0, 1,1,0, 1,0,0,  // South face
      0,0,1, 0,1,1, 0,1,0, 0,0,0,  // West face
      0,1,0, 0,1,1, 1,1,1, 1,1,0,  // Top face
      0,0,1, 0,0,0, 1,0,0, 1,0,1   // Bottom face
    ]],
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
    ]],
    ["indices", GL.UNSIGNED_SHORT, [
      0,1,2, 0,2,3,
      4,5,6, 4,6,7,
      8,9,10, 8,10,11,
      12,13,14, 12,14,15,
      16,17,18, 16,18,19,
      20,21,22, 20,22,23
    ]]
  );
  const shader = new Shader(vertex_source, fragment_source);
  const material = Material.from(shader);
  const cube_model = new Model(cube_mesh, material);
  cube = ModelNode3D.from(cube_model, "cube");

  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 5);

  tree.root.addChild(cube);
  tree.root.addChild(camera);
}

function draw() {
  const milliseconds = performance.now();
  const time = milliseconds/1000;
  cube.eulerAngles = vec3(time, time/2.5, time/3.3);
  tree.draw();
}

function frame() {
  draw();
  setTimeout(() => requestAnimationFrame(frame), 1000/targetFramerate)
}
