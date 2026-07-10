const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

ipcMain.handle("directory:select", async (event) => {
  const options = {
    title: "저장소 폴더 선택",
    buttonLabel: "선택",
    properties: ["openDirectory"],
  };
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const directoryPath = result.filePaths[0];
  return {
    name: path.basename(directoryPath),
    path: directoryPath,
  };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    title: "FactoryScribe",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
