import { app, BrowserWindow } from 'electron';
import { Tray, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//tray
let tray;

function createTray(win) {
    tray = new Tray(path.join(__dirname, '../public/favicon.ico'));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Abrir', type: 'normal', click: () => win.show() },
        { label: 'Encerrar', type: 'normal', click: () => app.quit() },
    ]);
    tray.setToolTip('Tanamao Hub');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        win.show();
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    createTray(win);

    // win.loadFile('index.html');
    win.loadURL('http://localhost:4201');

    win.on('close', (e) => {
        e.preventDefault();
        win.hide();
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
