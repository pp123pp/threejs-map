module.exports = {
    productionSourceMap: false,
    publicPath: process.env.NODE_ENV === 'production' ? './' : './',
    /* 输出文件目录：在npm run build时，生成文件的目录名称 */
    outputDir: 'dist',
    // /* 放置生成的静态资源 (js、css、img、fonts) 的 (相对于 outputDir 的) 目录 */
    // assetsDir: 'assets'
    chainWebpack: config => {
        config.module
            .rule('raw')
            .test(/\.glsl$/)
            .use('raw-loader')
            .loader('raw-loader')
            .end();
    },
    pluginOptions: {
        'raw-loader': {
            preProcessor: 'glsl', // 声明类型
            patterns: [
            ]
            // injector: 'append'
        }
    }

};
