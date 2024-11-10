import {
  gl, initGraphics, Material, Geometry, Submesh, Mesh, Shader, vec3,
  Camera3D, MeshNode3D, SceneTree3D, Matrix4, aspectRatio, setResizeCallback
} from "render_engine";


const vertexSource = `
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
const fragmentSource = `
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
let cube2;
let cube3;

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
  const shader = new Shader(vertexSource, fragmentSource);
  const material = Material.from(shader);
  const cubeMesh = new Mesh([new Submesh(cubeGeometry, material)]);

  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  tree.root.addChild(camera);

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
}

function draw() {
  const milliseconds = performance.now();
  const time = milliseconds/1000;
  const t = Math.sin(time)*0.5 + 0.5;
  cube.eulerAngles = vec3(time/2, time/5, time/9);
  cube.scale = vec3(0.8 + (1-t)*0.2);
  const old = cube2.eulerAngles;
  old.y = time/2;
  cube2.scale = vec3(0.5 + t*0.5);
  cube2.eulerAngles = old;
  cube2.position = vec3(t*5 - 2.5, 0.5, -3);
  cube3.eulerAngles = vec3(time/8, time/7, time/6);

  gl.clearColor(1, 0, 0, 1);
  gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
  tree.draw();
  gl.flush();
}

function frame() {
  draw();
  setTimeout(() => requestAnimationFrame(frame), 1000/targetFramerate)
}
