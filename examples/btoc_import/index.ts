import {
  gl, aspectRatio, initGraphics, setResizeCallback, vec3,
  Material, Shader, IntoUniform, BtocMeshReader, SceneTree3D, Node3D, Camera3D
} from "render_engine/src/bundles/full";


const coloredVertexSource = `
attribute vec3 position;
uniform mat4 local_to_clip;

void main() {
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const coloredFragmentSource = `
precision highp float;
uniform vec3 color;

void main() {
  gl_FragColor = vec4(color, 1);
}
`;

const unlitVertexSource = `
attribute vec3 position;
attribute vec2 texcoord;
uniform mat4 local_to_clip;
varying vec2 _texcoord;

void main() {
  _texcoord = texcoord;
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const unlitFragmentSource = `
precision highp float;
varying vec2 _texcoord;
uniform sampler2D tex;

void main() {
  vec3 sample = texture2D(tex, _texcoord).rgb;
  gl_FragColor = vec4(sample, 1);
}
`;



const GL = WebGLRenderingContext;
const targetFramerate = 30;
let tree = new SceneTree3D();
let cameraController: Node3D;

initGraphics($("canvas") as HTMLCanvasElement);
tree.setAspectRatio(aspectRatio);
setResizeCallback(() => tree.setAspectRatio(aspectRatio));

const PURPLE = vec3(0.47, 0.28, 0.64);
const coloredShader = new Shader(coloredVertexSource, coloredFragmentSource);
const unlitShader = new Shader(unlitVertexSource, unlitFragmentSource);
const defaultMaterial = Material.from(coloredShader, ["color", PURPLE]);

(async () => {
  await initScene();
  frame();
})();


function $(cssQuery: string): Element {
  return document.body.querySelector(cssQuery)!;
}

async function initScene() {
  cameraController = new Node3D("camera controller");
  tree.root.addChild(cameraController);

  const camera = Camera3D.Perspective();
  camera.position = vec3(0, 0, 3);
  cameraController.addChild(camera);


  const scene =
    await BtocMeshReader.loadSceneFromURL("./scene.mesh", loadMaterial);
  tree.root.addChild(scene);
}

async function loadMaterial(
  shaderName: string,
  uniforms: Map<string, IntoUniform>
): Promise<Material> {
  if (shaderName === "unlit") {
    const tex = uniforms.get("color_texture")!;
    return Material.from(unlitShader, ["tex", tex]);
  }

  return defaultMaterial;
}

function draw() {
  const time = performance.now()/1000;
  const t = Math.sin(time) * 0.5 + 0.5;
  cameraController.eulerAngles = vec3(t * 0.6, time/2, 0);

  gl.clearColor(1, 0, 0, 1);
  gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
  tree.draw();
  gl.flush();
}

function frame() {
  draw();
  setTimeout(() => requestAnimationFrame(frame), 1000/targetFramerate)
}
