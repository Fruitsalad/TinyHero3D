import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript"
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import unassert from "rollup-plugin-unassert";
import { dts } from "rollup-plugin-dts";
import regexp from "rollup-plugin-regexp"

const name = "render_engine";

export default [
  // Normal build
  {
    input: "src/index.ts",
    output: [
      {
        name,
        format: "umd",
        file: "lib/render_engine.js",
        sourcemap: true
      },
      {
        name,
        format: "es",
        file: "lib/render_engine.es.js",
        sourcemap: true
      }
    ],
    plugins: [
      typescript({
        declaration: true,
        // The current version of rollup doesn't allow this to be any other dir:
        declarationDir: 'lib/',
        compilerOptions: {
          sourceMap: true
        }
      }),
      commonjs(),
      resolve()
    ]
  },

  // Minified build
  {
    input: "src/index.ts",
    output: [
      {
        name,
        format: "umd",
        file: "lib/render_engine.min.js"
      },
      {
        name,
        format: "es",
        file: "lib/render_engine.es.min.js"
      }
    ],
    plugins: [
      replace({ __IS_MINIFIED_BUILD__: true }),
      typescript({
        compilerOptions: {
          removeComments: true,
          declaration: false
        }
      }),
      commonjs(),
      resolve(),
      unassert(),
      terser(),

      // Typescript likes to emit Object.defineProperty unnecessarily when a
      // class is being constructed with some property that's undefined by
      // default (or null). We remove it for the sake of saving a few kilobytes.
      regexp({
        find: /Object\.defineProperty\(this,\s*"\w+",\s*\{[^({}]+value:\s*(void 0|null)\s*}\);/,
        replace: ''
      })
    ]
  },

  // Compile the folder of Typescript declaration files into a single file.
  {
    input: "./lib/index.d.ts",
    output: [
      { file: "lib/render_engine.d.ts", format: "es" },
      { file: "lib/render_engine.es.d.ts", format: "es" }
    ],
    plugins: [dts()],
  },
]