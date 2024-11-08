import {
  gl, initGraphics, Material, Mesh, Model, Shader, vec3,
  Camera3D, ModelNode3D, SceneTree3D, Matrix4, aspectRatio, setResizeCallback
} from "../../lib/full/full.es.js";


const vertex_source = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 local_to_clip;

varying vec2 _uv;
varying vec3 _normal;

void main() {
  _uv = uv;
  _normal = normal;
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const fragment_source = `
precision highp float;

varying vec2 _uv;
varying vec3 _normal;

void main() {
  float ndotl = max(dot(_normal, vec3(1,0,0)), 0.0);
  vec3 dark_color = vec3(0.3, 0.1, 0.1);
  vec3 bright_color = vec3(1, 0.4, 0.4);
  vec3 color = dark_color + ndotl * (bright_color-dark_color);
  gl_FragColor = vec4(color, 1);
}
`;



const GL = WebGLRenderingContext;
const targetFramerate = 30;
let tree = new SceneTree3D();
let cube;

initGraphics($("canvas"));
tree.setAspectRatio(aspectRatio);
setResizeCallback(() => tree.setAspectRatio(aspectRatio));
initScene();
frame();


function $(cssQuery) {
  return document.body.querySelector(cssQuery);
}

function initScene() {
  const i = 0.5;
  const o = -0.5;
  const cube_mesh = Mesh.from(24,
    ["position", GL.FLOAT_VEC3, [
      i,o,i, i,i,i, o,i,i, o,o,i,  // North face
      i,o,o, i,o,i, i,i,i, i,i,o,  // East face
      o,o,o, o,i,o, i,i,o, i,o,o,  // South face
      o,o,i, o,i,i, o,i,o, o,o,o,  // West face
      o,i,o, o,i,i, i,i,i, i,i,o,  // Top face
      o,o,i, o,o,o, i,o,o, i,o,i   // Bottom face
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
  tree.root.addChild(cube);

  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  tree.root.addChild(camera);
}

function draw() {
  const milliseconds = performance.now();
  const time = milliseconds/1000;
  cube.eulerAngles = vec3(time, time/2.5, time/3.3);
  gl.clearColor(1, 0, 0, 1);
  gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
  tree.draw();
  gl.flush();
}

function frame() {
  draw();
  setTimeout(() => requestAnimationFrame(frame), 1000/targetFramerate)
}
