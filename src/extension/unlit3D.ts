import {Material, Shader} from "../graphics/graphics.ts";
import {registerShaderType, setFallbackMaterial} from "./btoc/btoc_mesh.ts";
import {vec3} from "../math/vec.ts";

// Shader exports (Note that you need to call initUnlit3D first!)
export let unlitFlatColorShader: Shader;
export let unlitVertexColorShader: Shader;
export let unlitTexturedShader: Shader;

// Unlit flat color
const flatColorVertexSource = `
attribute vec3 position;
attribute vec3 color;
uniform mat4 local_to_clip;
varying vec3 vertex_color;

void main() {
  vertex_color = color;
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const flatColorFragmentSource = `
precision highp float;
uniform vec3 color;

void main() {
  gl_FragColor = vec4(color, 1);
}
`;

// Unlit vertex color
const vertexColorVertexSource = `
attribute vec3 position;
attribute vec3 color;
uniform mat4 local_to_clip;
varying vec3 vertex_color;

void main() {
  vertex_color = color;
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const vertexColorFragmentSource = `
precision highp float;
uniform vec3 color;

void main() {
  gl_FragColor = vec4(color, 1);
}
`;

// Unlit textured
const texturedVertexSource = `
attribute vec3 position;
attribute vec2 texcoord;
uniform mat4 local_to_clip;
varying vec2 _texcoord;

void main() {
  _texcoord = texcoord;
  gl_Position = local_to_clip * vec4(position, 1.0);
}
`;
const texturedFragmentSource = `
precision highp float;
varying vec2 _texcoord;
uniform sampler2D color_texture;

void main() {
  vec3 sample = texture2D(color_texture, _texcoord).rgb;
  gl_FragColor = vec4(sample, 1);
}
`;

export function initUnlit3D() {
  unlitTexturedShader =
    new Shader(texturedVertexSource, texturedFragmentSource);
  unlitFlatColorShader =
    new Shader(flatColorVertexSource, flatColorFragmentSource);
  unlitVertexColorShader =
    new Shader(vertexColorVertexSource, vertexColorFragmentSource);

  const PURPLE = vec3(0.47, 0.28, 0.64);
  setFallbackMaterial(Material.from(unlitFlatColorShader, ["color", PURPLE]));
  registerShaderType("unlit", args => {
    if (args.has("color_texture"))
      return Material.from(unlitTexturedShader, ...args);
    if (args.has("color"))
      return Material.from(unlitFlatColorShader, ...args);
    return Material.from(unlitVertexColorShader, ...args);
  });
}


