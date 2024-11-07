import Array2D from "../util/array2D";
import {N2, N3, N4, Vec, vec2, Vec2, vec3, Vec3} from "./vec";

export class Matrix<T> {
  // Note that we implicitly transpose all of the operations because it makes
  // OpenGL happy to receive the elements in that order.
  public elems: Array2D<number>;

  // This is never used, but it's here so that Typescript considers Vec2 as
  // being a different type than Vec3 (it makes their structures dissimilar).
  _typescript_junk?: T;

  // Constructors & clone

  public constructor(elems: Array2D<number>) {
    this.elems = elems;
  }

  public clone(): Matrix<T> {
    return new Matrix<T>(this.elems.clone());
  }


  // Element getters & setters

  public get(pos: Vec2): number {
    return this.elems.get(pos.y, pos.x);
  }
  public get2(x: number, y: number): number {
    return this.elems.get(y, x);
  }

  public set(pos: Vec2, value: number) {
    return this.elems.set(pos.y, pos.x, value);
  }
  public set2(x: number, y: number, value: number) {
    return this.elems.set(y, x, value);
  }


  // Operations

  public mult(b: Matrix<T>): Matrix<T> {
    const w = this.elems.width;
    const new_width = b.elems.width;
    const new_height = this.elems.height;

    if (w != b.elems.height)
      throw new Error("Matrices can't be multiplied together :(");

    const result = new Array(new_width * new_height);
    for (let x = 0; x < new_width; x++) {
      for (let y = 0; y < new_height; y++) {
        let value = 0;
        for (let i = 0; i < w; i++)
          value += this.get2(i, y) * b.get2(x, i);
        result[y + x*new_height] = value;
      }
    }

    return new Matrix<T>(new Array2D<number>(new_width, result));
  }

  public scalarMultInPlace(b: number) {
    for (let i = 0; i < this.elems.elems.length; i++)
      this.elems.elems[i] *= b;
  }

  public transform<U>(b: Vec<U>): Vec<U> {
    const w = this.elems.width;

    console.assert(
      w === this.elems.height,
      "Transformation matrices have to be square."
    );
    if (w != b.elems.length)
      throw new Error("Matrix and vector can't be multiplied together :(");

    const result = new Array(this.elems.height);
    for (let y = 0; y < this.elems.height; y++) {
      let value = 0;
      for (let i = 0; i < w; i++)
        value += this.get2(i, y) * b.elems[i];
      result[y] = value;
    }

    return new Vec<U>(result);
  }

  public transposed(): Matrix<T> {
    const copy = [...this.elems.elems];
    const result = new Matrix<T>(new Array2D<number>(this.elems.height, copy));

    for (let y = 0; y < this.elems.height; y++)
      for (let x = 0; x < this.elems.width; x++)
        result.elems.set(y, x, this.elems.get(x, y));

    return result;
  }

  public transpose() {
    this.elems = this.transposed().elems;
  }
}


// The main matrix types.

export class Matrix2 extends Matrix<N2> {
  public static readonly identity: Matrix2 = new Matrix2([
    1, 0,
    0, 1
  ]);

  public constructor(
    elems: [
      number,number,
      number,number
    ]
  ) {
    super(new Array2D<number>(2, elems));
  }
}


export class Matrix3 extends Matrix<N3> {
  public static readonly identity: Matrix3 = new Matrix3([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ], false);

  public constructor(
    elems: [
      number,number,number,
      number,number,number,
      number,number,number
    ],
    transpose = true
  ) {
    super(new Array2D<number>(3, elems));
    if (transpose)
      this.transpose();
  }

  // Create a transformation that scales, rotates and translates.
  public static TRS2D(translate: Vec2, radians: number, scale: Vec2) {
    return Matrix3.Translate2D(translate)
      .mult(Matrix3.Rotate2D(radians))
      .mult(Matrix3.Scale2D(scale));
  }

  public static TranslateScale2D(translate: Vec2, scale: Vec2): Matrix3 {
    const t = translate;
    const s = scale;
    return new Matrix3([
      s.x, 0,   0,
      0,   s.y, 0,
      t.x, t.y, 1
    ], false);
  }

  public static Translate2D(translate: Vec2): Matrix3 {
    return Matrix3.TranslateScale2D(translate, vec2(1));
  }

  public static Scale2D(scale: Vec2): Matrix3 {
    return Matrix3.TranslateScale2D(vec2(0), scale);
  }

  public static Rotate2D(radians: number): Matrix3 {
    return Matrix3.AxisAlignedRotation(2, radians);
  }

  public static fromEulerAngles(euler: Vec3): Matrix3 {
    const yaw = Matrix3.AxisAlignedRotation(1, euler.y);
    const pitch = Matrix3.AxisAlignedRotation(0, euler.x);
    const roll = Matrix3.AxisAlignedRotation(2, euler.z);
    return roll.mult(pitch.mult(yaw));
  }

  public static AxisAlignedRotation(axis: number, radians: number): Matrix3 {
    const result = Matrix3.identity.clone();
    const x1 = (axis+1) % 3;
    const x2 = (axis+2) % 3;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    result.set2(x1, x1, cos);
    result.set2(x2, x2, cos);
    result.set2(x1, x2, sin);
    result.set2(x2, x1, -sin);
    return result;
  }


  // These have to be static because otherwise Matrix<N3> != Matrix3

  public static setTranslation(m: Matrix3, tl: Vec2) {
    m.set2(2, 0, tl.x);
    m.set2(2, 1, tl.y);
  }

  public static setScaleWithoutRotation(m: Matrix3, tl: Vec2) {
    m.set2(0, 0, tl.x);
    m.set2(1, 1, tl.y);
    m.set2(0, 1, 0);
    m.set2(1, 0, 0);
  }

  public static invert(m: Matrix3) {
    // See https://www.geeksforgeeks.org/inverse-of-3x3-matrix/
    // Note that this specific function is also meant to be safe with a Matrix4
    const adjoint = Matrix3.getAdjointMatrix(m);
    const determinant =
      adjoint.get2(0,0)*m.get2(0,0) +
      adjoint.get2(1,0)*m.get2(1,0) +
      adjoint.get2(2,0)*m.get2(2,0);
    const inverseDeterminant = 1/determinant;
    console.assert(
      Number.isFinite(inverseDeterminant),
      "Matrix3.invert was run on a matrix that doesn't have an inverse!"
    );
    adjoint.scalarMultInPlace(inverseDeterminant);
    m.elems.overwrite_partially(adjoint.elems, 0, 0);
  }

  public static getAdjointMatrix(m: Matrix3): Matrix3 {
    // Note that this function is also meant to be safe with a Matrix4
    const f = Matrix3.co;
    return new Matrix3([
      f(m,1,1, 2,2), f(m,1,2, 2,0), f(m,1,0, 2,1),
      f(m,2,1, 0,2), f(m,2,2, 0,0), f(m,2,0, 0,1),
      f(m,0,1, 1,2), f(m,0,2, 1,0), f(m,0,0, 1,1)
    ], false);
  }

  // This calculates a cofactor (which is the determinant of a 2x2 submatrix)
  static co(m:Matrix3, x1:number, y1:number, x2:number, y2:number): number {
    return m.get2(x1,y1)*m.get2(x2,y2) - m.get2(x2,y1)*m.get2(x1,y2);
  }
}


export class Matrix4 extends Matrix<N4> {
  public static readonly identity: Matrix4 = new Matrix4([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);

  public constructor(
    elems: [
      number,number,number,number,
      number,number,number,number,
      number,number,number,number,
      number,number,number,number
    ],
    transpose = true
  ) {
    super(new Array2D<number>(4, elems));
    if (transpose)
      this.transpose();
  }

  // Create a transformation that scales, rotates and translates.
  public static TRS3D(translate: Vec3, euler: Vec3, scale: Vec3): Matrix4 {
    return Matrix4.Translate3D(translate)
      .mult(Matrix4.Rotate3D(euler))
      .mult(Matrix4.Scale3D(scale));
  }

  public static TranslateScale3D(translate: Vec3, scale: Vec3): Matrix4 {
    const t = translate;
    const s = scale;
    return new Matrix4([
      s.x, 0,   0,   0,
      0,   s.y, 0,   0,
      0,   0,   s.z, 0,
      t.x, t.y, t.z, 1
    ], false);
  }

  public static Translate3D(translate: Vec3): Matrix4 {
    return Matrix4.TranslateScale3D(translate, vec3(1));
  }

  public static Scale3D(scale: Vec3): Matrix4 {
    return Matrix4.TranslateScale3D(vec3(0), scale);
  }

  public static Rotate3D(euler: Vec3): Matrix4 {
    const rotation = Matrix3.fromEulerAngles(euler);
    const result = Matrix4.identity.clone();
    result.elems.overwrite_partially(rotation.elems);
    return result;
  }

  public static setTranslation(m: Matrix4, tl: Vec3) {
    m.set2(3, 0, tl.x);
    m.set2(3, 1, tl.y);
    m.set2(3, 2, tl.z);
  }

  public static getTranslation(m: Matrix4): Vec3 {
    return new Vec3(m.get2(3,0), m.get2(3,1), m.get2(3,2));
  }

  public static setScaleWithoutRotation(m: Matrix4, s: Vec3) {
    m.set2(0, 0, s.x);
    m.set2(1, 1, s.y);
    m.set2(2, 2, s.z);
  }

  public static invert3DTransform(m: Matrix4) {
    console.assert(m.get2(3,3) === 1);
    Matrix3.invert(m as unknown as Matrix3);
    const inverse_translation = Matrix4.getTranslation(m).mult(-1);
    Matrix4.setTranslation(m, inverse_translation);
  }
}

