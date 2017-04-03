'use strict';
const fs = require('fs');
const electron = require('electron');
const windowStateKeeper = require('electron-window-state');
const color = require('color');
const url = require('url');

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// List of allowed URL patterns to navigate in the app context
let whiteList = [];

// Escapes regular expression reserved symbols
function escapeRegex(str) {
    return ('' + str).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}

// Converts a string pattern to a regular expression
function convertPatternToRegex(pattern, excludeLineStart, excludeLineEnd) {
    var isNot = (pattern[0] === '!');
    if (isNot) { pattern = pattern.substr(1); }

    var regexBody = escapeRegex(pattern);

    excludeLineStart = !!excludeLineStart;
    excludeLineEnd = !!excludeLineEnd;

    regexBody = regexBody.replace(/\\\?/g, '.?').replace(/\\\*/g, '.*?');
    if (isNot) { regexBody = '((?!' + regexBody + ').)*'; }
    if (!excludeLineStart) { regexBody = '^' + regexBody; }
    if (!excludeLineEnd) { regexBody += '\/?$'; }

    return new RegExp(regexBody);
}

function configureWhitelist(manifest) {
    if (manifest && manifest.start_url) {

        // determine base rule based on the start_url and the scope
        var baseUrlPattern = manifest.start_url;
        if (manifest.scope && manifest.scope.length) {
            var parsedScopeUrl = url.parse(manifest.scope);
            if (parsedScopeUrl.protocol) {
              baseUrlPattern = manifest.scope;
            } else {
              baseUrlPattern = url.resolve(baseUrlPattern, manifest.scope);
            }
        }

        // If there are no wildcards in the pattern, add '*' at the end
        if (baseUrlPattern.indexOf('*') === -1) {
            baseUrlPattern = url.resolve(baseUrlPattern, '*');
        }

        // Add base rule to the whitelist
        whiteList.push(convertPatternToRegex(baseUrlPattern));

        var baseUrl = baseUrlPattern.substring(0, baseUrlPattern.length - 1);

        // Add additional navigation rules from mjs_access_whitelist
        // TODO: mjs_access_whitelist is deprecated. Should be removed in future versions
        if (manifest.mjs_access_whitelist && manifest.mjs_access_whitelist instanceof Array) {
            manifest.mjs_access_whitelist.forEach(function (item) {
                // To avoid duplicates, add the rule only if it does not have the base URL as a prefix
                if (item.url.indexOf(baseUrl) !== 0 ) {
                    // Add to the whitelist
                    whiteList.push(convertPatternToRegex(item.url));
                }
            });
        }

        // add additional navigation rules from mjs_extended_scope
        if (manifest.mjs_extended_scope && manifest.mjs_extended_scope instanceof Array) {
            manifest.mjs_extended_scope.forEach(function (item) {
                // To avoid duplicates, add the rule only if it does not have the base URL as a prefix
                if (item.indexOf(baseUrl) !== 0 ) {
                    // Add to the whitelist
                    whiteList.push(convertPatternToRegex(item));
                }
            });
        }
    }
}

function createWindow () {

  let manifest = fs.readFileSync(__dirname + '/../manifest.json');
  let manifestJson = JSON.parse(manifest);

  // Configure the navigation whitelist
  configureWhitelist(manifestJson);

  let mainWindowState = windowStateKeeper({
    defaultWidth: 1000,
    defaultHeight: 800
  });

  let browserWindowOptions = {
    'x': mainWindowState.x,
    'y': mainWindowState.y,
    'width': mainWindowState.width,
    'height': mainWindowState.height,
    'title': manifestJson.name || manifestJson.short_name,
    'webPreferences': {
      'nodeIntegration': false // Required to workaround issue to set jQuery globally in the pages (https://github.com/electron/electron/issues/254)
    }
  };

  if (manifestJson.background_color) {
    try {
      browserWindowOptions['backgroundColor'] = color(manifestJson.background_color).hexString();
    } catch(err) {
      // Failed to parse the background color
      console.error(err);
    }
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(browserWindowOptions);

  mainWindowState.manage(mainWindow);

  mainWindow.loadURL(manifestJson.start_url);

  const page = mainWindow.webContents;

  page.on('dom-ready', () => {
    mainWindow.show();
  });

  page.on('will-navigate', (e, url) => {
    for (var i = 0; i < whiteList.length; i++) {
      var rule = whiteList[i];
      if (!rule.test(url)) {
        e.preventDefault();
        electron.shell.openExternal(url);
        return;
      }
    }
  });

  mainWindow.on('page-title-updated', function(e) {
    // Prevent from automatically updating the window title to the page's title
    e.preventDefault();
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});