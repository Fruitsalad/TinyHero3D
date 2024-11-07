export class Vec<T> {
  elems: number[] = [0];

  // This is never used, but it's here so that Typescript considers Vec2 as
  // being a different type than Vec3 (it makes their structures dissimilar).
  _typescript_junk?: T;

  // XYZW getters & setters
  get x() { return this.elems[0]; }
  get y() { return this.elems[1]; }
  get z() { return this.elems[2]; }
  get w() { return this.elems[3]; }
  set x(value) { this.elems[0] = value; }
  set y(value) { this.elems[1] = value; }
  set z(value) { this.elems[2] = value; }
  set w(value) { this.elems[3] = value; }

  // RGBA getters & setters (just like in GLSL)
  get r() { return this.elems[0]; }
  get g() { return this.elems[1]; }
  get b() { return this.elems[2]; }
  get a() { return this.elems[3]; }
  set r(value) { this.elems[0] = value; }
  set g(value) { this.elems[1] = value; }
  set b(value) { this.elems[2] = value; }
  set a(value) { this.elems[3] = value; }

  // Very basic swizzling
  get xy() { return new Vec2(this.x, this.y); }
  get xyz() { return new Vec3(this.x, this.y, this.z); }
  get rg() { return this.xy; }
  get rgb() { return this.xyz; }


  // Construct & clone

  public constructor(elems: number[]) {
    this.elems = elems;
  }

  public clone(): Vec<T> {
    return new Vec<T>([...this.elems]);
  }

  // Run an element-wise operation on two vectors, or a vector and a number.
  public join(b: Vec<T> | number, fn: (a:number,b:number)=>number): Vec<T> {
    const result = [...this.elems];
    if (typeof(b) === "number")
      for (let i = 0; i < this.elems.length; i++)
        result[i] = fn(this.elems[i], b);
    else for (let i = 0; i < this.elems.length; i++)
      result[i] = fn(this.elems[i], b.elems[i]);
    return new Vec<T>(result);
  }


  // Arithmetic

  public add(b: Vec<T> | number): Vec<T> { return this.join(b, (a,b) => a+b); }
  public sub(b: Vec<T> | number): Vec<T> { return this.join(b, (a,b) => a-b); }
  public mult(b: Vec<T> | number): Vec<T> { return this.join(b, (a,b) => a*b); }
  public div(b: Vec<T> | number): Vec<T> { return this.join(b, (a,b) => a/b); }

  public static div<T>(a: Vec<T>|number, b: Vec<T>): Vec<T> {
    return b.join(a, (b,a) => a/b);
  }

  public dot(b: Vec<T>): number {
    return this.mult(b).elems.reduce((sum, value) => sum + value);
  }

  public equals(b: Vec<T>): boolean {
    for (let i = 0; i < this.elems.length; i++)
      if (this.elems[i] !== b.elems[i])
        return false;
    return true;
  }


  // Misc operations

  public static min<U>(a: Vec<U>, b: Vec<U> | number): Vec<U> {
    return a.join(b, Math.min);
  }
  public static max<U>(a: Vec<U>, b: Vec<U> | number): Vec<U> {
    return a.join(b, Math.max);
  }

  public square_length(): number {
    return this.elems.reduce((sum, n) => sum + n*n);
  }
  public length(): number {
    return Math.sqrt(this.square_length());
  }

  public normalized(): Vec<T> {
    return this.div(this.length());
  }
}


// These types are used to make Vec2, Vec3 and Vec4 structurally dissimilar.
export class N2 { n2 = null; }
export class N3 { n3 = null; }
export class N4 { n4 = null; }


// The main vector types.

export type Vec2Tuple = [number, number];
export type Vec3Tuple = [number, number, number];

export class Vec2 extends Vec<N2> {
  public constructor(x: number, y: number) {
    super([x, y]);
  }

  public static from(obj: {x: number, y: number} | Vec2Tuple): Vec2 {
    if (Array.isArray(obj))
      return new Vec2(obj[0], obj[1]);
    return new Vec2(obj.x, obj.y);
  }

  public static from_size(obj: {width: number, height: number}): Vec2 {
    return new Vec2(obj.width, obj.height);
  }

  public static Random(): Vec2 {
    return new Vec2(Math.random(), Math.random());
  }
}

export class Vec3 extends Vec<N3> {
  public constructor(x: number, y: number, z: number) {
    super([x, y, z]);
  }

  public static from(obj: {x: number, y: number, z: number} | Vec3Tuple): Vec3 {
    if (Array.isArray(obj))
      return new Vec3(obj[0], obj[1], obj[2]);
    return new Vec3(obj.x, obj.y, obj.z);
  }

  public static Random(): Vec3 {
    return new Vec3(Math.random(), Math.random(), Math.random());
  }
}

export class Vec4 extends Vec<N4> {
  public constructor(x: number, y: number, z: number, w: number) {
    super([x, y, z, w]);
  }
}


// GLSL-style constructors

export function vec2(x: number, y?: number): Vec2 {
  if (y === undefined)
    return new Vec2(x, x);
  return new Vec2(x, y);
}

export function vec3(a: number | Vec2, b?: number, c?: number): Vec3 {
  if (typeof a === "number") {
    if (b === undefined)
      return new Vec3(a, a, a);
    return new Vec3(a, b, c!);
  }
  console.assert(c === undefined);
  return new Vec3(a.x, a.y, b!);
}

export function vec4(
  a: number | Vec3 | Vec2, b?: number, c?: number, d?: number
): Vec4 {
  if (typeof a === "number") {
    if (b === undefined)
      return new Vec4(a, a, a, a);
    return new Vec4(a, b, c!, d!);
  }
  console.assert(d === undefined);
  if (c === undefined)
    return new Vec4(a.x, a.y, a.z, b!);
  return new Vec4(a.x, a.y, b!, c);
}
