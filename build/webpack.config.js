const path = require('path');
const webpack = require('webpack');
const TerserJSPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const StylelintPlugin = require('stylelint-webpack-plugin');
//const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
//const AntdDayjsWebpackPlugin = require('antd-dayjs-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlReplaceWebpackPlugin = require('html-replace-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const pathsConfig = require('./path.config');
const {vendors} = require(path.join(pathsConfig.rootPath, './package.json'));
const {env, prodModel} = pathsConfig;
const {clientGlobal, serverGlobal, clientPublicPath} = require(path.join(pathsConfig.envPath, './env'));
const lessVars = require(path.join(pathsConfig.srcPath, 'assets/css/antd-vars.js'));
const fileName = '[name].[hash:8]';

clientGlobal.production = prodModel;

const htmlReplace = [
  {
    pattern: '$$ClientGlobal$$',
    replacement: JSON.stringify(clientGlobal),
  },
  {
    pattern: '$$ServerGlobal$$',
    replacement: JSON.stringify(serverGlobal),
  },
  {
    pattern: '$$ClientPublicPath$$',
    replacement: clientPublicPath,
  },
  {
    pattern: '$$Title$$',
    replacement: clientGlobal.siteName,
  },
];
const generateScopedName = (localName, fileName) => {
  if (fileName.match(/[/\\]assets[/\\]css[/\\]global.m.\w+?$/)) {
    return 'g-' + localName;
  }
  fileName = fileName
    .replace(pathsConfig.srcPath, '')
    .replace(/\W/g, '-')
    .replace(/^-|-index-m-\w+$|-m-\w+$/g, '')
    .replace(/^components-/, 'comp-')
    .replace(/^modules-.*?(\w+)-views(-?)(.*)/, '$1$2$3')
    .replace(/^modules-.*?(\w+)-components(-?)(.*)/, '$1-comp$2$3');
  return localName === 'root' ? fileName : fileName + '_' + localName;
};
const getLocalIdent = (context, localIdentName, localName) => {
  return generateScopedName(localName, context.resourcePath);
};

const cssLoader = (enableCssModule, ssr) => {
  return [
    !ssr &&
      (prodModel
        ? {
            loader: MiniCssExtractPlugin.loader,
          }
        : {loader: 'style-loader'}),
    {
      loader: 'css-loader',
      options: {
        importLoaders: ssr ? 1 : 2,
        onlyLocals: ssr,
        modules: enableCssModule
          ? {
              //localIdentName: '[path][name]_[local]',
              getLocalIdent,
              context: pathsConfig.srcPath,
            }
          : false,
      },
    },
    !ssr && 'postcss-loader',
    {
      loader: 'less-loader',
      options: {
        javascriptEnabled: true,
        modifyVars: lessVars,
      },
    },
    {
      loader: 'sass-resources-loader',
      options: {
        resources: [path.join(pathsConfig.srcPath, 'assets/css/vars.less')],
      },
    },
  ].filter(Boolean);
};

const clientConfig = {
  name: 'client',
  mode: prodModel ? 'production' : 'development',
  devtool: prodModel ? 'cheap-module-source-map' : 'cheap-module-eval-source-map',
  entry: [path.join(pathsConfig.srcPath, './client')],
  output: {
    path: pathsConfig.distPath,
    filename: `client/js/${fileName}.js`,
    chunkFilename: `client/js/${fileName}.chunk.js`,
    publicPath: clientPublicPath,
    // Point sourcemap entries to original disk location (format as URL on Windows)
    devtoolModuleFilenameTemplate: (info) => path.relative(pathsConfig.srcPath, info.absoluteResourcePath).replace(/\\/g, '/'),
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx'],
    modules: [...pathsConfig.moduleSearch, 'node_modules'],
    alias: {
      ...pathsConfig.moduleAlias,
    },
  },
  optimization: prodModel
    ? {
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            styles: {
              name: 'styles',
              test: /[\\/]node_modules[\\/].+\.(css|less)$/,
              enforce: true,
            },
            css: {
              name: 'css',
              test: /[\\/]src[\\/].+\.(css|less)$/,
              enforce: true,
            },
            ...Object.keys(vendors).reduce((prev, cur) => {
              prev[cur] = {
                name: cur,
                test: new RegExp('[\\\\/]node_modules[\\\\/](' + vendors[cur].join('|') + ')'),
                priority: 1,
              };
              return prev;
            }, {}),
          },
        },
        minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})],
        // minimize: true,
      }
    : {},
  stats: {chunkModules: false},
  performance: false,
  module: {
    strictExportPresence: true,
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        include: pathsConfig.moduleSearch,
        loader: 'source-map-loader',
      },
      {
        test: /\.(tsx|ts)?$/,
        include: pathsConfig.moduleSearch,
        use: [
          {loader: require.resolve('@medux/dev-utils/dist/webpack-loader/module-hot-loader')},
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              plugins: [!prodModel && require.resolve('react-refresh/babel')].filter(Boolean),
              caller: {runtime: 'client'},
            },
          },
          {loader: 'eslint-loader', options: {cache: true}},
        ],
      },
      {
        test: /\.less$/,
        exclude: /\.m\.less$/,
        //include: pathsConfig.moduleSearch,
        use: cssLoader(false),
      },
      {
        test: /\.m\.less$/,
        include: pathsConfig.moduleSearch,
        use: cssLoader(true),
      },
      {
        test: /\.css$/,
        use: [
          prodModel
            ? {
                loader: MiniCssExtractPlugin.loader,
              }
            : {loader: 'style-loader'},
          {
            loader: 'css-loader',
          },
          'postcss-loader',
        ],
      },
      {
        test: /\.(gif|png|jpe?g|svg)$/,
        loader: 'file-loader',
        options: {
          name: `client/media/${fileName}.[ext]`,
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        loader: 'file-loader',
        options: {
          name: `client/media/${fileName}.[ext]`,
        },
      },
      {
        test: /\.md$/,
        loader: 'raw-loader',
      },
    ],
  },
  plugins: [
    // new webpack.DefinePlugin({
    //   'process.env.RUNTIME_ENV': 'CLIENT',
    // }),
    new HtmlWebpackPlugin({
      minify: false,
      template: path.join(pathsConfig.publicPath, './index.html'),
      title: clientGlobal.siteName,
    }),
    new HtmlReplaceWebpackPlugin(htmlReplace),
    prodModel &&
      new MiniCssExtractPlugin({
        ignoreOrder: true,
        filename: `client/css/${fileName}.css`,
      }),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    //new AntdDayjsWebpackPlugin(),
    new StylelintPlugin({files: 'src/**/*.less', cache: true}),
    !prodModel && new ReactRefreshWebpackPlugin({overlay: false}),
    !prodModel && new webpack.HotModuleReplacementPlugin(),
    env === 'analyzer' && new BundleAnalyzerPlugin({generateStatsFile: true}),
    //new HardSourceWebpackPlugin(),
    new webpack.ProgressPlugin(),
  ].filter(Boolean),
};

const serverConfig = {
  name: 'server',
  mode: prodModel ? 'production' : 'development',
  target: 'node',
  bail: true,
  devtool: false,
  performance: false,
  entry: [path.join(pathsConfig.srcPath, './server')],
  output: {
    libraryTarget: 'commonjs2',
    path: pathsConfig.distPath,
    filename: 'server/[name].js',
    chunkFilename: 'server/[name].chunk.js',
    publicPath: '/',
    // Point sourcemap entries to original disk location (format as URL on Windows)
    devtoolModuleFilenameTemplate: (info) => path.relative(pathsConfig.srcPath, info.absoluteResourcePath).replace(/\\/g, '/'),
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx'],
    modules: [pathsConfig.srcPath, 'node_modules'],
    alias: {
      ...pathsConfig.moduleAlias,
    },
  },
  optimization: {
    minimize: false,
    runtimeChunk: false,
    splitChunks: {
      chunks: 'initial',
      cacheGroups: {
        vendors: false,
      },
    },
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.(tsx|ts)?$/,
        include: pathsConfig.moduleSearch,
        use: [
          {
            loader: require.resolve('@medux/dev-utils/dist/webpack-loader/server-replace-async'),
            options: {modules: ['app', 'adminLayout', 'articleLayout', 'articleHome', 'articleAbout', 'articleService']},
          },
          {loader: 'babel-loader', options: {cacheDirectory: true, caller: {runtime: 'server'}}},
        ],
      },
      {
        test: /\.(less|css)$/,
        exclude: /\.m\.less$/,
        loader: 'null-loader',
      },
      {
        test: /\.m\.less$/,
        include: pathsConfig.moduleSearch,
        use: cssLoader(true, true),
      },
      {
        test: /\.(gif|png|jpe?g|svg)$/,
        loader: 'file-loader',
        options: {
          name: `client/media/${fileName}.[ext]`,
        },
      },
      {
        test: /\.md$/,
        loader: 'raw-loader',
      },
    ],
  },
  plugins: [
    // new webpack.DefinePlugin({
    //   'process.env.RUNTIME_ENV': 'SERVER',
    // }),
    new webpack.ProgressPlugin(),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
  ],
};

module.exports = [clientConfig, serverConfig];