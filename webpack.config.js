const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/HyparViewComponent.js',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: path.join(__dirname, 'test'),
    watchContentBase: true,
    compress: true,
    port: 9000,
    index: "index.html",
    inline: true,
    hot: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'hypar-aec.js',
    path: path.resolve(__dirname, 'dist')
  }
};