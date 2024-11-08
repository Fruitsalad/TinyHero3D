import {Vec2, Vec3, Vec4} from "../math/vec";
import {Matrix, Matrix2, Matrix3, Matrix4} from "../math/matrix";
// @ts-expect-error  WebGL debug does not support Typescript, but it's fine.
import WebGLDebugUtils from "./external/webgl-debug";

const GL = WebGLRenderingContext;
export let gl: WebGLRenderingContext;
export let glVAO: OES_vertex_array_object;
export let canvas: HTMLCanvasElement;
export let canvasSize: Vec2 = new Vec2(1, 1);
export let aspectRatio: number = 1;
export let bindMachine: BindMachine;
export let defaultUniformSources = new Map<string, UniformSource>();
let afterResize: (() => void)|null = null;


// General

// Before initializing the scene.
export function initGraphics(
  newCanvas: HTMLCanvasElement, isDebug = false
) {
  canvas = newCanvas;

  // Get the context.
  const newGl = canvas.getContext("webgl");
  if (!newGl)
    throw new Error("WebGL is not supported :(");
  gl = newGl;  // This must be a separate step, to keep Typescript happy.

  // Inject some debug stuff.
  if (isDebug) {
    // @ts-expect-error  __IS_MINIFIED_BUILD__ is provided by Rollup's replacer
    if (__IS_MINIFIED_BUILD__) {
      console.warn(
        "WebGL debug features are not supported in a minified build!"
      );
    } else gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGlError);
  }

  // Configure some stuff.
  // console.log(gl.getSupportedExtensions());
  glVAO = gl.getExtension("OES_vertex_array_object")!;
  console.assert(
    !!glVAO,
    "Could not load the necessary GL extension OES_vertex_array_object. " +
    "This extension *should* be available on all browsers, but apparently it " +
    "isn't available on yours."
  );
  gl.frontFace(GL.CW);
  gl.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
  gl.enable(gl.DEPTH_TEST);

  // Create the bind machine.
  bindMachine = new BindMachine();

  // Ensure the canvas has the right size.
  refreshCanvasSize();
  new ResizeObserver(refreshCanvasSize).observe(canvas, {box: 'content-box'});
}

// Use this once your `draw` function is ready to be called.
export function setResizeCallback(afterResizeCallback: () => void) {
  afterResize = afterResizeCallback;
}

export function refreshCanvasSize() {
  canvasSize = new Vec2(canvas.offsetWidth, canvas.offsetHeight);
  canvas.width = canvasSize.x;
  canvas.height = canvasSize.y;
  gl.viewport(0, 0, canvasSize.x, canvasSize.y);
  aspectRatio = canvasSize.x / canvasSize.y;
  afterResize?.();
}

// @ts-expect-error  It's a Javascript callback, so I'm not bothering with types
function throwOnGlError(err, functionName, args) {
  // `args` is mysteriously not an array and has no `join`, so we turn it into
  // an array.
  const array = [];
  for (const value of args)
    array.push(value);

  const message = `${WebGLDebugUtils.glEnumToString(err)} ` +
    `in ${functionName}(${array.join(", ")})`;
  console.error(message);
  throw new Error(message);
}

// This turns vectors & matrices into simple arrays of FLOAT or INT.
// That's necessary for feeding uniforms into OpenGL. OpenGL will give you all
// sorts of types, but it only wants to receive FLOAT & INT.
export function getElemTypeAndCount(
  type: GLenum, size: number
): [GLenum, number] {
  const elementCount = getElementCountOfGlType(type);
  const isMiscSupportedType =
    (type === GL.UNSIGNED_INT
    || type === GL.UNSIGNED_SHORT
    || type === GL.UNSIGNED_BYTE
    || type === GL.SAMPLER_2D);
  const elemType =
    isSupportedFloatType(type) ? GL.FLOAT :
    isSupportedIntType(type) ? GL.INT :
    isMiscSupportedType ? type : undefined;
  if (elemType === undefined)
    throw new Error(`Type not supported: ${type}`);
  return [elemType, size*elementCount];
}

export function getElementCountOfGlType(type: GLenum) {
  switch (type) {
    case GL.FLOAT: case GL.INT: return 1;
    case GL.FLOAT_VEC2: case GL.INT_VEC2: return 2;
    case GL.FLOAT_VEC3: case GL.INT_VEC3: return 3;
    case GL.FLOAT_VEC4: case GL.INT_VEC4: case GL.FLOAT_MAT2: return 4;
    case GL.FLOAT_MAT3: return 9;
    case GL.FLOAT_MAT4: return 16;
    default: return 1;
  }
}

function isSupportedFloatType(type: GLenum): boolean {
  switch (type) {
    case GL.FLOAT: case GL.FLOAT_VEC2: case GL.FLOAT_VEC3: case GL.FLOAT_VEC4:
    case GL.FLOAT_MAT2: case GL.FLOAT_MAT3: case GL.FLOAT_MAT4:
      return true;
    default: return false;
  }
}

function isSupportedIntType(type: GLenum): boolean {
  switch (type) {
    case GL.INT: case GL.INT_VEC2: case GL.INT_VEC3: case GL.INT_VEC4:
      return true;
    default: return false;
  }
}


// GlType

interface GlType {
  type: GLenum;
  size: number;
  elemType: GLenum;  // The type of the values (INT, FLOAT or SAMPLER2D).
  elemCount: number;  // The amount of values in the type.
}

function GlType(type: GLenum, size = 1): GlType {
  const [elemType, elemCount] = getElemTypeAndCount(type, size);
  return { type, size, elemType, elemCount };
}


// Shaders

interface VertexAttribute {
  name: string,
  type: GlType,
  location: number
}

export class Shader {
  public program: WebGLProgram;
  public vertexAttributes: Map<string, VertexAttribute>;

  public constructor(
    vertexShader: string | WebGLShader,
    fragmentShader: string | WebGLShader
  ) {
    this.program = createProgram(vertexShader, fragmentShader);
    this.vertexAttributes = getVertexAttributes(this.program);
  }

  public bind() {
    gl.useProgram(this.program);
  }
}

export function compileShader(type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(shader, GL.COMPILE_STATUS);
  if (!success) {
    const errorLog = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const typeName = (type === GL.FRAGMENT_SHADER ? "fragment" : "vertex");
    throw new Error(
      `A ${typeName} shader failed to compile :(\n` +
      `Error log:\n${errorLog}`
    );
  }

  return shader;
}

export function createProgram(
  vertexShader: string | WebGLShader,
  fragmentShader: string | WebGLShader
): WebGLProgram {
  if (typeof(vertexShader) === "string")
    vertexShader = compileShader(GL.VERTEX_SHADER, vertexShader);
  if (typeof(fragmentShader) === "string")
    fragmentShader = compileShader(GL.FRAGMENT_SHADER, fragmentShader);

  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, GL.LINK_STATUS);
  if (!success) {
    const errorLog = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(
      `A program failed to link :(\n` +
      `Error log:\n${errorLog}`
    );
  }

  return program;
}

function getVertexAttributes(
  program: WebGLProgram
): Map<string, VertexAttribute> {
  const attribs = new Map<string, VertexAttribute>();
  const count = gl.getProgramParameter(program, GL.ACTIVE_ATTRIBUTES);

  for (let i = 0; i < count; i++) {
    const {name, type, size} = gl.getActiveAttrib(program, i)!;
    const location = gl.getAttribLocation(program, name);
    attribs.set(name, { name, location, type: GlType(type, size) });
  }

  return attribs;
}


// Buffers

/// Some data that can be turned into a buffer.
export interface IntoBufferObject {
  data: IntoBufferData;
  type: GlType,
  isNormalized?: boolean;
  isDynamic?: boolean;
  isIndices?: boolean;
}
export type IntoBufferTuple = [GLenum, IntoBufferData, boolean?];
type IntoBuffer = IntoBufferObject | IntoBufferTuple;
type IntoBufferData = BufferSource | number[];


export class VertexBuffer {
  public buffer: WebGLBuffer;
  public bufferType: GLenum;  // ELEMENT_ARRAY_BUFFER or ARRAY_BUFFER
  public type: GlType;
  public isNormalized: boolean;

  public constructor(
    buffer: WebGLBuffer,
    bufferType: GLenum,
    type: GlType,
    isNormalized: boolean
  ) {
    console.assert(
      bufferType !== GL.ARRAY_BUFFER ||
      type.elemType === GL.INT || type.elemType === GL.FLOAT,
      "Vertex buffers are only allowed to have `int` or `float` elements in " +
      "WebGL 1."
    );
    console.assert(
      bufferType !== GL.ELEMENT_ARRAY_BUFFER ||
      type.elemType === GL.UNSIGNED_SHORT,
      "Index buffers are only allowed to have the type `unsigned short` in " +
      "this rendering engine (WebGL also supports `byte` i.e. " +
      "`unsigned char`, but this rendering engine does not. Sorry!)"
    );
    this.buffer = buffer;
    this.bufferType = bufferType;
    this.type = type;
    this.isNormalized = isNormalized;
  }

  public static from(p: IntoBuffer): VertexBuffer {
    const opts = VertexBuffer.normalizeIntoBuffer(p);
    const data =
      VertexBuffer.normalizeIntoBufferSource(opts.data, opts.type.elemType);
    const usage = (opts.isDynamic ? GL.DYNAMIC_DRAW : GL.STATIC_DRAW);
    const btype = (opts.isIndices ? GL.ELEMENT_ARRAY_BUFFER : GL.ARRAY_BUFFER);
    const buffer = VertexBuffer.createBuffer(data, btype, usage);
    return new VertexBuffer(buffer, btype, opts.type, !!opts.isNormalized);
  }

  public static createBuffer(
    data: BufferSource, buffer_type: GLenum, usage: GLenum
  ): WebGLBuffer {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(buffer_type, buffer);
    gl.bufferData(buffer_type, data, usage);
    return buffer;
  }

  public static normalizeIntoBuffer(a: IntoBuffer): IntoBufferObject {
    if (Array.isArray(a))
      a = VertexBuffer.tupleToObject(a);
    return a;
  }

  public static normalizeIntoBufferSource(
    a: IntoBufferData, elemType: GLenum
  ): BufferSource {
    if (!Array.isArray(a))
      return a;
    switch (elemType) {
      case GL.FLOAT: return new Float32Array(a);
      case GL.INT: return new Int32Array(a);
      case GL.SHORT: return new Int16Array(a);
      case GL.BYTE: return new Int8Array(a);
      case GL.UNSIGNED_INT: return new Uint32Array(a);
      case GL.UNSIGNED_SHORT: return new Uint16Array(a);
      case GL.UNSIGNED_BYTE: return new Uint8Array(a);
      default:
        throw new Error(`Type not supported for vertex buffer: ${elemType}`);
    }
  }

  public static tupleToObject(data: IntoBufferTuple): IntoBufferObject {
    const [type, bufferData, isIndices] = data;
    const size = 1;
    return {
      type: GlType(type, size),
      data: bufferData,
      isNormalized: false,
      isDynamic: false,
      isIndices: isIndices ?? false
    };
  }
}


// Textures

export class Texture {
  public texture: WebGLTexture;

  public constructor(texture: WebGLTexture) {
    this.texture = texture;
  }

  public static async fromBitmap(bitmap: ImageBitmap): Promise<Texture> {
    // We need to flip the bitmap because OpenGL and the HTML/JS spec disagree
    // about whether the first byte is the bottom-left or the top-left corner.
    const yflip = await createImageBitmap(bitmap, {imageOrientation: "flipY"});

    const texture = gl.createTexture()!;
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, yflip);

    // This is required for all textures that aren't powers of two (except for
    // the magnification filter), and it's also a fairly sensible default
    // setting.
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);

    return new Texture(texture);
  }
}


// Uniforms

type IntoSimpleUniform =
  number | number[] | Vec2 | Vec3 | Vec4 | Matrix2 | Matrix3 | Matrix4;
type IntoUniform = IntoSimpleUniform | Texture;
type UniformValue = number[] | Texture;
type IntoUniformWithValueTuple = [string, GLenum, IntoUniform, number?];

export enum UniformSource { MATERIAL, ENVIRONMENT, INSTANCE }

interface Uniform {
  name: string;
  type: GlType;
}

interface UniformWithValue extends Uniform {
  value: UniformValue;
}

interface MaterialUniform extends UniformWithValue {
  location: WebGLUniformLocation;
  valueSource: UniformSource;
  // This is to help find spelling errors in uniforms:
  hasBeenWritten: boolean;
}


export function UniformValue(value: IntoUniform): UniformValue {
  if (value instanceof Texture)
    return value;
  return simpleUniformToArray(value);
}

export function Uniform(name: string, type: GLenum, size = 1): Uniform {
  return { name, type: GlType(type, size) };
}

export function UniformWithValue(
  name: string, type: GLenum, value: IntoUniform, size = 1
): UniformWithValue {
  const result = { ...Uniform(name, type, size), value: UniformValue(value) };
  validateUniformWithValue(result);
  return result;
}


function validateUniformWithValue(uniform: UniformWithValue) {
  const type = uniform.type;
  if (uniform.value instanceof Texture) {
    console.assert(type.elemType === GL.SAMPLER_2D);
    console.assert(type.elemCount === 1);
  } else {
    console.assert(type.elemType === GL.FLOAT || type.elemType === GL.INT);
    console.assert(Array.isArray(uniform.value));
    console.assert(
      uniform.value.length === type.elemCount,
      `The value for uniform “${uniform.name}” has a wrong number of elements. `
      + `It has ${uniform.value.length} elements but it should have `
      + `${type.elemCount}.`
    );
  }
}

function simpleUniformToArray(value: IntoSimpleUniform): number[] {
  if (Array.isArray(value))
    return value;
  if (typeof(value) === "number")
    return [value];
  if (value instanceof Matrix)
    return value.elems.elems;
  return value.elems;
}

export function addDefaultUniformSources(
  ...sources: [string, UniformSource][]
) {
  for (const [name, source] of sources)
    defaultUniformSources.set(name, source);
}


// Uniform maps

// This stores shared uniforms such as transforms (and lighting if we had it).
class UniformMap {
  public uniforms: Map<string, UniformWithValue>;
  public hasChangedSinceLastBound = false;

  public constructor() {
    this.uniforms = new Map<string, UniformWithValue>();
  }

  public static from(tuples: IntoUniformWithValueTuple[]): UniformMap {
    const map = new UniformMap();
    for (const tuple of tuples)
      map.setFromTuple(tuple);
    return map;
  }


  // Getting & setting uniforms.

  public tryGet(uniform: Uniform): UniformValue | undefined {
    const found = this.uniforms.get(uniform.name);
    if (found === undefined)
      return undefined;
    console.assert(uniform.type.elemType === found.type.elemType);
    console.assert(uniform.type.elemCount === found.type.elemCount);
    return found.value;
  }

  public set(...uniform: IntoUniformWithValueTuple) {
    this.setFromObject(UniformWithValue(...uniform));
  }

  public setFromTuple(uniform: IntoUniformWithValueTuple) {
    this.setFromObject(UniformWithValue(...uniform));
  }
  
  public setFromObject(uniform: UniformWithValue) {
    this.uniforms.set(uniform.name, uniform);
    this.hasChangedSinceLastBound = true;
  }
}

export class EnvironmentUniforms extends UniformMap {
  TypescriptJunk?: number;
}
export class InstanceUniforms extends UniformMap {
  TypescriptJunk?: [number, number];
}


// Materials

export class Material {
  public shader: Shader;
  public uniforms: Map<string, MaterialUniform>;
  public hasChangedSinceLastBound = false;


  // Initialization

  public constructor(shader: Shader) {
    this.shader = shader;
    this.uniforms = this._createUniformMap();
  }

  public static from(
    shader: Shader, ...uniforms: [string, IntoUniform][]
  ): Material {
    const mat = new Material(shader);
    if (uniforms !== undefined)
      for (const [name, value] of uniforms)
        mat.setUniform(name, value);
    return mat;
  }

  _createUniformMap(): Map<string, MaterialUniform> {
    const map = new Map<string, MaterialUniform>();
    const count =
      gl.getProgramParameter(this.shader.program, GL.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const [uniform, location] = this._getUniformInfo(i);
      const value = [0];
      for (let i = 1; i < uniform.type.elemCount; i++)
        value.push(0);

      const valueSource =
        defaultUniformSources.get(uniform.name) ?? UniformSource.MATERIAL;
      map.set(uniform.name, {
        ...uniform, value, location, valueSource, hasBeenWritten: false
      });
    }
    return map;
  }

  _getUniformInfo(i: number): [Uniform, WebGLUniformLocation] {
    const {name, size, type} = gl.getActiveUniform(this.shader.program, i)!;
    const loc = gl.getUniformLocation(this.shader.program, name)!;
    return [{ name, type: GlType(type, size) }, loc];
  }


  // Setting uniforms.

  public setUniform(name: string, value: IntoUniform) {
    const uniform = this.uniforms.get(name);
    if (uniform === undefined) {
      console.warn(`Uniform “${name}” does not exist (it might not be active)`);
      return;
    }

    const newUniform = {
      ...uniform,
      value: UniformValue(value),
      valueSource: UniformSource.MATERIAL,
      hasBeenWritten: true
    };
    validateUniformWithValue(newUniform);
    this.uniforms.set(name, newUniform);
    this.hasChangedSinceLastBound = true;
  }

  public setUniformSource(name: string, source: UniformSource) {
    const uniform = this.uniforms.get(name);
    if (uniform === undefined) {
      console.warn(`Uniform “${name}” does not exist (it might not be active)`);
      return;
    }
    this.uniforms.set(name, {
      ...uniform,
      valueSource: source,
      hasBeenWritten: true
    });
    this.hasChangedSinceLastBound = true;
  }

  public hasUniform(name: string): boolean {
    return this.uniforms.has(name);
  }
}


// Mesh

type IntoMeshBuffer = [string, GLenum, IntoBufferData]

export class Mesh {
  public buffers: Map<string, VertexBuffer>;
  public vertexCount: number;
  public indexCount?: number;

  public constructor(
    vertexCount: number, buffers: [string, VertexBuffer][], indexCount?: number
  ) {
    this.vertexCount = vertexCount;
    this.indexCount = indexCount;
    this.buffers = new Map<string, VertexBuffer>();

    let wereIndicesFound = false;
    for (const [name, buffer] of buffers) {
      this.buffers.set(name, buffer);

      if (buffer.bufferType === GL.ELEMENT_ARRAY_BUFFER) {
        console.assert(
          typeof(indexCount) === "number",
          "In the Mesh constructor, an index buffer was found, but the index " +
          "count wasn't provided! You should provide the index count as an " +
          "argument to the constructor."
        );
        console.assert(
          !wereIndicesFound,
          "A mesh can only have a single index buffer, " +
          "but a second index buffer was provided!"
        );
        wereIndicesFound = true;
      }
    }

    console.assert(
      (typeof(indexCount) === "number") === wereIndicesFound,
      "In the Mesh constructor, the index count was provided, but no index " +
      "buffer was found! Did you forget to mark a buffer as an index buffer?"
    )
  }

  public static from(
    vertexCount: number, ...buffers: IntoMeshBuffer[]
  ): Mesh {
    return Mesh.from_indexed(vertexCount, undefined, ...buffers);
  }

  public static from_indexed(
    vertexCount: number,
    indexCount: number|undefined,
    ...buffers: IntoMeshBuffer[]
  ): Mesh {
    const buffers2: [string, VertexBuffer][] = [];

    for (const [name, type, data] of buffers) {
      const isIndices = (name === "indices");
      const normalized =
        VertexBuffer.normalizeIntoBuffer([type, data, isIndices]);

      if (Array.isArray(normalized.data)) {
        if (isIndices) {
          indexCount = normalized.data.length;
        } else {
          const actual = normalized.data.length / normalized.type.elemCount;
          console.assert(
            actual === vertexCount,
            "A buffer had the wrong number of vertices! " +
            "Maybe you made a mistake? " +
            `Received data for ${actual} vertices but expected ${vertexCount}.`
          );
        }
      }

      const buffer = VertexBuffer.from(normalized);
      buffers2.push([name, buffer]);
    }
    return new Mesh(vertexCount, buffers2, indexCount);
  }

  public static get square(): Mesh {
    Mesh.Square ??= Mesh.from(6,
      ["position", GL.FLOAT_VEC2, [
        1, 1,   0, 1,   0, 0,
        0, 0,   1, 0,   1, 1
      ]],
      ["uv", GL.FLOAT_VEC2, [
        1, 1,   0, 1,   0, 0,
        0, 0,   1, 0,   1, 1
      ]]
    );
    return Mesh.Square;
  }

  static Square: Mesh;
}


// Bind machine

export class BindMachine {
  environment: EnvironmentUniforms|null = null;
  instanceUniforms: InstanceUniforms|null = null;
  shader: Shader|null = null;
  material: Material|null = null;
  mesh: Mesh|null = null;
  vao: WebGLVertexArrayObject|null = null;
  wereInstanceUniformsChanged = false;


  public clear() {
    this.environment = null;
    this.instanceUniforms = null;
    this.shader = null;
    this.material = null;
    this.mesh = null;
    this.vao = null;
    this.wereInstanceUniformsChanged = false;
  }

  public setEnvironment(environment: EnvironmentUniforms) {
    if (this.environment === environment
      && !environment.hasChangedSinceLastBound)
      return;
    this.environment = environment;
    this.environment.hasChangedSinceLastBound = false;
    // We need to reload the material to read the environment uniforms.
    this.material = null;
  }

  public setInstanceUniforms(instanceUniforms: InstanceUniforms|null) {
    if (this.instanceUniforms === instanceUniforms
      && !!instanceUniforms && !instanceUniforms.hasChangedSinceLastBound)
      return;

    this.instanceUniforms = instanceUniforms;
    if (!!this.instanceUniforms)
      this.instanceUniforms.hasChangedSinceLastBound = false;
    // We might need to partially update the material later.
    this.wereInstanceUniformsChanged = true;
  }


  // Material

  public setMaterial(material: Material) {
    console.assert(
      !!this.environment, "Must set environment before setting a material."
    );

    if (this.material === material && !material.hasChangedSinceLastBound) {
      // PARTIAL UPDATE: Material is the same but instance uniforms were changed
      if (!this.wereInstanceUniformsChanged || !this.instanceUniforms)
        return;
      for (const [_, uniform] of material.uniforms) {
        if (uniform.valueSource !== UniformSource.INSTANCE)
          continue;
        console.assert(uniform.type.type !== GL.SAMPLER_2D);
        const value = this.instanceUniforms.tryGet(uniform) ?? uniform.value;
        this._bindSimpleUniform(uniform, value as number[]);
      }
      return;
    }

    // FULL UPDATE: New material -- update all uniforms.
    this._setShader(material.shader);
    this.material = material;
    this.material.hasChangedSinceLastBound = false;
    let textureUnit = 0;

    for (const [_, uniform] of material.uniforms) {
      const value = BindMachine.getBestAvailableUniformValue(
        uniform, this.environment!, this.instanceUniforms
      );

      if (uniform.type.type === GL.SAMPLER_2D) {
        const tex = (value instanceof Texture ? value : null);
        this._bindTextureInform(uniform, tex, textureUnit);
        textureUnit += 1;
      } else this._bindSimpleUniform(uniform, value as number[]);
    }
  }

  // If the material says we should take the uniform from the environment or the
  // instance but it's not there, then we just use the material's uniform value.
  static getBestAvailableUniformValue(
    uniform: MaterialUniform,
    environment: EnvironmentUniforms,
    instanceUniforms: InstanceUniforms|null
  ): UniformValue {
    switch (uniform.valueSource) {
      case UniformSource.ENVIRONMENT:
        return environment.tryGet(uniform) ?? uniform.value;
      case UniformSource.INSTANCE:
        console.assert(
          uniform.type.type !== GL.SAMPLER_2D,
          "Textures are not supported as instance uniform."
        );
        // Mostly because I can't be bothered to keep track of texture units in
        // partial uniform uploads.
        return instanceUniforms?.tryGet(uniform) ?? uniform.value;
      default:
        if (!uniform.hasBeenWritten) {
          // This is here to catch spelling mistakes with non-existent uniforms.
          console.warn(
            `The uniform “${uniform.name}” has not yet been given a value! ` +
            "Maybe you made a typo?"
          );
        }
        return uniform.value;
    }
  }

  _setShader(shader: Shader) {
    if (this.shader === shader)
      return;
    this.shader = shader;
    gl.useProgram(shader.program);
  }

  _bindSimpleUniform(uniform: MaterialUniform, value: number[]) {
    // console.assert(uniform.size === 1);
    const l = uniform.location;
    switch (uniform.type.type) {
      case GL.FLOAT: gl.uniform1fv(l, value); break;
      case GL.FLOAT_VEC2: gl.uniform2fv(l, value); break;
      case GL.FLOAT_VEC3: gl.uniform3fv(l, value); break;
      case GL.FLOAT_VEC4: gl.uniform4fv(l, value); break;
      case GL.INT: gl.uniform1iv(l, value); break;
      case GL.INT_VEC2: gl.uniform2iv(l, value); break;
      case GL.INT_VEC3: gl.uniform3iv(l, value); break;
      case GL.INT_VEC4: gl.uniform4iv(l, value); break;
      case GL.FLOAT_MAT2: gl.uniformMatrix2fv(l, false, value); break;
      case GL.FLOAT_MAT3: gl.uniformMatrix3fv(l, false, value); break;
      case GL.FLOAT_MAT4: gl.uniformMatrix4fv(l, false, value); break;
      default:
        throw new Error(`Uniform type ${uniform.type.type} not supported!!!`);
    }
  }

  _bindTextureInform(
    uniform: MaterialUniform, value: Texture|null, textureUnit: number
  ) {
    const texture = value?.texture ?? null;
    gl.activeTexture(GL.TEXTURE0 + textureUnit);
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.uniform1i(uniform.location, textureUnit);
  }


  // Mesh

  public setMeshWithoutVao(mesh: Mesh) {
    if (this.mesh === mesh)
      return;
    this.vao = null;
    glVAO.bindVertexArrayOES(null);
    this._setMesh(mesh);
  }

  _setMesh(mesh: Mesh) {
    console.assert(
      !!this.shader, "Must have a shader bound before binding a mesh."
    );
    this.mesh = mesh;

    for (const [name, attrib] of this.shader!.vertexAttributes.entries()) {
      const buffer = mesh.buffers.get(name);
      if (buffer === undefined) {
        console.warn(`Missing vertex attribute “${name}” in a mesh :(`);
        continue;
      }
      console.assert(attrib.type.type === buffer.type.type);
      console.assert(attrib.type.size === buffer.type.size);
      console.assert(buffer.bufferType === GL.ARRAY_BUFFER);
      gl.enableVertexAttribArray(attrib.location);
      gl.bindBuffer(buffer.bufferType, buffer.buffer);
      gl.vertexAttribPointer(
        attrib.location, attrib.type.elemCount, attrib.type.elemType,
        buffer.isNormalized, 0, 0
      );
    }

    const indices = this.mesh.buffers.get("indices");
    if (indices && indices.bufferType === GL.ELEMENT_ARRAY_BUFFER)
      gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, indices.buffer);
  }


  // VAO

  public createVao(mesh: Mesh, shader: Shader): WebGLVertexArrayObject {
    this.material = null;

    const vao = glVAO.createVertexArrayOES()!;
    this.setVao(vao);
    this._setShader(shader);
    this._setMesh(mesh);
    return vao;
  }

  public setVao(vao: WebGLVertexArrayObject) {
    if (this.vao === vao)
      return;
    this.mesh = null;
    this.vao = vao;
    glVAO.bindVertexArrayOES(vao);
  }
}


// Drawables

export interface Drawable {
  draw(): void;
}

export class Model implements Drawable {
  public mesh: Mesh;
  public material: Material;
  public vao: WebGLVertexArrayObject;

  public constructor(mesh: Mesh, material: Material) {
    this.mesh = mesh;
    this.material = material;
    this.vao = bindMachine.createVao(mesh, material.shader);
  }

  public draw() {
    bindMachine.setMaterial(this.material);
    bindMachine.setVao(this.vao);
    if (this.mesh.indexCount !== undefined)
      gl.drawElements(GL.TRIANGLES, this.mesh.indexCount, GL.UNSIGNED_SHORT, 0);
    else gl.drawArrays(GL.TRIANGLES, 0, this.mesh.vertexCount);
  }
}


// Scene tree

export interface SceneTree {
  aspectRatio: number,
  uniforms: EnvironmentUniforms,
  root: Node
}

export class Node {
  public name: string;
  public children: Node[];
  public parent: Node|null;
  public tree: SceneTree|null = null;

  public constructor(name?: string) {
    this.name = name ?? "Node";
    this.children = [];
    this.parent = null;
  }


  // Adding & removing nodes

  public addChild(node: Node, index = -1) {
    if (node.tree) {
      throw new Error(
        "Tried to add a new child to a node, " +
        "but the child is already in a scene tree."
      );
    }
    this.children.splice(index, 0, node);
    node._setParent(this);
    if (this.tree !== null)
      node.recursively(node => node._setTree(this.tree));
  }

  public removeChild(node: Node) {
    if (node.parent !== this) {
      throw new Error(
        "Tried to remove a child, but it didn't have the right parent."
      );
    }

    const found = this.children.findIndex(n => n === node);
    console.assert(found !== -1, "Node was not in children of its parent?!");
    this.children.splice(found, 1);
    console.assert(!this.children.includes(node), "Child was in list twice?!");
    node.parent = null;
    node.recursively(node => node._setTree(null));
  }

  public remove() {
    console.assert(
      !!this.parent, "Tried to remove a child which already has no parent!"
    );
    this.parent!.removeChild(this);
  }


  // Branch operations

  public recursively(callback: (node: Node) => void) {
    callback(this);
    for (const child of this.children)
      child.recursively(callback);
  }


  // These functions are overridden in some derived classes. For example a
  // camera might need to update its projection matrix when it's added to a tree

  _setTree(tree: SceneTree|null) {
    console.assert(this.tree === null || tree === null);
    this.tree = tree;
  }

  _setParent(node: Node) {
    this.parent = node;
  }
}

// export class Node2D extends Node {
//   public transform: Matrix3;
//
//   public constructor(name?: string) {
//     super(name);
//     this.transform = Matrix3.identity;
//   }
//
//   public getGlobalTransform(): Matrix3 {
//     // eslint-disable-next-line @typescript-eslint/no-this-alias
//     let node: Node = this;
//     let tf = this.transform;
//     while (node.parent) {
//       node = node.parent;
//       if (node instanceof Node2D)
//         tf = node.transform.mult(tf);
//     }
//     return tf;
//   }
// }
//
// export class ModelNode2D extends Node2D implements Drawable {
//   public model: Model|null = null;
//   public uniforms: InstanceUniforms;
//
//   public constructor(name?: string) {
//     super(name);
//     this.uniforms = new InstanceUniforms();
//   }
//
//   public static from(model: Model, name?: string): ModelNode2D {
//     const result = new ModelNode2D(name);
//     result.model = model;
//     return result;
//   }
//
//   public draw() {
//     const globalTf = this.getGlobalTransform();
//     this.uniforms.set("local_to_global", GL.FLOAT_MAT3, globalTf);
//     bindMachine.setInstanceUniforms(this.uniforms);
//     this.model?.draw();
//   }
// }
