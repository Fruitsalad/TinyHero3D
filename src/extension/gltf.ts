import {
  Accessor,
  Document,
  GLTF,
  Primitive,
  WebIO,
  Mesh as GltfMesh,
  Material as GltfMaterial, Scene,
  Node as GltfNode, Root
} from "@gltf-transform/core";
import {MeshNode3D, Node3D} from "./3D.ts";
import {
  GlType,
  IntoBufferObject,
  Geometry,
  VertexBuffer, Mesh, Submesh, Material
} from "../graphics/graphics.ts";
import {Matrix4} from "../math/matrix.ts";


const GL = WebGLRenderingContext;

interface GltfLoadOptions {
  loadMaterial: (gltfMaterial: GltfMaterial|null) => Material,
  normalizeBufferName?: (gltfName: string) => string
}

class GltfCache {
  public meshes = new Map<GltfMesh, Mesh>();
  public materials = new Map<GltfMaterial, Material>();

  public loadMesh(mesh: GltfMesh, options: GltfLoadOptions): Mesh {
    const cachedResult = this.meshes.get(mesh);
    if (cachedResult)
      return cachedResult;
    const loaded = loadMesh(mesh, options, this);
    this.meshes.set(mesh, loaded);
    return loaded;
  }

  public loadMaterial(mat: GltfMaterial, options: GltfLoadOptions): Material {
    const cachedResult = this.materials.get(mat);
    if (cachedResult)
      return cachedResult;
    const loaded = options.loadMaterial(mat);
    this.materials.set(mat, loaded);
    return loaded;
  }
}


export async function loadGltfScene(
  gltfFile: string, options: GltfLoadOptions
): Promise<Node3D> {
  return loadOnlyScene(await loadGltfRoot(gltfFile), options);
}

export async function loadGltfRoot(gltfFile: string): Promise<Root> {
  const io = new WebIO();
  const doc = await io.read(gltfFile);
  return doc.getRoot();
}

export function loadSpecificMesh(
  root: Root, meshName: string, options: GltfLoadOptions, cache?: GltfCache
): Mesh {
  options.normalizeBufferName ??= normalizeGltfBufferName;
  cache ??= new GltfCache();

  const mesh = root.listMeshes().find(mesh => mesh.getName() === meshName);
  if (!mesh)
    throw new Error(`The mesh “${meshName}” was not found :(`);

  return loadMesh(mesh, options, cache);
}

export function loadOnlyScene(root: Root, options: GltfLoadOptions): Node3D {
  options.normalizeBufferName ??= normalizeGltfBufferName;
  const cache = new GltfCache();
  const scenes = root.listScenes()

  if (scenes.length === 0)
    throw new Error("The GLTF root did not contain any scenes!");
  if (scenes.length > 1) {
    console.warn(
      "A GLTF document had more than one scene. " +
      "Only the first scene will be loaded."
    );
  }
  return loadScene(scenes[0], options, cache);
}

export function loadScene(
  scene: Scene, options: GltfLoadOptions, cache: GltfCache
): Node3D {
  options.normalizeBufferName ??= normalizeGltfBufferName;
  const result = new Node3D(scene.getName());
  for (const child of scene.listChildren())
    result.addChild(loadBranch(child, options, cache));
  return result;
}

function loadBranch(
  gltfNode: GltfNode, options: GltfLoadOptions, cache: GltfCache
): Node3D {
  let result: Node3D;

  const gltfMesh = gltfNode.getMesh();
  if (gltfMesh) {
    const meshNode = new MeshNode3D(gltfNode.getName());
    meshNode.mesh = cache.loadMesh(gltfMesh, options);
    result = meshNode;
  } else result = new Node3D(gltfNode.getName());

  result.transform = new Matrix4(gltfNode.getMatrix(), false);

  for (const child of gltfNode.listChildren())
    result.addChild(loadBranch(child, options, cache));
  return result;
}

function loadMesh(
  mesh: GltfMesh, options: GltfLoadOptions, cache: GltfCache
): Mesh {
  const submeshes = mesh.listPrimitives().map(primitive => {
    const geometry = loadGeometry(primitive, options.normalizeBufferName!);
    const gltfMat = primitive.getMaterial();
    const material =
      (gltfMat !== null ? cache.materials.get(gltfMat) : undefined)
      ?? options.loadMaterial(gltfMat);
    return new Submesh(geometry, material);
  });
  const name = mesh.getName();
  return new Mesh(submeshes, name);
}

function loadGeometry(
  primitive: Primitive, normalizeBufferName: (gltfName: string) => string
): Geometry {
  const indexData = primitive.getIndices();
  const indexList = (indexData ? gatherIndices(indexData) : undefined);
  const indices =
    (indexList ? VertexBuffer.createIndexBuffer(indexList) : undefined);
  const indexCount = indexList?.length;

  const attribs = primitive.listAttributes();
  const attribNames = primitive.listSemantics();
  if (attribs.length === 0) {
    throw new Error(
      "A submesh had no vertex attributes! The glTF loader requires that a " +
      "submesh has at least one vertex attribute."
    );
  }
  const vertexCount = attribs[0].getCount();

  const vertices = attribs.map((attrib, i) => {
    console.assert(
      attrib.getCount() === vertexCount,
      `The attribute “${attrib.getName()}” had ${attrib.getCount()} ` +
      "vertices, but another attribute in the same submesh had " +
      `${vertexCount} vertices. All attributes in a mesh should have the ` +
      "same amount of vertices!"
    );
    const name = normalizeBufferName(attribNames[i]);
    const bufferData = gatherVertexBufferData(attrib);
    const buffer = VertexBuffer.from(bufferData);
    return [name, buffer] as [string, VertexBuffer];
  });

  return new Geometry(vertexCount, vertices, indexCount, indices);
}

// This function turns buffer names like `POSITION` and `TEXCOORD_0` into
// `position` and `texcoord`.
export function normalizeGltfBufferName(gltfName: string): string {
  // In glTF-2.0, buffers usually have an all-caps name, so we make it lowercase
  let name = gltfName.toLowerCase();

  // The glTF-2.0 standard says:
  //    Application-specific attribute semantics MUST start with an underscore,
  //    e.g., _TEMPERATURE.
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
  // So to normalize these, we trim the first underscore.
  if (name.startsWith("_"))
    name = name.substring(1);

  // If a name doesn't start with an underscore, we also remove trailing _0,
  // mainly so that `TEXCOORD_0` becomes just `texcoord` and `COLOR_0` becomes
  // just `color`.
  else if (name.endsWith("_0"))
    name = name.substring(0, name.length - 2);

  return name;
}

function gatherIndices(attrib: Accessor): number[] {
  console.assert(
    attrib.getType() === 'SCALAR',
    "The elements of an index buffer should be simple unsigned integers, " +
    `but were defined as “${attrib.getType()}”.`
  );
  console.assert(
    attrib.getComponentType() !== GL.FLOAT,
    "An index buffer should have integer components, but had float components."
  );
  return Array.from(attrib.getArray()!);
}

function gatherVertexBufferData(attrib: Accessor): IntoBufferObject {
  const type = GlType(getSupportedVertexBufferType(attrib));
  const data = Array.from(attrib.getArray()!);
  const isNormalized = attrib.getNormalized();
  return { type, data, isNormalized }
}

function getSupportedVertexBufferType(attrib: Accessor): GLenum {
  // WEBGL1 only supports INT and FLOAT for vertex buffers, so types like SHORT
  // & BYTE are normalized to INT.
  const is_float = (attrib.getComponentType() === GL.FLOAT);

  switch (attrib.getType()) {
    case 'SCALAR': return (is_float ? GL.FLOAT : GL.INT);
    case 'VEC2': return (is_float ? GL.FLOAT_VEC2 : GL.INT_VEC2);
    case 'VEC3': return (is_float ? GL.FLOAT_VEC3 : GL.INT_VEC3);
    case 'VEC4': return (is_float ? GL.FLOAT_VEC4 : GL.INT_VEC4);
    case 'MAT2': return GL.FLOAT_MAT2;
    case 'MAT3': return GL.FLOAT_MAT3;
    case 'MAT4': return GL.FLOAT_MAT4;
  }
}



