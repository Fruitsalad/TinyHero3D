# TinyHero3D

### A truly tiny Typescript/Javascript rendering engine for WebGL1.

- Less than 12 kB (minified and GZipped)
- Entirely WebGL1: Works on almost any device, even cheap old ones!
- Zero external dependencies. Only a browser with WebGL is required!
- Library-style API, not game-engine-style — you're in control of the main loop.
- Easy-to-use scene trees, similar to Godot game engine.
- Lambertian lighting.
- Uses its own binary mesh format. It comes with a command line tool for converting GLTF files into `.mesh` files.
- Custom GLSL shaders & uniforms are 100% supported. For uniforms, you can either set uniforms for the whole scene, for a material or for a specific scene tree node.
- Supports using non-standard vertex attributes (please do note that WebGL only supports attributes with `int` or `float` elements)
- Features a small matrix & vector math library, designed to be easy to work with.
- The unminified core API features lots & lots of assertions, and goes out of its way to help you find usage errors and explain what went wrong clearly.

A rendering engine this tiny helps to make 3D hero elements much more viable!
As long as you make sure your mesh doesn't have too many triangles,
adding a 3D model to your website should be performant,
even on the cheapest mobile phones.

For cheap mobile phones,
you should be thinking of 3D models with less than ten thousand triangles.
And if your 3D models aren't always moving,
ideally only rerender the scene when necessary, for example only rerender after
you just moved something in the scene.

#### Please note!

Currently, I'm developing TinyHero3D for personal use, so it's not on NPM!
***If you'd be interested in using this as an end-user,
please send me a message***,
and I'll see if I can fix it up a little bit to make it more appropriate for
wider use (mainly it needs some better documentation, but it's also still
missing cross products & external products because I haven't needed
them yet, skinned meshes, and most importantly PBR shading).

![A short video of a 3D model](./doc/cottage.gif)

*The video's pretty choppy because it had to be a GIF of less than 10 MB —
the framerate was originally smooth, I swear!*


### Build instructions

To build this library, download this repository to your computer and run the
following commands:
```shell
npm install
npm run build

# If you want to see the examples in motion:
npm run examples
```
Once built, the bundles can be found in the `/lib/` subdirectory (which appears
after building).
For more information on bundles, see the section below.


### Bundles

To help keep this library small, I provide several different bundles, which each
provide a different subset of the library's full functionality.

| Bundle           | Functionality                                                                                                                                                                                                                                     | Minified | Minified & Gzipped |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------------------|
| **unlit3D**      | 3D rendering without lighting. This provides a 3D scene tree and several unlit shaders (flat color, vertex colors & textured). Good for stylized models! Also includes everything in **core**.                                                    | 36.9 kB  | 10.8 kB            |
| **lambertian3D** | Point lights, directional lights, Lambertian shaders & a 3D scene tree.  Also includes everything in **core**.                                                                                                                                    | 40.4 kB  | 11.8 kB            |
| **core**         | Convenient abstractions over WebGL: Meshes, vertex buffers, shaders, materials and uniforms. It has a very generalized design that can work just fine with both 2D & 3D. Also includes matrix and vector math, but does not include a scene tree! | 24.5 kB  | 7.8 kB             |
| **full**         | Everything in the aforementioned bundles, as well as GLTF imports.                                                                                                                                                                                | 117.7 kB | 32.4 kB            |

Bundles can be found in the `/lib/` subdirectory after building.
Out of the files you'll find there,
you most likely want to use the file that ends with `.es.min.js` for production
builds, and the file that ends with `.es.js` for developer builds.
Besides a Javascript module build, a UMD build is also provided.
These `.js` files are entirely self-contained,
with no external dependencies except for a browser that supports WebGL,
so you can copy the file over to your own project folder if you prefer.
Typescript users should also copy the appropriate `.d.ts` file
(probably the one that ends with `.es.d.ts`).


### Mesh import

TinyHero3D uses its own binary `.mesh` file format for 3D models.
Importing GLTF files at runtime is also supported,
but is not included in most builds
because the GLTF library approximately triples the build sizes.
The `.mesh` file importer is tiny and included in all of the 3D bundles.

To turn a GLTF file into a `.mesh` file, you can use the `npm run mesh`
command line tool.
Just run the following command:
```shell
npm run mesh from_gltf ./wherever/you/put/your_mesh.gltf
```
And `your_mesh.mesh` will pop out in the current working directory.
