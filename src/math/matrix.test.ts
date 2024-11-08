import {Vec2, Vec2Tuple, vec3} from "./vec.ts";
import {Matrix3} from "./matrix.ts";

describe('Matrix3', () => {
  test('from & transform', () => {
    test_case([1, 0], [1, 1], [0, 0], [1, 0]);
    test_case([0, 0], [0, 0], [3, 4], [0, 0]);
    test_case([0, 0], [10, 10], [1, 2], [10, 20]);
    test_case([1, 1], [2, 0], [1, 1], [3, 1]);

    function test_case(
      translate: Vec2Tuple, scale: Vec2Tuple,
      input: Vec2Tuple, expected: Vec2Tuple
    ) {
      const matrix =
        Matrix3.TranslateScale2D(Vec2.from(translate), Vec2.from(scale));
      const actual = matrix.transform(vec3(Vec2.from(input), 1));
      expect(actual.x).toBe(expected[0]);
      expect(actual.y).toBe(expected[1]);
    }
  });
});
