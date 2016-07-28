'use strict';

var path = require('path'),
    util = require('util'),
    Q = require('q'),
    fs = require('fs');

var manifoldjsLib = require('manifoldjs-lib');

var CustomError = manifoldjsLib.CustomError,
    PlatformBase = manifoldjsLib.PlatformBase,
    manifestTools = manifoldjsLib.manifestTools,
    fileTools = manifoldjsLib.fileTools;

var constants = require('./constants');

var packager = require('electron-packager');
var npm = require("npm");
var converter = require('image-to-icon-converter');

function Platform (packageName, platforms) {

  var self = this;
  var manifestFilePath;
  var name;

  PlatformBase.call(this, constants.platform.id, constants.platform.name, packageName, __dirname);

  // save platform list
  self.platforms = platforms;

  // override create function
  self.create = function (w3cManifestInfo, rootDir, options, callback) {
    if (w3cManifestInfo.format !== manifoldjsLib.constants.BASE_MANIFEST_FORMAT) {
      return Q.reject(new CustomError('The \'' + w3cManifestInfo.format + '\' manifest format is not valid for this platform.'));
    }

    self.info('Generating the ' + constants.platform.name + ' app...');

    // if the platform dir doesn't exist, create it
    var platformDir = path.join(rootDir, constants.platform.id);
    var sourceTemplateDir = path.join(self.baseDir, 'template');
    var targetTemplateDir = path.join(platformDir, 'template');   

    self.debug('Creating the ' + constants.platform.name + ' app folder...');
    return fileTools.mkdirp(platformDir)
      // download icons to the app's folder
      .then(function () {
        return self.downloadIcons(w3cManifestInfo.content, w3cManifestInfo.content.start_url, platformDir);
      })
      .then(function() {
        //converting png to icns
        var iconLength = w3cManifestInfo.content.icons.length;
        var iconSrc = w3cManifestInfo.content.icons[iconLength-1].src;
        var iconFileName = iconSrc.substr(iconSrc.lastIndexOf("/") + 1);

        var stream = fs.createReadStream(platformDir + '/images/' + iconFileName);
        stream.on('error', function (error) {console.log(error);})
        stream.on('readable', function () {
          converter.uploadConvertDownload(stream, 'ico')
          .then(function(result) {
            return result.pipe(fs.createWriteStream(platformDir+'/images/app.ico'));
          })
        });
      })
      //copy the electron app template
      .then(function () {
          return fileTools.copyFolder(sourceTemplateDir, targetTemplateDir)
          .catch(function (err) {
            return Q.reject(new CustomError('Failed to copy the project template to the source folder.', err));
          });
      })
      // copy the documentation
      .then(function () {
        return self.copyDocumentation(platformDir);
      })      
      // write generation info (telemetry)
      .then(function () {
        return self.writeGenerationInfo(w3cManifestInfo, platformDir);
      })
      // persist the platform-specific manifest
      .then(function () {
        self.debug('Copying the ' + constants.platform.name + ' manifest to the app folder...');
        manifestFilePath = path.join(platformDir, 'manifest.json');
        return manifestTools.writeToFile(w3cManifestInfo, manifestFilePath);
      })
      .then(function() {
        var packageFilePath = path.join(platformDir, '/template/package.json');

        fs.readFile(packageFilePath, 'utf8', function (err,data) {
          if (err) {
            return self.debug(err);
          }
          name = w3cManifestInfo.content.short_name.replace(/ /g,'');
          var result = data.replace(/replace/g, name);

          fs.writeFile(packageFilePath, result, 'utf8', function (err) {
            if (err) { 
              return self.debug(err);
            }
            else  {
                self.debug('Generating ' + constants.platform.name + ' package');

                npm.load({
                    loaded: false
                }, function (err) {
                    // installing dependencies
                    var deps = ["electron-prebuilt@^1.2.0","electron-window-state@^3.0.3"];

                    npm.commands.install(targetTemplateDir, deps, function (er, data) {
                        packager({
                            name: name,
                            dir: platformDir+'/template',
                            arch: constants.platform.arch,
                            platform: constants.platform.type,
                            out: platformDir+'/out',
                            prune: true,
                            icon: platformDir+'/images/app.ico',
                            overwrite: true
                        }, function done (err, appPath) {
                          if(!err) {
                            var p = path.join(platformDir
                            ,'/out/'
                            ,name
                            +'-'
                            +constants.platform.type
                            +'-'
                            +constants.platform.arch
                            +'/resources/manifest.json');

                            fs.createReadStream(manifestFilePath).pipe(fs.createWriteStream(p));
                          }
                          else{
                            self.debug(error);
                          }
                        });
                    });
                });
            }
          });
        })
      })
      .nodeify(callback);
  };
  
  self.getManifestIcons = function (manifest) {
    return (manifest.icons || []).map(function (icon) { return icon.src; });
  };

  self.getManifestIcon = function (manifest, size) {
    size = size.trim().toLowerCase();
    return (manifest.icons || []).find(function (icon) {
      return icon.sizes.split(/\s+/).find(function (iconSize) { 
        return iconSize.toLowerCase() === size; 
      });
    });
  };

  self.addManifestIcon = function (manifest, fileName, size) {
    if (!manifest.icons) {
      manifest.icons = [];
    }
    
    manifest.icons.push({ 'src': fileName, 'sizes': size.toLowerCase().trim()});
  };
}

util.inherits(Platform, PlatformBase);

module.exports = Platform;