import {
  addDefaultUniformSources, Material, Shader, UniformSource
} from "./core.ts";
import {registerShaderType, setFallbackMaterial} from "./btoc/btoc_mesh.ts";
import {vec3} from "../math/vec.ts";

// Shader exports (Note that you need to call initLambertian3D first!)
export let lambertianFlatColorShader: Shader;
export let lambertianTexturedShader: Shader;


// Initializing

export function initLambertian3D(
  pointLightsMax: number = 4,
  directionalLightsMax: number = 1
) {
  // Flat color
  lambertianFlatColorShader = createLambertianSurfaceShader(
    "void surface() {}",
    `
    uniform vec3 color;
    void surface() { SURFACE_COLOR = color; }
    `, pointLightsMax, directionalLightsMax
  );
  lambertianTexturedShader = createLambertianSurfaceShader(`
    attribute vec2 texcoord;
    varying vec2 _texcoord;
    void surface() { _texcoord = texcoord; }
    `, `
    varying vec2 _texcoord;
    uniform sampler2D color_texture;
    void surface() { SURFACE_COLOR = texture2D(color_texture, _texcoord).rgb; }
    `, pointLightsMax, directionalLightsMax
  );

  const PURPLE = vec3(0.47, 0.28, 0.64);
  setFallbackMaterial(Material.from(lambertianFlatColorShader, ["color", PURPLE]));
  registerShaderType("lit", args => {
    if (args.has("color_texture"))
      return Material.from(lambertianTexturedShader, ...args);
    return Material.from(lambertianFlatColorShader, ...args);
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
  for (let i = 0; i < directionalLightsMax; i++) {
    addDefaultUniformSources(
      [`directionalLights[${i}].direction`, UniformSource.ENVIRONMENT],
      [`directionalLights[${i}].color`, UniformSource.ENVIRONMENT]
    );
  }
}


// Surface shaders

function createLambertianSurfaceShader(
  vertexSurfaceShader: string,
  fragmentSurfaceShader: string,
  pointLightsMax: number = 4,
  directionalLightsMax: number = 1,
  supportNonUniformScaling = false  // This matters for surface normals
) {
  const vertexSource = `
    attribute vec3 position;
    attribute vec3 normal;
    uniform mat4 local_to_global;
    ${supportNonUniformScaling ? "uniform mat3 normal_local_to_global;" : ""}
    
    uniform mat4 local_to_clip;
    varying vec3 _position;
    varying vec3 _normal;
    
    ${vertexSurfaceShader}
    
    void main() {
      gl_Position = local_to_clip * vec4(position, 1.0);
      _position = (local_to_global * vec4(position, 1.0)).xyz;
      ` +
      (supportNonUniformScaling ?
       "_normal = normalize(normal_local_to_global * normal);" :
       "_normal = normalize((local_to_global * vec4(normal, 0.0)).xyz);")
      + `
      surface();
    }
    `;
  const fragmentSource = `
    precision highp float;
    
    struct DirectionalLight {
      vec3 direction;
      vec3 color;
    };
    struct PointLight {
      vec3 position;
      vec3 color;
      float radius;
    };
    
    uniform DirectionalLight directionalLights[${directionalLightsMax}];
    uniform PointLight pointLights[${pointLightsMax}];
    
    varying vec3 _position;  // In world space
    varying vec3 _normal;
    
    vec3 SURFACE_COLOR;  // This should be set by the surface shader.
    
    ${fragmentSurfaceShader}
    
    void main() {
      vec3 color = vec3(0);
      surface();
      
      for (int i = 0; i < ${directionalLightsMax}; i++) {
        float lightness = dot(_normal, -directionalLights[i].direction);
        vec3 c = SURFACE_COLOR * lightness * directionalLights[i].color;
        color += clamp(c, vec3(0), vec3(1));
      }
      for (int i = 0; i < ${pointLightsMax}; i++) {
        vec3 difference = pointLights[i].position - _position;
        vec3 direction = normalize(difference);
        float distance = length(difference);
        float attenuation = smoothstep(pointLights[i].radius, 0.0, distance);
        float lightness = dot(_normal, direction);
        vec3 c = SURFACE_COLOR * lightness * attenuation * pointLights[i].color;
        color += clamp(c, vec3(0), vec3(1));
      }
      
      gl_FragColor = vec4(color, 1);
    }
    `;

  return new Shader(vertexSource, fragmentSource);
}
