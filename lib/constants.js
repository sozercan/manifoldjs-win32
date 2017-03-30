'use strict';

var constants = {
  platform: {
    id: 'win32',
    name: 'Windows Desktop Platform',
    type: 'win32',
    arch: process.env.npm_config_arch || 'x64'
  }
};

module.exports = constants;
