import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript"
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import unassert from "rollup-plugin-unassert";
import { dts } from "rollup-plugin-dts";
import regexp from "rollup-plugin-regexp"


function create_normal_build(name, input_file) {
  return {
    input: input_file,
    output: [
      {
        name,
        format: "umd",
        file: `lib/${name}/${name}.js`,
        sourcemap: true
      },
      {
        name,
        format: "es",
        file: `lib/${name}/${name}.es.js`,
        sourcemap: true
      }
    ],
    plugins: [
      typescript({
        declaration: true,
        // The current version of rollup doesn't allow this to be any other dir:
        declarationDir: `lib/${name}/`,
        compilerOptions: {
          sourceMap: true
        }
      }),
      commonjs(),
      resolve()
    ]
  }
}

function create_minified_build(name, input_file) {
  return {
    input: input_file,
    output: [
      {
        name,
        format: "umd",
        file: `lib/${name}/${name}.min.js`
      },
      {
        name,
        format: "es",
        file: `lib/${name}/${name}.es.min.js`
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
  }
}

function create_typescript_declaration_files(name, declaration_root) {
  return {
    input: declaration_root,
    output: [
      { file: `lib/${name}/${name}.d.ts`, format: "es" },
      { file: `lib/${name}/${name}.es.d.ts`, format: "es" }
    ],
    plugins: [dts()]
  };
}

function bundle(name) {
  const input_file = `./src/bundles/${name}.ts`;
  const typescript_root = `./lib/${name}/bundles/${name}.d.ts`;
  return [
    create_normal_build(name, input_file),
    create_minified_build(name, input_file),
    create_typescript_declaration_files(name, typescript_root)
  ];
}


export default [
  ...bundle("full"),
  ...bundle("core"),
  ...bundle("unlit3D")
]