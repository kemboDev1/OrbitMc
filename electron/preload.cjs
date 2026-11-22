const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('sado', {
  platform: process.platform,
  appName: 'OrbitMc',
  version: process.env.npm_package_version || '1.0.0'
});