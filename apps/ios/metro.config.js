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
    // @ledgerhq/devices uses package exports to map ./ble/* → ./lib/ble/*.
    // With exports disabled we must redirect manually.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@ledgerhq/devices/')) {
        const sub = moduleName.slice('@ledgerhq/devices/'.length);
        return {
          filePath: path.resolve(
            workspaceRoot,
            'node_modules/@ledgerhq/devices/lib',
            sub + '.js',
          ),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
