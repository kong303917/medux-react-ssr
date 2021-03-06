const chalk = require('chalk');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const path = require('path');
const pathsConfig = require('./path.config');
require('asset-require-hook')({
  extensions: ['jpg', 'jpeg', 'png', 'gif'],
});
const webpackConfig = require('./webpack.config');
const devServerConfig = require('./webpackDevServer.config');
const {baseConf} = require(path.join(pathsConfig.rootPath, './package.json'));
const {server} = require(path.join(pathsConfig.envPath, './env'));

const [, , port] = server.split(/:\/*/);

webpackConfig[0].entry.unshift(`webpack-dev-server/client?http://0.0.0.0:${port}`, 'webpack/hot/dev-server');

function clearConsole() {
  process.stdout.write(process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H');
}

const compiler = webpack(baseConf.ssr ? webpackConfig : webpackConfig[0]);

const devServer = new WebpackDevServer(compiler, devServerConfig);
devServer.listen(port, '0.0.0.0', (error) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  clearConsole();
  console.info(chalk`...starting {red development server} on {green ${server}/} \n`);
  return null;
});
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    devServer.close();
    process.exit();
  });
});