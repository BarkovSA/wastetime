const path = require('path');

module.exports = {
  mode: 'production',
  entry: './wasm-genplus/src/main/js/index.js',
  output: {
    filename: 'genplus.js',
    path: path.resolve(__dirname),
  },
  resolve: {
    fallback: {
      "fs": false,
      "path": require.resolve("path-browserify")
    }
  },
  experiments: {
    asyncWebAssembly: true,
  },
};