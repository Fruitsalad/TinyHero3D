import {BtocFile} from "./btoc.ts";
import {BtocMeshReader, NodeData, SceneData} from "./btoc_mesh.ts";
import {isSupportedFloatType, isSupportedIntType} from "../core.ts";


export class BtocMeshWriter {
  data: SceneData = {
    nodes: { name: "root", children: [] },
    meshes: [],
    geometries: [],
    materials: [],
    textures: []
  }
  btoc = new BtocFile();

  constructor() {}

  public setScene(newScene: NodeData) {
    this.data.nodes = newScene;
  }

  public finish(): BtocFile {
    const json = JSON.stringify(this.data);
    this.btoc.setText("root", json);
    return this.btoc;
  }


  // Mesh

  public addMesh(
    name: string, geometries: number[], materials: number[]
  ): number {
    const id = this.data.meshes.length;
    this.data.meshes.push({name, geometries, materials});
    return id;
  }


  // Geometry

  public getNextGeometryId() {
    return this.data.geometries.length;
  }

  public addGeometry(attributes: [string, number, boolean?][]) {
    this.data.geometries.push({attributes});
  }

  addIndexBuffer(geometryId: number, numbers: number[]) {
    const indicesName = BtocMeshReader.getIndicesBufferName(geometryId);
    const bytes = new Uint8Array(new Uint16Array(numbers).buffer);
    this.btoc.setBinary(indicesName, bytes);
  }

  addVertexBuffer(
    geometryId: number, attributeName: string, type: GLenum, numbers: number[]
  ) {
    const binaryName =
      BtocMeshReader.getVertexBufferName(geometryId, attributeName);

    let bytes;
    if (isSupportedIntType(type))
      bytes = new Uint8Array(new Int32Array(numbers).buffer);
    else {
      console.assert(
        isSupportedFloatType(type),
        `The attribute “name” of geometry ${geometryId} had the invalid ` +
        `type ${type}.`
      );
      bytes = new Uint8Array(new Float32Array(numbers).buffer);
    }

    this.btoc.setBinary(binaryName, bytes);
  }


  // Material

  public addMaterial(
    shaderName: string, uniforms: Map<string, number[]|number>
  ): number {
    const id = this.data.materials.length;
    let uniformObject: any = {};
    for (const [name, value] of uniforms)
      uniformObject[name] = value;
    this.data.materials.push({ shaderName, uniforms: uniformObject });
    return id;
  }


  // Texture

  public async addTextureFromBlob(blob: Blob): Promise<number> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return this.addTexture(bytes, blob.type);
  }

  public addTexture(bytes: Uint8Array, mimetype: string): number {
    const id = this.data.textures.length;
    const bufferName = BtocMeshReader.getTextureBufferName(id);
    this.btoc.setBinary(bufferName, bytes);
    this.data.textures.push({mimetype});
    return id;
  }
}
