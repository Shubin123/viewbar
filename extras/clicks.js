// main.js (Single file Electron app)

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// This will hold the main window reference
let mainWindow;

// Function to create the main browser window
function createWindow() {
  // Create the window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false, // Hide default window frame
    webPreferences: {
      nodeIntegration: true,  // Allow Node.js integration in the renderer process
      contextIsolation: false // Allow direct access to Node.js in renderer process
    }
  });

  // Load a blank page (you could load an HTML file, but we will create it in JavaScript)
  mainWindow.loadURL('about:blank'); // For a blank page, or use mainWindow.loadFile('index.html') if you use an HTML file

  // Open DevTools (optional, for debugging)
  mainWindow.webContents.openDevTools();

  // When the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This will run when the Electron app is ready
app.whenReady().then(() => {
  createWindow();

  // Add an event listener to listen for clicks and send messages to the main process
  mainWindow.webContents.executeJavaScript(`
    document.addEventListener('DOMContentLoaded', () => {
      // Create a draggable top bar
      var windowTopBar = document.createElement('div');
      windowTopBar.id = 'winTop';
      windowTopBar.style.width = '100%';
      windowTopBar.style.height = '32px';  // Set a fixed height
      windowTopBar.style.backgroundColor = '#000';
      windowTopBar.style.position = 'absolute';
      windowTopBar.style.top = '0';
      windowTopBar.style.left = '0';
      windowTopBar.style.webkitAppRegion = 'drag'; // Make it draggable
      windowTopBar.style.opacity = '1'; // Low opacity for transparency

      // Create a text label inside the top bar
      var dragLabel = document.createElement('span');
      dragLabel.innerText = 'Drag or Move this Window';
      dragLabel.style.color = '#fff'; // White text color
      dragLabel.style.fontFamily = 'Arial, sans-serif';
      dragLabel.style.fontSize = '14px'; // Default font size
      dragLabel.style.margin = 'auto'; // Center the text horizontally and vertically
      dragLabel.style.display = 'block'; // Make it a block-level element
      dragLabel.style.textAlign = 'center'; // Center the text
      dragLabel.style.lineHeight = '32px'; // Vertically center the text in the 32px high bar

      // Append the text label to the top bar
      windowTopBar.appendChild(dragLabel);

      // Append the top bar to the body
      document.body.appendChild(windowTopBar);

      // Expose dragLabel globally for easier access in event listener
      window.dragLabel = dragLabel;

      // Add click event listener to send IPC message and test font size change
      document.addEventListener('click', function(event) {
        console.log('Click event captured:', event.target);

        // Change the font size of the dragLabel element when clicked
        if (window.dragLabel) {
          console.log('Changing font size of dragLabel');
          window.dragLabel.style.fontSize = '1000px'; // Update the font size
        } else {
          console.log('dragLabel is not accessible at the time of click.');
        }

        // Send the click event to the main process via IPC
        if (window.isElectron && window.ipcRenderer) {
          console.log('Sending IPC message');
          window.ipcRenderer.send('element-clicked', {
            elementType: event.target.nodeName,
            elementId: event.target.id,
            elementClass: event.target.className
          });
        } else {
          console.log('IPC renderer is not available.');
        }
      });

      // Expose ipcRenderer globally for IPC communication
      const { ipcRenderer } = require('electron');
      window.isElectron = true;
      window.ipcRenderer = ipcRenderer;
    });
  `);

  // Listen for messages sent by renderer
  ipcMain.on('element-clicked', (event, data) => {
    console.log('Element clicked:', data); // Logs the data from renderer
  });
});

// Quit the app when all windows are closed (on macOS, this is different)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
