import {Vec2, Vec3, Vec4} from "../math/vec.ts";
import {Matrix, Matrix2, Matrix3, Matrix4} from "../math/matrix.ts";
// @ts-expect-error  WebGL debug does not support Typescript, but it's fine.
import WebGLDebugUtils from "../external/webgl-debug";

// In a NodeJS setting (like for the tool scripts) WebGLRenderingContext is not
// defined, but we still need its constants. For that reason, we grab some of
// the constants here. We really don't want to include this in browser builds
// because it makes the minified version a lot bigger.
const hasWebGL = (typeof WebGLRenderingContext !== 'undefined');
const isMinifiedBuild =
  // @ts-expect-error __IS_MINIFIED_BUILD__ is an environment variable.
  (typeof __IS_MINIFIED_BUILD__ !== "undefined" && __IS_MINIFIED_BUILD__);
export const GL = (hasWebGL ? WebGLRenderingContext :
  (isMinifiedBuild ? ({} as WebGLRenderingContext) : {
  // Clear
  DEPTH_BUFFER_BIT: 0x00000100,
  STENCIL_BUFFER_BIT: 0x00000400,
  COLOR_BUFFER_BIT: 0x00004000,

  // Types
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406,
  FLOAT_VEC2: 0x8B50,
  FLOAT_VEC3: 0x8B51,
  FLOAT_VEC4: 0x8B52,
  INT_VEC2: 0x8B53,
  INT_VEC3: 0x8B54,
  INT_VEC4: 0x8B55,
  BOOL: 0x8B56,
  BOOL_VEC2: 0x8B57,
  BOOL_VEC3: 0x8B58,
  BOOL_VEC4: 0x8B59,
  FLOAT_MAT2: 0x8B5A,
  FLOAT_MAT3: 0x8B5B,
  FLOAT_MAT4: 0x8B5C,
  SAMPLER_2D: 0x8B5E,

  // Shaders & buffers
  COMPILE_STATUS: 0x8B81,
  LINK_STATUS: 0x8B82,
  FRAGMENT_SHADER: 0x8B30,
  VERTEX_SHADER: 0x8B31,
  ACTIVE_UNIFORMS: 0x8B86,
  ACTIVE_ATTRIBUTES: 0x8B89,
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88E4,
  DYNAMIC_DRAW: 0x88E8,
  TRIANGLES: 0x0004,

  // Textures & samplers
  TEXTURE_2D: 0x0DE1,
  TEXTURE0: 0x84C0,
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  NEAREST_MIPMAP_NEAREST: 0x2700,
  LINEAR_MIPMAP_NEAREST: 0x2701,
  NEAREST_MIPMAP_LINEAR: 0x2702,
  LINEAR_MIPMAP_LINEAR: 0x2703,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  REPEAT: 0x2901,
  CLAMP_TO_EDGE: 0x812F,
  MIRRORED_REPEAT: 0x8370,
  RGBA: 0x1908
}));

export let gl: WebGLRenderingContext;
let glVAO: OES_vertex_array_object;
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
    if (isMinifiedBuild) {
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
  gl.frontFace(gl.CW);
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
    (type === GL.UNSIGNED_SHORT
    // || type === GL.UNSIGNED_INT
    // || type === GL.UNSIGNED_BYTE
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

export function isSupportedFloatType(type: GLenum): boolean {
  switch (type) {
    case GL.FLOAT: case GL.FLOAT_VEC2: case GL.FLOAT_VEC3: case GL.FLOAT_VEC4:
    case GL.FLOAT_MAT2: case GL.FLOAT_MAT3: case GL.FLOAT_MAT4:
      return true;
    default: return false;
  }
}

export function isSupportedIntType(type: GLenum): boolean {
  switch (type) {
    case GL.INT: case GL.INT_VEC2: case GL.INT_VEC3: case GL.INT_VEC4:
      return true;
    default: return false;
  }
}


// GlType

export interface GlType {
  type: GLenum;  // Something like FLOAT_VEC3
  // `size` is almost always `1`, except for arrays (somewhat rare). Please note
  // that this does not contain the amount of vertices of a vertex buffer (the
  // length of a vertex buffer is not actually stored anywhere).
  size: number;
  // `elemType` indicates the type of the individual values.
  // It can be one of the following: INT, FLOAT, UNSIGNED_SHORT or SAMPLER2D.
  // Please note that only INT, FLOAT and SAMPLER2D are supported in uniforms
  // and only INT and FLOAT are supported in vertex buffers.
  // For index buffers, only UNSIGNED_SHORT is supported.
  elemType: GLenum;
  // The amount of values in the type. For an array of two vec3s, this is `6`.
  elemCount: number;
}

export function GlType(type: GLenum, size = 1): GlType {
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
    // We don't want to accidentally change a VAO (which can happen especially
    // if we're making an index buffer)
    bindMachine.setVao(null);

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(buffer_type, buffer);
    gl.bufferData(buffer_type, data, usage);
    return buffer;
  }

  public static createIndexBuffer(indices: number[]) {
    return VertexBuffer.from({
      data: indices, type: GlType(GL.UNSIGNED_SHORT), isIndices: true
    });
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
    return Texture.from(yflip);
  }

  public static fromEncodedImage(
    bytes: Uint8Array, mimetype: string
  ): Promise<Texture> {
    const blob = new Blob([bytes], { type: mimetype });
    return Texture.fromImageURL(URL.createObjectURL(blob));
  }

  public static fromImageURL(url: string): Promise<Texture> {
    // Yes, this is the official way of making the browser parse an image from
    // a URL: Slap it into a HTML element and then read the data once it's ready
    return new Promise((resolve, _) => {
      const image = new Image();
      image.src = url;
      image.onload = () => resolve(Texture.from(image));
    });
  }

  public static from(source: TexImageSource): Texture {
    const texture = gl.createTexture()!;
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, source);

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

export type IntoSimpleUniform =
  number | number[] | Vec2 | Vec3 | Vec4 | Matrix2 | Matrix3 | Matrix4;
export type IntoUniform = IntoSimpleUniform | Texture;
export type UniformValue = number[] | Texture;
export type UniformTypeAndValueTuple = [GLenum, IntoUniform, number?];
export type IntoNamedUniformTuple = [string, ...UniformTypeAndValueTuple];
export type IntoUniformArray = IntoUniformObject[];
export type IntoUniformStruct = { [key: string]: IntoUniformObject }
export type IntoUniformObject =
  UniformTypeAndValueTuple|IntoUniformArray|IntoUniformStruct;

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

// This stores shared uniforms such as transforms.
class UniformMap {
  public uniforms: Map<string, UniformWithValue>;
  public hasChangedSinceLastBound = false;

  constructor() {
    this.uniforms = new Map<string, UniformWithValue>();
  }

  static from(tuples: IntoNamedUniformTuple[]): UniformMap {
    const map = new UniformMap();
    for (const tuple of tuples)
      map.setFromTuple(tuple);
    return map;
  }


  // Getting & setting uniforms.

  tryGet(uniform: Uniform): UniformValue | undefined {
    const found = this.uniforms.get(uniform.name);
    if (found === undefined)
      return undefined;
    console.assert(uniform.type.elemType === found.type.elemType);
    console.assert(uniform.type.elemCount === found.type.elemCount);
    return found.value;
  }

  set(
    name: string, ...uniform: UniformTypeAndValueTuple|[IntoUniformObject]
  ) {
    if (typeof uniform[0] === "number")
      this.setFromTuple([name, ...(uniform as UniformTypeAndValueTuple)]);
    else this._setStruct(name, uniform[0]);
  }

  private _setStruct(name: string, uniform: IntoUniformObject) {
    const isArray = Array.isArray(uniform);
    const isTuple = (isArray && typeof uniform[0] === "number");

    // Simple value
    if (isTuple)
      this.setFromTuple([name, ...(uniform as UniformTypeAndValueTuple)]);
    // Array
    else if (isArray)
      for (let i = 0; i < uniform.length; i++)
        this._setStruct(`${name}[${i}]`, (uniform as IntoUniformArray)[i]);
    // Struct
    else for (const [key, value] of Object.entries(uniform))
        this._setStruct(`${name}.${key}`, value);
  }

  setFromTuple(uniform: IntoNamedUniformTuple) {
    this.setFromObject(UniformWithValue(...uniform));
  }
  
  setFromObject(uniform: UniformWithValue) {
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


// Geometry

type IntoNamedVertexBuffer = [string, GLenum, IntoBufferData]

export class Geometry {
  public vertexBuffers: Map<string, VertexBuffer>;
  public vertexCount: number;
  public indexBuffer?: VertexBuffer;
  public indexCount?: number;

  public constructor(
    vertexCount: number, vertexBuffers: [string, VertexBuffer][],
    indexCount?: number, indexBuffer?: VertexBuffer
  ) {
    this.vertexCount = vertexCount;
    this.indexCount = indexCount;
    this.vertexBuffers = new Map<string, VertexBuffer>();

    if (indexBuffer) {
      console.assert(
        typeof(indexCount) === "number",
        "In the Geometry constructor, an index buffer was provided," +
        "but the index count wasn't provided! You should provide the index " +
        "count as an argument to the constructor."
      );
      this.indexBuffer = indexBuffer;
    }

    for (const [name, buffer] of vertexBuffers) {
      console.assert(
        !this.vertexBuffers.has(name),
        `A submesh had two buffers with the name “${name}”! ` +
        "Vertex buffer names must be unique!"
      );
      console.assert(
        buffer.bufferType === GL.ARRAY_BUFFER,
        `The vertex buffer “${name}” did not have the buffer type ` +
        "ARRAY_BUFFER. Did you accidentally pass in an index buffer?"
      );
      this.vertexBuffers.set(name, buffer);
    }
  }

  public static from(
    vertexCount: number, ...vertexBuffers: IntoNamedVertexBuffer[]
  ): Geometry {
    const buffers = Geometry.createNamedBuffers(vertexCount, vertexBuffers);
    return new Geometry(vertexCount, buffers);
  }

  public static from_indexed(
    vertexCount: number,
    indices: number[],
    ...vertexBuffers: IntoNamedVertexBuffer[]
  ): Geometry {
    const indexBuffer = VertexBuffer.createIndexBuffer(indices);
    const buffers = Geometry.createNamedBuffers(vertexCount, vertexBuffers);
    return new Geometry(vertexCount, buffers, indices.length, indexBuffer);
  }

  public static createNamedBuffers(
    vertexCount: number, buffers: IntoNamedVertexBuffer[]
  ): [string, VertexBuffer][] {
    const result: [string, VertexBuffer][] = [];

    for (const [name, type, data] of buffers) {
      const normalized = VertexBuffer.normalizeIntoBuffer([type, data]);

      if (Array.isArray(normalized.data)) {
        const actual = normalized.data.length / normalized.type.elemCount;
        console.assert(
          actual === vertexCount,
          "A buffer had the wrong number of vertices! " +
          "Maybe you made a mistake? " +
          `Received data for ${actual} vertices but expected ${vertexCount}.`
        );
      }

      const buffer = VertexBuffer.from(normalized);
      result.push([name, buffer]);
    }

    return result;
  }

  public static get square(): Geometry {
    Geometry.Square ??= Geometry.from(6,
      ["position", GL.FLOAT_VEC2, [
        1, 1,   0, 1,   0, 0,
        0, 0,   1, 0,   1, 1
      ]],
      ["uv", GL.FLOAT_VEC2, [
        1, 1,   0, 1,   0, 0,
        0, 0,   1, 0,   1, 1
      ]]
    );
    return Geometry.Square;
  }

  static Square: Geometry;
}


// Bind machine

export class BindMachine {
  environment: EnvironmentUniforms|null = null;
  instanceUniforms: InstanceUniforms|null = null;
  shader: Shader|null = null;
  material: Material|null = null;
  geometry: Geometry|null = null;
  vao: WebGLVertexArrayObject|null = null;
  wereInstanceUniformsChanged = false;


  public clear() {
    this.environment = null;
    this.instanceUniforms = null;
    this.shader = null;
    this.material = null;
    this.geometry = null;
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


  // Geometry

  public setGeometryWithoutVao(geometry: Geometry) {
    if (this.geometry === geometry)
      return;
    this.vao = null;
    glVAO.bindVertexArrayOES(null);
    this._setGeometry(geometry);
  }

  _setGeometry(geometry: Geometry) {
    console.assert(
      !!this.shader, "Must have a shader bound before binding geometry."
    );
    this.geometry = geometry;

    const indices = this.geometry.indexBuffer;
    if (indices)
      gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, indices.buffer);

    for (const [name, attrib] of this.shader!.vertexAttributes.entries()) {
      const buffer = geometry.vertexBuffers.get(name);
      if (buffer === undefined) {
        console.warn(
          `Missing vertex attribute “${name}” in a submesh :(`
        );
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
  }


  // VAO

  public createVao(geometry: Geometry, shader: Shader): WebGLVertexArrayObject {
    this.material = null;

    const vao = glVAO.createVertexArrayOES()!;
    this.setVao(vao);
    this._setShader(shader);
    this._setGeometry(geometry);
    return vao;
  }

  public setVao(vao: WebGLVertexArrayObject|null) {
    if (this.vao === vao)
      return;
    this.geometry = null;
    this.vao = vao;
    glVAO.bindVertexArrayOES(vao);
  }
}


// Drawables (Submesh, Mesh)

let clearColor = new Vec4(0,0,0,0);

export function setBackgroundColor(color: Vec4) {
  clearColor = color;
  gl.clearColor(clearColor.r, clearColor.g, clearColor.b, clearColor.a);
}

export function startDrawing() {
  gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
}

export function finishDrawing() {
  gl.flush();
}

export interface Drawable {
  draw(): void;
}

export class Submesh implements Drawable {
  public geometry: Geometry;
  public material: Material;
  public vao: WebGLVertexArrayObject;

  public constructor(geometry: Geometry, material: Material) {
    this.geometry = geometry;
    this.material = material;
    this.vao = bindMachine.createVao(geometry, material.shader);
  }

  public draw() {
    bindMachine.setMaterial(this.material);
    bindMachine.setVao(this.vao);
    if (this.geometry.indexCount !== undefined) {
      gl.drawElements(
        GL.TRIANGLES, this.geometry.indexCount, GL.UNSIGNED_SHORT, 0
      );
    } else gl.drawArrays(GL.TRIANGLES, 0, this.geometry.vertexCount);
  }
}

export class Mesh implements Drawable {
  public submeshes: Submesh[];
  public name?: string;

  public constructor(submeshes: Submesh[], name?: string) {
    this.name = name;
    this.submeshes = submeshes;
  }

  public draw() {
    for (const submesh of this.submeshes)
      submesh.draw();
  }
}


// Scene tree

export interface SceneTree {
  aspectRatio: number,
  uniforms: EnvironmentUniforms,
  root: Node,

  // `extra` is an object that stores additional data, for example lights are
  // typically in extra.lights3D.
  extensions: any
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

  // Depth-first tree traversal
  public recursively(callback: (node: Node) => boolean|void): boolean {
    if (callback(this))
      return true;
    for (const child of this.children)
      if (child.recursively(callback))
        return true;
    return false;
  }

  public recursivelyBreadthFirst(
    callback: (node: Node) => boolean|void
  ): boolean {
    if (callback(this))
      return true;
    return this._recursivelyBreadthFirst(callback);
  }

  _recursivelyBreadthFirst(
    callback: (node: Node) => boolean|void
  ): boolean {
    for (const child of this.children)
      if (callback(child))
        return true;
    for (const child of this.children)
      if (child.recursivelyBreadthFirst(callback))
        return true;
    return false;
  }

  public find(callback: (node: Node) => boolean): Node|undefined {
    let result: Node|undefined = undefined;
    this.recursivelyBreadthFirst(node => {
      if (!callback(node))
        return false;
      result = node;
      return true;
    });
    return result;
  }

  public findAll(callback: (node: Node) => boolean): Node[] {
    let result: Node[] = [];
    this.recursively(node => {
      if (callback(node))
        result.push(node);
    });
    return result;
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
