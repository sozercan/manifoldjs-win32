'use strict';

var constants = {
  platform: {
    id: 'win32',
    name: 'Windows Desktop Platform',
    type: 'win32',
    arch: process.env.npm_config_arch || 'x64',
    preferredIconSizes: [ '256x256', '48x48', '32x32', '16x16' ]
  }
};

module.exports = constants;
