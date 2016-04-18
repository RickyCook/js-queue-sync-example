var path = require('path')
var webpack = require('webpack')

module.exports = {
    //devtool: 'eval',
    devtool: 'source-map',
    entry: {
        'bundle': ['./fe.js', 'webpack-hot-middleware/client'],
    },
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
        publicPath: '/'
    },
    resolve: {
        extensions: ['', '.js']
    },
    plugins: [
        new webpack.optimize.OccurrenceOrderPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoErrorsPlugin()
    ],
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'raw',
                exclude: /node_modules/,
                include: '.'
            }]
    }
}
