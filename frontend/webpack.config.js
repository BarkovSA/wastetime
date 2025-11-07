const path = require('path');

module.exports = {
  entry: './js/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
    wasmLoading: 'fetch'
  },
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true
  },
  resolve: {
    fallback: {
      fs: false,
      path: false,
      crypto: false
    },
    alias: {}
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.wasm$/,
        type: 'webassembly/async'
      },
      {
        test: /\.(bin|gen|smc|nes)$/,
        type: 'asset/resource'
      }
    ]
  },
  devServer: {
    static: {
      directory: path.join(__dirname),
      staticOptions: {
        setHeaders: (res, path) => {
          if (path.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
        }
      }
    },
    compress: true,
    port: 80,
    host: '0.0.0.0',
    historyApiFallback: true,
    devMiddleware: {
      writeToDisk: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        pathRewrite: {'^/api': '/api'},
        secure: false,
        changeOrigin: true
      },
      '/roms': {
        target: 'http://backend:5000',
        pathRewrite: {'^/roms': '/roms'},
        secure: false,
        changeOrigin: true
      }
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    }
  }
};