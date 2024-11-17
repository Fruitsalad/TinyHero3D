import {Node3D, SceneTree3D} from "./3D.ts";
import {vec3, vec4} from "../math/vec.ts";
import {
  EnvironmentUniforms,
  GL,
  SceneTree,
  UniformTypeAndValueTuple
} from "../graphics/graphics.ts";
import {Matrix3, Matrix4} from "../math/matrix.ts";


// Scene data

export class Light3DExtension {
  pointLights: PointLight3D[] = [];
  spotLights: SpotLight3D[] = [];
  directionalLights: DirectionalLight3D[] = [];

  private constructor() {}

  static init(tree: SceneTree3D) {
    console.assert(
      tree.extensions.light3D === undefined,
      "Light3DExtension.init was called on a scene tree that already had " +
      "Light3DExtension-related data. You should only call `init` once per " +
      "scene tree."
    );
    const lights = new Light3DExtension();
    tree.extensions.light3D = lights;
    tree.beforeDrawing.push(() => lights.updateUniforms(tree.uniforms));
  }

  static get(tree: SceneTree): Light3DExtension {
    return tree.extensions.light3D as Light3DExtension;
  }

  static isInitialized(tree: SceneTree): boolean {
    return tree.extensions.light3D !== undefined;
  }

  updateUniforms(uniforms: EnvironmentUniforms) {
    // Directional lights
    // Note that these uniforms are arrays of structs, so on the Javascript side
    // we pass in an array of objects.
    const directionalLights = this.directionalLights.map(light => {
      const tf = light.globalTransform;
      const direction = tf.transform(vec4(0,0,-1,0)).normalized().xyz;
      const color = light.color.mult(light.intensity);
      return {
        direction: [GL.FLOAT_VEC3, direction] as UniformTypeAndValueTuple,
        color: [GL.FLOAT_VEC3, color] as UniformTypeAndValueTuple
      }
    });
    uniforms.set("directionalLights", directionalLights);

    // Point lights
    const pointLights = this.pointLights.map(light => {
      const tf = light.globalTransform;
      const position = Matrix4.getTranslation(tf);
      const color = light.color.mult(light.intensity);
      // For the radius we're using ten times the average global scale.
      // (This way ten is the default radius, which is fairly sensible)
      const scale = Matrix3.deriveScale3D(tf);
      const radius = (scale.x + scale.y + scale.z) * 10 / 3;
      return {
        position: [GL.FLOAT_VEC3, position] as UniformTypeAndValueTuple,
        color: [GL.FLOAT_VEC3, color] as UniformTypeAndValueTuple,
        radius: [GL.FLOAT, radius] as UniformTypeAndValueTuple
      }
    });
    uniforms.set("pointLights", pointLights);
  }
}


// Light3D

export class Light3D extends Node3D {
  public intensity = 1;
  public color = vec3(1);

  _setTree(tree: SceneTree|null) {
    // Remove the light from the old scene.
    if (this.tree)
      this._unhook(Light3DExtension.get(this.tree));

    super._setTree(tree);

    // Add the light to the new scene.
    if (this.tree) {
      console.assert(
        Light3DExtension.isInitialized(this.tree),
        "A Light3D was added to a scene tree that did not yet have " +
        "Light3DExtension data! Call Light3DExtension.init before adding " +
        "lights."
      );
      this._hook(Light3DExtension.get(this.tree));
    }
  }

  _hook(lights: Light3DExtension) {}
  _unhook(lights: Light3DExtension) {}
}


// Light types

export class PointLight3D extends Light3D {
  // All of the editable properties are in Light3D and Node3D.

  _hook(lights: Light3DExtension) {
    lights.pointLights.push(this);
  }
  _unhook(lights: Light3DExtension) {
    const index = lights.pointLights.findIndex(light => light === this)!;
    lights.pointLights.splice(index, 1);
  }
}

export class SpotLight3D extends Light3D {
  _hook(lights: Light3DExtension) {
    lights.spotLights.push(this);
  }
  _unhook(lights: Light3DExtension) {
    const index = lights.spotLights.findIndex(light => light === this)!;
    lights.spotLights.splice(index, 1);
  }
}

export class DirectionalLight3D extends Light3D {
  _hook(lights: Light3DExtension) {
    lights.directionalLights.push(this);
  }
  _unhook(lights: Light3DExtension) {
    const index = lights.directionalLights.findIndex(light => light === this)!;
    lights.directionalLights.splice(index, 1);
  }
}
