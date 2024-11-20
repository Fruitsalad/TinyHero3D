import {Matrix4} from "../../math/matrix.ts";
import {MeshNode3D, Node3D} from "../3D.ts";
import {BtocFile} from "./btoc.ts";
import {
  GlType, isSupportedFloatType, isSupportedIntType,
  Material, Texture, Mesh, Submesh, Geometry, VertexBuffer,
  IntoBufferObject, IntoUniform
} from "../core.ts";
import {getCachedOrCompute, getCachedOrComputeAsync} from "../../util/cache.ts";


// Btoc's JSON stuff.

export interface SceneData {
  nodes: NodeData,
  meshes: MeshData[],
  geometries: GeometryData[],
  materials: MaterialData[],
  textures: TextureData[],
}

export interface NodeData {
  name: string,
  children: NodeData[],
  transform?: number[],
  mesh?: number
}

export interface MeshData {
  name: string,
  geometries: number[],
  materials: number[]
}

export interface GeometryData {
  attributes: [string, number, boolean?][]  // attributeName, type, isNormalized
}

export interface MaterialData {
  shaderName: string,
  // `uniforms` is basically a `string -> number[]|number` mapping
  // Note that `number[]` means it's a simple uniform and `number` means it's a
  // texture.
  uniforms: any
}

export interface TextureData {
  mimetype: string
}


// Shader factory
// (This is necessary for loading materials from files)

type ShaderConstructor = (uniforms: Map<string, IntoUniform>) => Material;
const shaderConstructors = new Map<string, ShaderConstructor>();
let fallbackMaterial: Material|null = null;

export function setFallbackMaterial(material: Material) {
  fallbackMaterial = material;
}

export function registerShaderType(
  shaderType: string, constructor: ShaderConstructor
) {
  shaderConstructors.set(shaderType, constructor);
}

function constructMaterial(
  shaderName: string, uniforms: Map<string, IntoUniform>
): Material {
  const constructor = shaderConstructors.get(shaderName);
  if (constructor)
    return constructor(uniforms);
  console.log(
    `No shader constructor was registered for this shader type: ${shaderName}`
  );
  console.assert(fallbackMaterial !== null);
  return fallbackMaterial!;
}


// Btoc mesh reader

export class BtocMeshReader {
  btoc: BtocFile;
  scene: SceneData;

  meshes = new Map<number, Mesh>();
  textures = new Map<number, Texture>();
  geometries = new Map<number, Geometry>();
  materials = new Map<number, Material>();

  constructor(btoc: BtocFile) {
    this.btoc = btoc;
    this.scene = JSON.parse(btoc.getText("root")) as SceneData;
  }

  public static async loadSceneFromURL(url: string): Promise<Node3D> {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Could not fetch BTOC file from “${url}”`);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return BtocMeshReader.loadScene(bytes);
  }

  public static loadScene(bytes: Uint8Array): Promise<Node3D> {
    const btoc = BtocFile.from(bytes);
    const loader = new BtocMeshReader(btoc);
    return loader.loadScene();
  }

  async loadScene(): Promise<Node3D> {
    return this.loadBranch(this.scene.nodes);
  }

  async loadBranch(node: NodeData): Promise<Node3D> {
    let result: Node3D;

    // Load the mesh if there is one, or create a basic Node3D
    if (node.mesh !== undefined) {
      const meshNode = new MeshNode3D(node.name)
      meshNode.mesh = await this.loadMesh(node.mesh);
      result = meshNode;
    } else result = new Node3D(node.name);

    // Set the transform
    if (node.transform !== undefined)
      // @ts-ignore Transform should probably have 16 numbers
      result.transform = new Matrix4(node.transform, false);

    // Load all the child branches (we try to do it simultaneously for `async`)
    const branches = await Promise.all(
      node.children.map(async child => await this.loadBranch(child))
    );
    for (const branch of branches)
      result.addChild(branch);

    return result;
  }


  // Mesh

  async loadMesh(meshId: number): Promise<Mesh> {
    return getCachedOrComputeAsync(
      meshId, this.meshes, i => this._loadMesh(i)
    );
  }

  async _loadMesh(meshId: number): Promise<Mesh> {
    const mesh = this.scene.meshes[meshId];
    console.assert(mesh.geometries.length === mesh.materials.length);

    const submeshes = [];
    for (let i = 0; i < mesh.geometries.length; i++) {
      const geometry = this.loadGeometry(mesh.geometries[i]);
      const material = await this.loadMaterial(mesh.materials[i]);
      submeshes.push(new Submesh(geometry, material));
    }

    return new Mesh(submeshes, mesh.name);
  }


  // Geometry

  loadGeometry(geometryId: number): Geometry {
    return getCachedOrCompute(
      geometryId, this.geometries, i => this._loadGeometry(i)
    );
  }

  _loadGeometry(geometryId: number): Geometry {
    const geometry = this.scene.geometries[geometryId];

    // Get the indices.
    let indexList: number[]|undefined = undefined;
    const indicesName = BtocMeshReader.getIndicesBufferName(geometryId);
    if (this.btoc.has(indicesName)) {
      const indexBytes = this.btoc.getBinary(indicesName);
      indexList = Array.from(new Uint16Array(indexBytes.buffer));
    }
    const indices =
      (indexList ? VertexBuffer.createIndexBuffer(indexList) : undefined);
    const indexCount = indexList?.length;

    // Get the vertices.
    if (geometry.attributes.length === 0) {
      throw new Error(
        "A submesh had no vertex attributes! The BTOC loader requires that a " +
        "submesh has at least one vertex attribute."
      );
    }

    let vertexCount = -1;
    const vertices = geometry.attributes.map(attribute => {
      const name = attribute[0];
      const bufferData = this.gatherVertexBufferData(geometryId, ...attribute);
      const count =
        (bufferData.data as number[]).length / bufferData.type.elemCount;

      if (vertexCount === -1)
        vertexCount = count;
      else console.assert(
        vertexCount === count,
        `The attribute “${name}” had ${count} ` +
        "vertices, but another attribute in the same submesh had " +
        `${vertexCount} vertices. All attributes in a mesh should have the ` +
        "same amount of vertices!"
      );

      const buffer = VertexBuffer.from(bufferData);
      return [name, buffer] as [string, VertexBuffer];
    });

    return new Geometry(vertexCount, vertices, indexCount, indices);
  }

  gatherVertexBufferData(
    geometryId: number, name: string, type: number,
    isNormalized: boolean|undefined
  ): IntoBufferObject {
    const binaryName = BtocMeshReader.getVertexBufferName(geometryId, name);
    const bytes = this.btoc.getBinary(binaryName);
    let data;

    if (isSupportedIntType(type)) {
      data = Array.from(new Int32Array(bytes.buffer));
    } else {
      console.assert(
        isSupportedFloatType(type),
        `The attribute “name” of geometry ${geometryId} had the invalid ` +
        `type ${type}.`
      );
      data = Array.from(new Float32Array(bytes.buffer));
    }

    return { type: GlType(type), data, isNormalized }
  }

  public static getIndicesBufferName(geometryId: number): string {
    return `geometries[${geometryId}].indices`;
  }

  public static getVertexBufferName(
    geometryId: number, attributeName: string
  ): string {
    return `geometries[${geometryId}].attributes["${attributeName}"]`;
  }


  // Material

  async loadMaterial(materialId: number): Promise<Material> {
    return getCachedOrComputeAsync(
      materialId, this.materials, i => this._loadMaterial(i)
    );
  }

  async _loadMaterial(materialId: number): Promise<Material> {
    const material = this.scene.materials[materialId];
    const uniforms = new Map<string, IntoUniform>();

    for (const name in material.uniforms) {
      if (!material.uniforms.hasOwnProperty(name))
        continue;
      const jsonValue = material.uniforms[name] as number[]|number;
      const value = (typeof(jsonValue) === "number" ?
        await this.loadTexture(jsonValue) : jsonValue);
      uniforms.set(name, value);
    }

    return constructMaterial(material.shaderName, uniforms);
  }


  // Texture

  async loadTexture(textureId: number): Promise<Texture> {
    return getCachedOrComputeAsync(
      textureId, this.textures, i => this._loadTexture(i)
    );
  }

  _loadTexture(textureId: number): Promise<Texture> {
    const name = BtocMeshReader.getTextureBufferName(textureId);
    const texture = this.scene.textures[textureId];
    const bytes = this.btoc.getBinary(name);
    return Texture.fromEncodedImage(bytes, texture.mimetype);
  }

  public static getTextureBufferName(textureId: number): string {
    return `textures[${textureId}]`;
  }
}
