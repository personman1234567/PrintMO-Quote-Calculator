require('dotenv').config()
const { app, BrowserWindow, ipcMain } = require('electron')
// const Store = require('electron-store');
// const store = new Store();
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 900,
    icon: path.join(__dirname, 'assets', 'Calculator.ico'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ipcMain.handle('get-ss-creds', () => {
//   return {
//     user: store.get('ssUser'),
//     pass: store.get('ssPass')
//   };
// });

// ipcMain.handle('set-ss-creds', (_, { user, pass }) => {
//   store.set('ssUser', user);
//   store.set('ssPass', pass);
//   return true;
// });