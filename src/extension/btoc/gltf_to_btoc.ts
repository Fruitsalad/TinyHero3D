import {
  Accessor, Primitive, Root, Extension, Scene,
  Node as GltfNode,
  Mesh as GltfMesh,
  Material as GltfMaterial,
  Texture as GltfTexture
} from "@gltf-transform/core";
import {GL} from "../../graphics/graphics.ts"
import {Matrix4} from "../../math/matrix.ts";
import {getCachedOrCompute} from "../../util/cache.ts";
import {loadGltfRoot, normalizeGltfBufferName} from "../gltf.ts";
import {BtocFile} from "./btoc.ts";
import {NodeData} from "./btoc_mesh.ts";
import {BtocMeshWriter} from "./btoc_mesh_writer.ts";


interface MaterialData {
  shaderName: string;
  uniforms: Map<string, number[]|number>;
}

type LoadMaterialCallback =
  (gltfMaterial: GltfMaterial|null,
   saveTexture: (tex: GltfTexture) => number) => MaterialData


export async function convertGltfFileToBtoc(
  path: string,
  extensions: (typeof Extension)[] = [],
  loadMaterial: LoadMaterialCallback,
  normalizeBufferName: (gltfName: string) => string = normalizeGltfBufferName
): Promise<BtocFile> {
  const root = await loadGltfRoot(path, extensions);
  return GltfToBtocConverter.convert(root, loadMaterial, normalizeBufferName);
}

export function convertGltfToBtoc(
  root: Root,
  loadMaterial: LoadMaterialCallback,
  normalizeBufferName: (gltfName: string) => string = normalizeGltfBufferName
): BtocFile {
  return GltfToBtocConverter.convert(root, loadMaterial, normalizeBufferName);
}


class GltfToBtocConverter {
  writer = new BtocMeshWriter();
  cachedGeometries = new Map<Primitive, number>();
  cachedMaterials = new Map<GltfMaterial|null, number>();
  cachedMeshes = new Map<GltfMesh, number>();
  cachedTextures = new Map<GltfTexture, number>();

  convertMaterialCallback: LoadMaterialCallback;
  normalizeBufferName: (gltfName: string) => string;

  constructor(
    loadMaterial: LoadMaterialCallback,
    normalizeBufferName: (gltfName: string) => string
  ) {
    this.convertMaterialCallback = loadMaterial;
    this.normalizeBufferName = normalizeBufferName;
  }

  static convert(
    root: Root,
    loadMaterial: LoadMaterialCallback,
    normalizeBufferName: (gltfName: string) => string = normalizeGltfBufferName
  ): BtocFile {
    const converter =
      new GltfToBtocConverter(loadMaterial, normalizeBufferName);
    converter.convertRoot(root);
    return converter.writer.finish();
  }

  convertRoot(root: Root) {
    const scenes = root.listScenes();
    if (scenes.length === 0)
      throw new Error("The GLTF root did not contain any scenes!");
    if (scenes.length > 1) {
      console.warn(
        "A GLTF document had more than one scene. " +
        "Only the first scene will be loaded."
      );
    }

    this.convertScene(scenes[0]);
  }

  convertScene(scene: Scene) {
    const children = scene.listChildren()
      .map(child => this.convertBranch(child));
    this.writer.setScene({name: scene.getName(), children});
  }

  convertBranch(node: GltfNode): NodeData {
    const name = node.getName();
    const tf = new Matrix4(node.getMatrix(), false);
    const gltfMesh = node.getMesh();
    const mesh = (gltfMesh ? this.convertMesh(gltfMesh) : undefined);
    const children = node.listChildren()
      .map(child => this.convertBranch(child));
    return {name, children, transform: tf.elems.elems, mesh}
  }


  // Mesh

  convertMesh(mesh: GltfMesh): number {
    return getCachedOrCompute(
      mesh, this.cachedMeshes, m => this._convertMesh(m)
    );
  }

  _convertMesh(mesh: GltfMesh): number {
    const name = mesh.getName();
    let geometries = [];
    let materials = [];

    for (const primitive of mesh.listPrimitives()) {
      geometries.push(this.convertGeometry(primitive));
      materials.push(this.convertMaterial(primitive.getMaterial()));
    }

    return this.writer.addMesh(name, geometries, materials);
  }


  // Geometry

  convertGeometry(primitive: Primitive): number {
    return getCachedOrCompute(
      primitive, this.cachedGeometries, p => this._convertGeometry(p)
    );
  }

  _convertGeometry(primitive: Primitive): number {
    const id = this.writer.getNextGeometryId();

    const indices = primitive.getIndices();
    if (indices)
      this.writer.addIndexBuffer(id, Array.from(indices.getArray()!));

    const gltfAttributes = primitive.listAttributes();
    const attribNames = primitive.listSemantics();
    if (gltfAttributes.length === 0) {
      throw new Error(
        "A submesh had no vertex attributes! The glTF loader requires that a " +
        "submesh has at least one vertex attribute."
      );
    }
    const vertexCount = gltfAttributes[0].getCount();

    const attributes = gltfAttributes.map((attrib, i) => {
      console.assert(
        attrib.getCount() === vertexCount,
        `The attribute “${attrib.getName()}” had ${attrib.getCount()} ` +
        "vertices, but another attribute in the same submesh had " +
        `${vertexCount} vertices. All attributes in a mesh should have the ` +
        "same amount of vertices!"
      );
      const name = this.normalizeBufferName(attribNames[i]);
      const type = this.getSupportedVertexBufferType(attrib);
      const data = Array.from(attrib.getArray()!);
      const isNormalized = attrib.getNormalized();

      this.writer.addVertexBuffer(id, name, type, data);
      return [name, type, isNormalized] as [string, GLenum, boolean];
    });

    this.writer.addGeometry(attributes);
    return id;
  }

  getSupportedVertexBufferType(attrib: Accessor): GLenum {
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


  // Material

  convertMaterial(material: GltfMaterial|null): number {
    return getCachedOrCompute(
      material, this.cachedMaterials, m => this._convertMaterial(m)
    );
  }

  _convertMaterial(material: GltfMaterial|null): number {
    const data = this.convertMaterialCallback(
      material, tex => this.convertTexture(tex)
    );
    return this.writer.addMaterial(data.shaderName, data.uniforms);
  }


  // Texture

  convertTexture(texture: GltfTexture): number {
    return getCachedOrCompute(
      texture, this.cachedTextures, t => this._convertTexture(t)
    );
  }

  _convertTexture(texture: GltfTexture): number {
    const bytes = texture.getImage()!;
    const mimetype = texture.getMimeType();
    return this.writer.addTexture(bytes, mimetype);
  }
}

