const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // xrpl 3.x ships ESM; disable package exports to force CJS resolution
    unstable_enablePackageExports: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
