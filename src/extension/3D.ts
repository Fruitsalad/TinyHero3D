import {
  bindMachine,
  Drawable,
  EnvironmentUniforms,
  InstanceUniforms,
  Submesh,
  Node,
  SceneTree,
  addDefaultUniformSources,
  UniformSource, Mesh
} from "../graphics/graphics";
import {Matrix3, Matrix4} from "../math/matrix";
import {Vec3} from "../math/vec";

const GL = WebGLRenderingContext;


// SceneTree3D

export class SceneTree3D implements SceneTree, Drawable {
  public aspectRatio: number = 1;
  public uniforms: EnvironmentUniforms = new EnvironmentUniforms();
  public root: Node = new Node3D("root");

  public globalToCamera: Matrix4 = Matrix4.identity;
  public cameraToClip: Matrix4 = Matrix4.identity;
  public globalToClip: Matrix4 = Matrix4.identity;
  public camera3D?: Camera3D;


  public constructor() {
    this.root.tree = this;
    addDefaultUniformSources(
      ["local_to_global", UniformSource.INSTANCE],
      ["local_to_clip", UniformSource.INSTANCE],
      ["global_to_camera", UniformSource.ENVIRONMENT],
      ["camera_to_clip", UniformSource.ENVIRONMENT],
      ["global_to_clip", UniformSource.ENVIRONMENT]
    );
    this.uniforms.set("global_to_camera", GL.FLOAT_MAT4, this.globalToCamera);
    this.uniforms.set("camera_to_clip", GL.FLOAT_MAT4, this.cameraToClip);
    this.uniforms.set("global_to_clip", GL.FLOAT_MAT4, this.globalToClip);
  }

  public setCameraMatrices(globalToCamera: Matrix4, cameraToClip: Matrix4) {
    this.globalToCamera = globalToCamera;
    this.cameraToClip = cameraToClip;
    this.globalToClip = this.cameraToClip.mult(this.globalToCamera);
    this.uniforms.set("global_to_camera", GL.FLOAT_MAT4, this.globalToCamera);
    this.uniforms.set("camera_to_clip", GL.FLOAT_MAT4, this.cameraToClip);
    this.uniforms.set("global_to_clip", GL.FLOAT_MAT4, this.globalToClip);
  }

  public setAspectRatio(aspectRatio: number) {
    this.aspectRatio = aspectRatio;
    this.camera3D?.updateCameraUniforms();
  }

  public draw() {
    bindMachine.setEnvironment(this.uniforms);
    this.root.recursively(node => {  // @ts-expect-error
      if (typeof(node.draw) === "function")  // @ts-expect-error
        node.draw();
    });
  };
}


// Node3D

export class Node3D extends Node {
  _transform: Matrix4;
  _globalTransform: Matrix4;
  _cachedEuler: Vec3|null = null;
  _cachedScale: Vec3|null = null;

  public constructor(name?: string) {
    super(name);
    this._transform = Matrix4.identity.clone();
    this._globalTransform = Matrix4.identity.clone();
  }

  _setParent(node: Node) {
    super._setParent(node);
    this.afterTransformChanged();
  }


  // Position

  public get position() {
    return Matrix4.getTranslation(this._transform);
  }

  public set position(pos: Vec3) {
    Matrix4.setTranslation(this._transform, pos);
    this.afterTransformChanged();
  }

  public get globalPosition() {
    return Matrix4.getTranslation(this._globalTransform);
  }

  public set globalPosition(pos: Vec3) {
    const global = this._globalTransform.clone();
    Matrix4.setTranslation(global, pos);
    this.globalTransform = global;
  }


  // Rotation

  public get eulerAngles(): Vec3 {
    if (!this._cachedEuler)
      this._cachedEuler = Matrix3.deriveEulerAngles3D(this._transform);
    return this._cachedEuler;
  }

  public set eulerAngles(euler: Vec3) {
    this._cachedEuler = euler;
    this._setTransform(Matrix4.TRS3D(this.position, euler, this.scale));
  }

  public get globalEulerAngles(): Vec3 {
    return Matrix3.deriveEulerAngles3D(this._globalTransform);
  }

  public set globalEulerAngles(euler: Vec3) {
    const matrix = Matrix4.TRS3D(this.globalPosition, euler, this.globalScale);
    this._setGlobalTransform(matrix);
  }


  // Scale

  public get scale(): Vec3 {
    if (!this._cachedScale)
      this._cachedScale = Matrix3.deriveScale3D(this._transform);
    return this._cachedScale;
  }

  public set scale(scale: Vec3) {
    this._cachedScale = scale;
    this._setTransform(Matrix4.TRS3D(this.position, this.eulerAngles, scale));
  }

  public get globalScale(): Vec3 {
    return Matrix3.deriveScale3D(this._globalTransform);
  }

  public set globalScale(scale: Vec3) {
    const matrix =
      Matrix4.TRS3D(this.globalPosition, this.globalEulerAngles, scale);
    this._setGlobalTransform(matrix);
  }


  // Transform

  public get transform(): Matrix4 {
    return this._transform.clone();
  }

  public set transform(matrix: Matrix4) {
    this._cachedEuler = null;
    this._cachedScale = null;
    this._setTransform(matrix);
  }

  _setTransform(matrix: Matrix4) {
    this._transform = matrix;
    this.afterTransformChanged();
  }

  public get globalTransform(): Matrix4 {
    return this._globalTransform.clone();
  }

  public set globalTransform(matrix: Matrix4) {
    this._cachedEuler = null;
    this._cachedScale = null;
    this._setGlobalTransform(matrix);
  }

  _setGlobalTransform(matrix: Matrix4) {
    const parentTF =
      this.tryGetParentNode3D()?._globalTransform ?? Matrix4.identity;
    const inverseParentTF = Matrix4.getInverse3DTransform(parentTF);
    this.transform = inverseParentTF.mult(matrix);
  }

  public afterTransformChanged() {
    // Update the global transform.
    const parent = this.tryGetParentNode3D();
    this._globalTransform =
      (parent ? this._transform.mult(parent._globalTransform) : this._transform.clone());

    // Let this node's children update their global transform.
    for (const child of this.children)
      if (child instanceof Node3D)
        child.afterTransformChanged();
  }


  // Scene tree

  public tryGetParentNode3D(): Node3D|undefined {
    for (let node = this.parent; !!node; node = node.parent)
      if (node instanceof Node3D)
        return node;
    return undefined;
  }
}


// MeshNode3D

export class MeshNode3D extends Node3D implements Drawable {
  public mesh: Mesh|null = null;
  public uniforms: InstanceUniforms;

  public constructor(name?: string) {
    super(name);
    this.uniforms = new InstanceUniforms();
  }

  public static from(mesh: Mesh, name?: string): MeshNode3D {
    const result = new MeshNode3D(name);
    result.mesh = mesh;
    return result;
  }

  public draw() {
    if (!this.mesh)
      return;

    const tree = this.tree! as SceneTree3D;
    const localToGlobal = this._globalTransform;
    const localToClip = tree.globalToClip.mult(localToGlobal);
    this.uniforms.set("local_to_global", GL.FLOAT_MAT4, localToGlobal);
    this.uniforms.set("local_to_clip", GL.FLOAT_MAT4, localToClip);
    bindMachine.setInstanceUniforms(this.uniforms);
    this.mesh.draw();
  }
}


// Camera3D

interface PerspectiveOptions {
  fovY?: number,
  near?: number,
  far?: number
}
type CameraOptions = PerspectiveOptions;

export class Camera3D extends Node3D {
  public cameraToClip = Matrix4.identity;
  public isActive = true;
  public opts: CameraOptions|null = null;
  oldAspect: number = 1;
  getCameraToClip?: (aspect: number) => Matrix4;

  public static Perspective(opts?: PerspectiveOptions): Camera3D {
    const camera = new Camera3D("camera");
    camera.setPerspective(opts);
    return camera;
  }

  public setPerspective(opts?: PerspectiveOptions) {
    opts ??= {};
    opts.fovY ??= 70 * Math.PI/180;
    opts.near ??= 0.1;
    opts.far ??= 1000;
    this.opts = opts;
    this.setMatrix(
      a => Matrix4.PerspectiveProjection(opts.fovY!, a, opts.near!, opts.far!)
    );
  }

  public setMatrix(getCameraToClip: (aspect: number) => Matrix4) {
    const aspect = this.tree?.aspectRatio ?? 1;
    this.cameraToClip = getCameraToClip(aspect);
    this.getCameraToClip = getCameraToClip;
  }

  public setActive(isActive: boolean) {
    this.isActive = isActive;
    this.updateCameraUniforms();
  }

  public afterTransformChanged() {
    super.afterTransformChanged();
    this.updateCameraUniforms();
  }

  _setTree(tree: SceneTree | null) {
    super._setTree(tree);
    this.updateCameraUniforms();
  }

  public updateCameraUniforms() {
    if (!this.tree || !this.isActive || !this.getCameraToClip)
      return;

    // Update the projection if the screen's aspect ratio changed.
    if (this.tree.aspectRatio !== this.oldAspect) {
      this.cameraToClip = this.getCameraToClip?.(this.tree.aspectRatio);
      this.oldAspect = this.tree.aspectRatio;
    }

    // Set the uniforms.
    const tree = (this.tree as SceneTree3D);
    console.assert(typeof tree.setCameraMatrices === "function");
    const globalToCamera = Matrix4.getInverse3DTransform(this.globalTransform);
    tree.setCameraMatrices(globalToCamera, this.cameraToClip);
    tree.camera3D = this;  // Also store the camera.
  }
}
