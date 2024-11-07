import {} from "../../lib/render_engine.es";
import {
  bindMachine,
  Drawable,
  InstanceUniforms,
  Matrix3, Matrix4,
  Model,
  Node
} from "../../src";

const GL = WebGLRenderingContext;


export class Node3D extends Node {
  _transform: Matrix4;
  _globalTransform: Matrix4;

  public constructor(name?: string) {
    super(name);
    this._transform = Matrix4.identity;
    this._globalTransform = Matrix4.identity;
  }

  public set transform(newValue: Matrix4) {
    this._transform = newValue;
    this.afterTransformChanged();
  }

  public getTransformReadOnly(): Matrix4 {
    return this._transform;
  }

  public getGlobalTransformReadOnly(): Matrix4 {
    return this._globalTransform;
  }

  public afterTransformChanged() {
    // Update the global transform.
    this._globalTransform = this._transform;

    for (let parent = this.parent; !!parent; parent = parent.parent) {
      if (parent instanceof Node3D) {
        this._globalTransform = parent._globalTransform.mult(this._transform);
        break;
      }
    }

    // Let this node's children update their global transform.
    for (const child of this.children)
      if (child instanceof Node3D)
        child.afterTransformChanged();
  }
}

export class ModelNode3D extends Node3D implements Drawable {
  public model: Model|null = null;
  public uniforms: InstanceUniforms;

  public constructor(name?: string) {
    super(name);
    this.uniforms = new InstanceUniforms();
  }

  public static from(model: Model, name?: string): ModelNode3D {
    const result = new ModelNode3D(name);
    result.model = model;
    return result;
  }

  public draw() {
    this.uniforms.set("localToGlobal", GL.FLOAT_MAT4, this._globalTransform);
    bindMachine.setInstanceUniforms(this.uniforms);
    this.model?.draw();
  }
}

export class Camera3D extends Node3D {
  public projection: Matrix4;  // Camera local space to OpenGL's NDC space
  TODO
}
