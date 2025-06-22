import path from 'path';
import webpack from 'webpack'; // Added for ProvidePlugin
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { fileURLToPath } from 'url';

// Replicate __dirname functionality in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'development',
  entry: './src/main.js', // New entry point
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Clean the output directory before each build
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext][query]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext][query]'
        }
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html', // Use existing index.html as a template
      filename: 'index.html',
      inject: 'body', // Inject bundled script into the body
    }),
    new CopyWebpackPlugin({ // Added
      patterns: [
        {
          from: 'public',
          to: '.', // Copies to the root of the dist folder
          globOptions: {
            ignore: ['**/index.html', '**/uploads/**'], // index.html is handled by HtmlWebpackPlugin, uploads are dynamic
          },
        },
        {
          from: 'assets/images', // Copy existing static images if any not referenced by CSS/JS
          to: 'assets/images',
        },
        { // Added to copy sql-wasm.wasm
          from: 'node_modules/sql.js/dist/sql-wasm.wasm',
          to: 'wasm/sql-wasm.wasm', // Place it in a 'wasm' subdirectory in 'dist'
        }
      ],
    }),
    new webpack.ProvidePlugin({ // Added for jQuery
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery', // If some plugins expect it on window
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
    hot: true, // Enable Hot Module Replacement
  },
  resolve: {
    fallback: {
      "path": false, // No polyfill for path
      "os": false,   // No polyfill for os
      "fs": false,   // No polyfill for fs
      "http": false,
      "https": false,
      "child_process": false,
      "async_hooks": false, // for nedb, though we are removing it
      "crypto": false, // if any dependency needs it, can be 'crypto-browserify'
    }
  },
  // To make sql.js work with webpack
  experiments: {
    asyncWebAssembly: true,
  },
};
