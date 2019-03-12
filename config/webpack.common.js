const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')

module.exports = {
    entry: {
        app: './src/HyparViewComponent.ts'
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
    plugins: [
        new CleanWebpackPlugin()
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'hypar-aec.js',
        path: path.resolve(__dirname, '../dist')
    }
}

