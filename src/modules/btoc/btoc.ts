/* Binary table-of-contents, a small simple file format for putting several
 * names binary fragments into one file. There's also some convenience functions
 * for reading and writing text.
 *
 * A file is structured as follows:
 *   start_of_table_of_contents: u64,  // This points to the address of `count`
 *   binaries: Binary[count],
 *   count: u64,
 *   table_of_contents: Entry[count]
 *
 *   struct Entry {
 *     name_length: u8,
 *     name: utf8char[name_length],
 *     start: u64,
 *     end: u64
 *   }
 *
 *   struct Binary {
 *     data: u8[entry.end - entry.start]
 *   }
 */

export class BtocFile {
  public entries: Map<string, Uint8Array> = new Map<string, Uint8Array>();

  public constructor() {}

  public static from(bytes: Uint8Array) {
    const btoc = new BtocFile();
    btoc.entries = BtocFile._read(bytes);
    return btoc;
  }

  public static async fromBlob(blob: Blob): Promise<BtocFile> {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return BtocFile.from(bytes);
  }

  public static async fromUrl(url: string): Promise<BtocFile> {
    const result = await fetch(url);
    const blob = await result.blob();
    return BtocFile.fromBlob(blob);
  }

  public setBinary(name: string, binary: Uint8Array) {
    console.assert(!this.entries.has(name));
    this.entries.set(name, binary);
  }

  public setText(name: string, text: string) {
    const encoder = new TextEncoder();
    const binary = encoder.encode(text);
    this.setBinary(name, binary);
  }

  public has(name: string): boolean {
    return this.entries.has(name);
  }

  public getBinary(name: string): Uint8Array {
    return this.entries.get(name)!;
  }

  public getText(name: string): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(this.entries.get(name)!);
  }

  static _read(bytes: Uint8Array): Map<string, Uint8Array> {
    const result = new Map<string, Uint8Array>();
    const tocStart = readU64(bytes, 0);
    const count = readU64(bytes, tocStart);
    const decoder = new TextDecoder('utf-8');
    let cursor = tocStart + 8;

    for (let i = 0; i < count; i++) {
      const nameLength = bytes[cursor];
      const nameStart = cursor + 1;
      const nameEnd = nameStart + nameLength;
      const nameBytes = bytes.slice(nameStart, nameEnd);
      const name = decoder.decode(nameBytes);

      const start = readU64(bytes, nameEnd);
      const end = readU64(bytes, nameEnd + 8);
      const entryBytes = bytes.slice(start, end);

      result.set(name, entryBytes);
      cursor = nameEnd + 16;
    }

    return result;
  }

  public encodeAsBytes(): Uint8Array {
    // Count the length of the file.
    const encoder = new TextEncoder();
    let binariesSize = 0;
    let entriesSize = 0;
    const entries = [];

    for (const [name, bytes] of this.entries) {
      const nameUTF8 = encoder.encode(name);
      binariesSize += bytes.length;
      entriesSize += 17 + nameUTF8.length;
      entries.push([nameUTF8, bytes]);
    }

    // Allocate the file.
    const allocSize = binariesSize + entriesSize + 16;
    const result = new Uint8Array(allocSize);

    // Write the global constants.
    const tocStart = binariesSize + 8;
    writeU64(result, 0, tocStart);  // start_of_table_of_contents
    writeU64(result, tocStart, entries.length);  // count

    // Write the per-entry data.
    let binaryCursor = 8;
    let entryCursor = tocStart + 8;

    for (const [name, bytes] of entries) {
      if (name.length > 255) {
        console.error(`This name is too long for a btoc file: “${name}”`);
        continue;
      }

      // Write the binary.
      const binaryEnd = binaryCursor + bytes.length;
      for (let i = 0; i < bytes.length; i++)
        result[binaryCursor+i] = bytes[i];

      // Write the entry.
      result[entryCursor] = name.length;
      for (let i = 0; i < name.length; i++)
        result[entryCursor+1+i] = name[i];
      const nameEnd = entryCursor + 1 + name.length;
      writeU64(result, nameEnd, binaryCursor);
      writeU64(result, nameEnd+8, binaryEnd);

      binaryCursor = binaryEnd;
      entryCursor = nameEnd+16;
    }

    return result;
  }
}

function readU64(bytes: Uint8Array, start: number): number {
  let number = bytes[start+7];
  for (let i = 0; i < 7; i++)
    number |= (bytes[start+i] << ((7-i)*8));
  return number;
}

function writeU64(bytes: Uint8Array, start: number, value: number) {
  for (let i = 0; i < 8; i++)
    bytes[start+i] = (value >> ((7-i)*8));
}
