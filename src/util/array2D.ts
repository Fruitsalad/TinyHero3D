import {Vec2} from "../math/vec";

export default class Array2D<T> {
  public elems: T[] = [];
  public width: number;

  get height() { return Math.floor(this.elems.length / this.width); }


  // Constructors & clone

  public constructor(width: number, elems: T[]) {
    console.assert(elems.length % width === 0);
    this.elems = elems;
    this.width = width;
  }
  public clone() {
    return new Array2D(this.width, [...this.elems]);
  }


  // Getters & setters

  public get(a: Vec2|number, b?: number): T {
    return this.elems[this.pos_to_index(a, b)];
  }
  public set(a: Vec2|number, b: T|number, c?: T) {
    this.elems[this.pos_to_index(a, b as number)] = (c ?? b) as T;
  }

  public overwrite_partially(arr: Array2D<T>, xStart = 0, yStart = 0) {
    const height = arr.height;
    const width = arr.width;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        this.set(x+xStart, y+yStart, arr.get(x,y));
  }


  // Conversion between coordinate & index position

  public pos_to_index(x: Vec2|number, y?: number): number {
    if (typeof(x) === "number")
      return Array2D._pos_to_index(x, y!, this.width);
    return Array2D._pos_to_index(x.x, x.y, this.width);
  }
  public static _pos_to_index(x: number, y: number, width: number): number {
    return x + y*width;
  }
  public static index_to_pos(i: number, width: number): Vec2 {
    return new Vec2(i % width, Math.floor(i / width));
  }
}