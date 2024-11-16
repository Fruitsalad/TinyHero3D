import {vec2, Vec2, Vec2Tuple, Vec3Tuple, vec3, vec4, Vec3} from "./vec.ts";
import {Matrix3, Matrix4} from "./matrix.ts";

describe("Matrix3", () => {
  test("TranslateScale2D & transform", () => {
    test_case(Matrix3.TranslateScale2D(vec2(1,0), vec2(1)), [0, 0], [1, 0]);
    test_case(Matrix3.TranslateScale2D(vec2(0), vec2(0)), [3, 4], [0, 0]);
    test_case(Matrix3.TranslateScale2D(vec2(0), vec2(10)), [1, 2], [10, 20]);
    test_case(Matrix3.TranslateScale2D(vec2(1), vec2(2,0)), [1, 1], [3, 1]);
    test_case(Matrix3.Rotate2D(Math.PI/2), [3,1], [-1,3]);
    test_case2(
      Matrix3.RotateScale3D(vec3(0,Math.PI/2,0), vec3(5,6,7)),
      [3,2,1], [7,12,-15]
    );

    function test_case(matrix: Matrix3, input: Vec2Tuple, expected: Vec2Tuple) {
      const actual = matrix.transform(vec3(Vec2.from(input), 1));
      const squareError = actual.xy.sub(Vec2.from(expected)).squareLength();
      expect(squareError).toBeLessThan(0.0001);
    }

    function test_case2(
      matrix: Matrix3, input: Vec3Tuple, expected: Vec3Tuple
    ) {
      const actual = matrix.transform(Vec3.from(input));
      const squareError = actual.sub(Vec3.from(expected)).squareLength();
      expect(squareError).toBeLessThan(0.0001);
    }
  });

  test("Invert", () => {
    test_case(Matrix3.Rotate3D(vec3(0,Math.PI/2,0)), vec3(1,2,3));
    test_case(
      Matrix3.RotateScale3D(vec3(0,Math.PI/2,Math.PI/3), vec3(4,5,6)),
      vec3(1,2,3)
    );

    function test_case(
      matrix: Matrix3, input: Vec3
    ) {
      const transformed = matrix.transform(input);
      const inverse = Matrix3.invert(matrix);
      const actual = inverse.transform(transformed);
      const squareError = actual.sub(input).squareLength();
      expect(squareError).toBeLessThan(0.0001);
    }
  })
});

describe("Matrix4", () => {
  test("AffineInvert", () => {
    test_case(
      Matrix4.TranslateScale3D(vec3(1,0,0), vec3(1)), vec3(0)
    );
    test_case(Matrix4.TranslateScale3D(vec3(0), vec3(10)), vec3(1,2,0));
    test_case(
      Matrix4.TranslateScale3D(vec3(4,5,6), vec3(2,1,10)), vec3(1,2,3)
    );
    test_case(Matrix4.Rotate3D(vec3(0,Math.PI/2,0)), vec3(1,2,3));
    test_case(
      Matrix4.TRS3D(vec3(1), vec3(0,Math.PI/2,Math.PI/3), vec3(1)), vec3(1,2,3)
    );

    function test_case(
      matrix: Matrix4, input: Vec3
    ) {
      const transformed = matrix.transform(vec4(Vec3.from(input), 1));
      const inverseMatrix = Matrix4.affineInvert(matrix);
      const actual = inverseMatrix.transform(transformed);
      const squareError = actual.xyz.sub(input).squareLength();
      expect(squareError).toBeLessThan(0.0001);
    }
  });

})