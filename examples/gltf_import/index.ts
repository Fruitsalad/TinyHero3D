import {
  gl, initGraphics, Material, Geometry, Submesh, Mesh, Shader, vec3,
  Camera3D, MeshNode3D, SceneTree3D, Matrix4, aspectRatio, setResizeCallback,
  loadGltfRoot, loadSpecificMesh, Node3D
} from "render_engine/src/bundles/full";
import * as GLTF from "@gltf-transform/core";


const vertexSource = `
attribute vec3 position;
// attribute vec3 normal;
// attribute vec2 texcoord;

uniform mat4 local_to_clip;

// varying vec2 _uv;
// varying vec3 _normal;

void main() {
  // _uv = texcoord;
  // _normal = normal;
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const fragmentSource = `
precision highp float;

// varying vec2 _uv;
// varying vec3 _normal;

void main() {
  // float ndotl = max(dot(_normal, vec3(1,0,0)), 0.0);
  // vec3 dark_color = vec3(0.3, 0.1, 0.1);
  // vec3 bright_color = vec3(1, 0.4, 0.4);
  // vec3 color = dark_color + ndotl * (bright_color-dark_color);
  // gl_FragColor = vec4(color, 1);
  gl_FragColor = vec4(1);
}
`;



const GL = WebGLRenderingContext;
const targetFramerate = 30;
let tree = new SceneTree3D();
let camera_controller;

initGraphics($("canvas") as HTMLCanvasElement);
tree.setAspectRatio(aspectRatio);
setResizeCallback(() => tree.setAspectRatio(aspectRatio));

const defaultShader = new Shader(vertexSource, fragmentSource);
const defaultMaterial = Material.from(defaultShader);

(async () => {
  await initScene();
  frame();
})();


function $(cssQuery: string): Element {
  return document.body.querySelector(cssQuery)!;
}

async function initScene() {
  camera_controller = new Node3D("camera controller");
  tree.root.addChild(camera_controller);

  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  // camera.eulerAngles = vec3(0, 0, 0);
  camera_controller.addChild(camera);

  const gltf = await loadGltfRoot("./shiba/scene.gltf");
  const node = createMeshNodeForModel(gltf, "Group18985_default_0");
  tree.root.addChild(node);

  const node2 = createMeshNodeForModel(gltf, "Box002_default_0");
  // node2.scale = vec3(0.1);
  node2.position = vec3(2, 0, 0);
  tree.root.addChild(node2);

  // const node3 = MeshNode3D.from(mesh, name);
  // node3.position = vec3(-2, 0, 0);
  // tree.root.addChild(node3);

  // const meshes = gltfScene.findAll(node => node instanceof MeshNode3D);
  // meshes[0].remove();


}

function createMeshNodeForModel(root: GLTF.Root, name: string) {
  const mesh = loadSpecificMesh(root, name, { loadMaterial });
  return MeshNode3D.from(mesh, name);
}

function loadMaterial(material: GLTF.Material|null): Material {
  return defaultMaterial;
}

function draw() {
  const time = performance.now()/1000;
  // camera_controller.eulerAngles = vec3(time/2, time/5, time/9);

  gl.clearColor(1, 0, 0, 1);
  gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
  tree.draw();
  gl.flush();
}

function frame() {
  draw();
  setTimeout(() => requestAnimationFrame(frame), 1000/targetFramerate)
}
