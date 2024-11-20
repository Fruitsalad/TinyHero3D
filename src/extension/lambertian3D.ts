import {
  addDefaultUniformSources,
  Material,
  Shader,
  UniformSource
} from "../graphics/graphics.ts";
import {registerShaderType, setFallbackMaterial} from "./btoc/btoc_mesh.ts";
import {vec3} from "../math/vec.ts";

// Shader exports (Note that you need to call initPhong3D first!)
export let phongFlatColorShader: Shader;
export let phongTexturedShader: Shader;


// Initializing

export function initPhong3D(
  pointLightsMax: number = 4,
  spotLightsMax: number = 4,
  directionalLightsMax: number = 1
) {
  // Flat color
  phongFlatColorShader = createPhongSurfaceShader(
    "void surface() {}",
    `
    uniform vec3 color;
    void surface() { SURFACE_COLOR = color; }
    `, pointLightsMax, spotLightsMax, directionalLightsMax
  );
  phongTexturedShader = createPhongSurfaceShader(`
    attribute vec2 texcoord;
    varying vec2 _texcoord;
    void surface() { _texcoord = texcoord; }
    `, `
    varying vec2 _texcoord;
    uniform sampler2D color_texture;
    void surface() { SURFACE_COLOR = texture2D(color_texture, _texcoord).rgb; }
    `, pointLightsMax, spotLightsMax, directionalLightsMax
  );

  // TODO!!! TEMPORARY
  const PURPLE = vec3(0.47, 0.28, 0.64);
  setFallbackMaterial(Material.from(phongFlatColorShader, ["color", PURPLE]));
  registerShaderType("unlit", args => {
    if (args.has("color_texture"))
      return Material.from(phongTexturedShader, ...args);
    return Material.from(phongFlatColorShader, ...args);
  });

  // Add the default sources
  // (unfortunately I don't have nicer syntax for this yet)
  for (let i = 0; i < pointLightsMax; i++) {
    addDefaultUniformSources(
      [`pointLights[${i}].position`, UniformSource.ENVIRONMENT],
      [`pointLights[${i}].radius`, UniformSource.ENVIRONMENT],
      [`pointLights[${i}].color`, UniformSource.ENVIRONMENT]
    );
  }
  for (let i = 0; i < spotLightsMax; i++) {
    addDefaultUniformSources(
      [`spotLights[${i}].position`, UniformSource.ENVIRONMENT],
      [`spotLights[${i}].direction`, UniformSource.ENVIRONMENT],
      [`spotLights[${i}].radius`, UniformSource.ENVIRONMENT],
      [`spotLights[${i}].color`, UniformSource.ENVIRONMENT]
    );
  }
  for (let i = 0; i < directionalLightsMax; i++) {
    addDefaultUniformSources(
      [`directionalLights[${i}].direction`, UniformSource.ENVIRONMENT],
      [`directionalLights[${i}].color`, UniformSource.ENVIRONMENT]
    );
  }
}


// Surface shaders

function createPhongSurfaceShader(
  vertexSurfaceShader: string,
  fragmentSurfaceShader: string,
  pointLightsMax: number = 4,
  spotLightsMax: number = 4,
  directionalLightsMax: number = 1
) {
  // struct PointLight {
  //   vec3 position;
  //   vec3 color;
  //   float radius;
  // }

  const vertexSource = `
    attribute vec3 position;
    attribute vec3 normal;
    uniform mat4 local_to_global;
    uniform mat4 local_to_clip;
    varying vec3 _position;
    varying vec3 _normal;
    
    ${vertexSurfaceShader}
    
    void main() {
      _normal = normalize((local_to_global * vec4(normal, 0.0)).xyz);
      _position = (local_to_global * vec4(position, 1.0)).xyz;
      gl_Position = local_to_clip * vec4(position, 1.0);
      surface();
    }
    `;
  const fragmentSource = `
    precision highp float;
    
    struct DirectionalLight {
      vec3 direction;
      vec3 color;
    };
    
    uniform DirectionalLight directionalLights[${directionalLightsMax}];
    varying vec3 _position;
    varying vec3 _normal;
    
    vec3 SURFACE_COLOR;  // This should be set by the surface shader.
    
    ${fragmentSurfaceShader}
    
    void main() {
      vec3 color = vec3(0);
      surface();
      
      for (int i = 0; i < ${directionalLightsMax}; i++) {
        float lightness = dot(_normal, -directionalLights[i].direction);
        color += SURFACE_COLOR * lightness;
      }
      
      gl_FragColor = vec4(color, 1);
    }
    `;

  return new Shader(vertexSource, fragmentSource);
}
