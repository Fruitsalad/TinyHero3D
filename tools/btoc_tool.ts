import * as path from "node:path";
import * as fs from "node:fs";
import {program} from "commander";
import {
  Texture as GltfTexture,
  Material as GltfMaterial
} from "@gltf-transform/core";
import {KHRMaterialsUnlit} from "@gltf-transform/extensions";
import {MaterialData} from "../src/extension/btoc/btoc_mesh";
import {convertGltfFileToBtoc} from "../src/extension/btoc/gltf_to_btoc";

program
  .name("btoc_tool")
  .description("A tool script for working with BTOC files.")
  .version("0.1.0")
program.command("from_gltf")
  .description("Convert a GLTF file into a BTOC mesh file.")
  .argument("<input>", "The GLTF file.")
  .option("-o, --out <output>", "The path where the BTOC file will be written to.")
  .action(fromGltf);
program.parse();


async function fromGltf(input: string, options: any): Promise<void> {
  const output = options.out ?? `./${path.parse(input).name}.mesh`;
  const absoluteOutput = path.resolve(output);
  console.log(`Converting GLTF “${input}” into BTOC mesh “${output}”...`);
  const btoc =
    await convertGltfFileToBtoc(input, [KHRMaterialsUnlit], loadMaterial);
  const buffer = Buffer.from(btoc.encodeAsBytes());
  fs.writeFileSync(output, buffer);

  const stat = fs.statSync(absoluteOutput);
  const size = toUserFriendlyFileSize(stat.size);

  console.log(`Done! Wrote a ${size} BTOC mesh to: ${absoluteOutput}`);
}

function loadMaterial(
  gltf: GltfMaterial|null,
  saveTexture: (tex: GltfTexture) => number
): MaterialData {
  if (!gltf)
    return { shaderName: "default", uniforms: {} };

  const tex = gltf.getBaseColorTexture();
  const uniforms = new Map<string, number[]|number>();
  if (tex)
    uniforms.set("color_texture", saveTexture(tex));

  if (gltf.getExtension(KHRMaterialsUnlit.EXTENSION_NAME))
    return {shaderName: "unlit", uniforms};
  return {shaderName: "default", uniforms};
}

function toUserFriendlyFileSize(size: number) {
  const units = ["byte", "kB", "MB", "GB", "TB"];

  for (let i = units.length-1; i >= 0; i--) {
    const unitSize = Math.pow(1000, i);
    const count = Math.floor((size / unitSize) * 10) / 10;
    if (count >= 1)
      return `${count} ${units[i]}`
  }

  return "zero byte";
}

