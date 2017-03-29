'use strict';
const fs = require('fs');
const path = require('path');
const electron = require('electron');
const windowStateKeeper = require('electron-window-state');
const color = require('color');

// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {

  let manifest = fs.readFileSync(__dirname + '/../manifest.json');
  let manifestJson = JSON.parse(manifest);

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
      console.error(err)
    }
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(browserWindowOptions);

  mainWindowState.manage(mainWindow);

  mainWindow.loadURL(manifestJson.start_url)

  const page = mainWindow.webContents;

  page.on('dom-ready', () => {
    mainWindow.show();
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
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})