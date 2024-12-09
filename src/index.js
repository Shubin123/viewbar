const { app, BrowserWindow, TouchBar, nativeImage, globalShortcut } = require('electron');
const { spawn } = require('child_process');
var ffmpeg = require('ffmpeg-static'); // just gives path to the node_modules location for ffmpeg will get build with electron-packager.
const { log } = require('console');


// const drag = require('electron-drag');
// const mouse = require('osx-mouse')();  // Import osx-mouse and create an instance


let button;
let intervalId;
let mainWindow;
let ffmpegProcess;
let isProcessRunning = false;  // Process has finished or was terminated

let mousePos;



const { TouchBarButton } = TouchBar;
const frameWidth = 1000; // Set the frame size according to your video settings
const frameHeight = 60;
let crop = [frameWidth, frameHeight, 500, 500]; // 500,500, intial screen position

const ffmpegPath = ffmpeg; // Update this based on your actual path

let toggleOpacity = false// dont change this
let defaultOpacity = 0.1;
let clicked = false;


const DEBUG = true;


let moveTimeout;
// let isDebouncing = false; this just made debounce worse

// Function to create the main window
async function createWindow() {
  mainWindow = new BrowserWindow({
    // vibrancy:  'fullscreen-ui',
    frame: false,
    width: frameWidth, // setting these to 1, 1 will with frame false makes it litterally invis
    height: frameHeight,
    modal: true,
    alwaysOnTop: true, // Set this option to true
    webPreferences: {
      nodeIntegration: true, // not best sec practice
      contextIsolation: false, // Required for nodeIntegration 
    },
    // transparent: true,
  });
  mainWindow.setOpacity(defaultOpacity) // set to 1 if full opac is enabled

  mainWindow.setPosition(500, 500);
  // Create and set up the Touch Bar

  button = new TouchBarButton({
    backgroundColor: '#000000',
    icon: nativeImage.createFromBuffer(Buffer.alloc(0), { width: frameWidth, height: frameHeight }),
    iconPosition: 'center',
  });

  const touchBar = new TouchBar({
    items: [button],
  });

  mainWindow.setTouchBar(touchBar);


  // mainWindow.on('blur', () => { // buggy behaviour but it means we keep focus more often
  //   mainWindow.focus(); //really this should be reconsidered 
  // });

  mainWindow.on('resized', () => { // there is also 'resize' event many more calls while active
    logger("finished resize")
    resizeHandler()

  });

  // ipcMain.on('ping', (event) => {
  //   console.log('Top bar was clicked!');
  //   // You can do anything you want here based on the click event
  // });



  mainWindow.on('moved', () => {

    clearTimeout(moveTimeout);
    // Set a new timeout to emit the event once the window stops moving
    moveTimeout = setTimeout(() => {
      logger('Window has stopped moving');
      crop[0] = crop[0] + 10;
      [crop[2], crop[3]] = mainWindow.getPosition(); // descructing to change indices 2,3
      logger(crop);
      updateFilter(crop.toString().replaceAll(",", ":"))
      // isDebouncing = false;
      updateUserInterface();
      // You can place your emit function here
      // e.g., mainWindow.emit('moved-stopped')
    }, 500); // 200ms delay (adjust the time as needed)


  });



  // Load an HTML file or set the content
  mainWindow.loadURL('about:blank'); // You can replace this with an actual HTML file or URL
  mainWindow.webContents.on('did-finish-load', () => {
    // After the page is loaded, add the draggable top bar element
    InitUserInterface();
  });




  // mainWindow.setIgnoreMouseEvents(true, { forward: true });


  //   setInterval(() => { 
  //     if (mainWindow && !mainWindow.isFocused()) {
  //         mainWindow.focus();
  //     }
  // }, 100); // Check every 100 milliseconds

  delay(1000);
  startFfmpeg();

}

function resizeHandler() {

  mainWindow.focus();

  tog = true;
  let windowPos = mainWindow.getPosition()
  let windowSize = mainWindow.getSize();  // [width, height]  

  crop = [windowSize[0], windowSize[1], windowPos[0], windowPos[1]];
  crop[0] = crop[0] + 10;
  updateFilter(crop.toString().replaceAll(",", ":"));
  // console.log("resized to: ", crop);
  updateUserInterface();


}

function InitUserInterface() {
  // will make everything draggable and add the text/button UI
  mainWindow.webContents.executeJavaScript(`  
      // Create the draggable top bar
      var windowTopBar = document.createElement('div');
      windowTopBar.id = 'winTop';
      windowTopBar.style.width = "100%";
      windowTopBar.style.height = "100%";  // Set a fixed height
      windowTopBar.style.backgroundColor = "#000";
      windowTopBar.style.position = "absolute";
      windowTopBar.style.top = "0";
      windowTopBar.style.left = "0";
      windowTopBar.style.webkitAppRegion = "drag"; // Make it draggable
      windowTopBar.style.opacity = "1"; // Low opacity for transparency

      // Create a text label inside the top bar
      var dragLabel = document.createElement('span');
      dragLabel.innerText = "Drag or Move this Window";
      dragLabel.style.color = "#fff"; // White text color
      dragLabel.style.fontFamily = "Arial, sans-serif";
      dragLabel.style.fontSize = "14px"; // Default font size
      dragLabel.style.margin = "auto"; // Center the text horizontally and vertically
      dragLabel.style.display = "block"; // Make it a block-level element
      dragLabel.style.textAlign = "center"; // Center the text
      dragLabel.style.lineHeight = "32px"; // Vertically center the text in the 32px high bar

      // Append the text label to the top bar
      windowTopBar.appendChild(dragLabel);

      // Append the top bar to the body
      document.body.appendChild(windowTopBar);
  `);
}

function updateUserInterface() {
  mainWindow.webContents.executeJavaScript(`
      dragLabel.innerText = "height: ${crop[0]}, width: ${crop[1]}, x-pos: ${crop[2]}, y-pos: ${crop[3]}";
    `)
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function enumFfmpeg(callback) {
  function extractVideoDevices(output) {

    logger(output);
    // Regex to match content between 'AVFoundation video devices:' and 'AVFoundation audio devices:'
    const regex = /AVFoundation video devices:\s*([\s\S]*?)AVFoundation audio devices:/;
    const match = output.match(regex);


    if (match && match[1]) {
      // Split the matched video devices section into lines and filter them

      a = match[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('screen')); // Remove empty lines (THIS FILTER WILL MEAN NO OTHER DEVICE IS EVER USED)

      // console.log("a:", a);
      // console.log(a);      
      // return a[0][39]; // we only care about the device index 

      return a[0][39].toString();
      // [AVFoundation indev @ 0xffffffffffff] [2] Capture screen 0
      //                                        ^this 

      // maybe use another regex or something cleaner...


    }
  }


  // get the available devices and return the selected device (0 means device error)
  let tmp_devices_index = "uninit";

  const ffmpegProcess = spawn(ffmpegPath, [
    '-f', 'avfoundation',
    '-list_devices', 'true',
    '-i', '' // <- include this empty string dumb but works
  ]);


  ffmpegProcess.stderr.on('data', (error) => { // seen as error when we enum
    // console.log(error.toString())


    t = extractVideoDevices(error.toString());
    if (t == null) {

    } else {
      tmp_devices_index = t; // if NO devices is found during the enumeration we will have empty string
    }
    // console.log("tmpindex", tmp_devices_index);



  });

  // theres async across all this fucking enum function either i deal with it or just wait till proc closes (async might be a bit faster at retrival)

  return new Promise(resolve => {
    ffmpegProcess.on('close', function (code) {

      // if (callback) callback(tmp_devices_index);  // this callback method is a good approach it requires the caller to wrap itself when using the var so not as elgant (but no async req on caller) 
      resolve(tmp_devices_index);

    });

  });


}

async function startFfmpeg(dimension = "1010:60:500:500") { // caller async req from enumFfmpeg
  // Start ffmpeg to output raw MJPEG frames to stdout

  const screenIndex = await enumFfmpeg(); // this enum fails to get its place in reading stdout maybe wait for now just fallback to device id 0
  // const screenIndex = 0; if the enum for whatever reason just fails

  logger("screenINDX", screenIndex)

  ffmpegProcess = spawn(ffmpegPath, [
    '-f', 'avfoundation',
    '-capture_cursor', '1', // Capture the mouse cursor
    '-capture_mouse_clicks', '1', // Enable mouse click capture
    // '-framerate', '60', // Frame rate
    '-i', screenIndex,
    '-vf', `fps=60,crop=${dimension}, scale=1000:30:flags=lanczos`, // Centered capture ; consider crop=x1:y1:x2:y2 where _1 indicates size _2 is position. keep in mind size + position (leq) screen size for the program to run

    // '-c:v', 'libx264', // Use libx264 for video encoding (H.264)
    // '-preset', 'placebo', // Use ultrafast preset for faster encoding (adjust as needed for performance vs quality)
    '-crf', '1', // Use CRF to control quality (lower is better quality)

    '-f', 'mjpeg',
    'pipe:1' // Output to stdout
  ]);
  isProcessRunning = true;
  processFFMPEG(ffmpegProcess);

}

function processFFMPEG(ffmpegProcess) {
  ffmpegProcess;
  ffmpegProcess.stdout.on('data', (data) => {
    const img = nativeImage.createFromBuffer(data, {
      width: frameWidth,
      height: frameHeight,
    });
    button.icon = img; // Update the Touch Bar button icon

  });

  if (DEBUG == true) {
    ffmpegProcess.stderr.on('data', (error) => { // seen as error when we enum
      logger(error.toString());
    });
  }

  ffmpegProcess.on('close', () => {
    // console.log('FFmpeg process ended.');
    isProcessRunning = false;  // Process has finished or was terminated

  });


  ffmpegProcess.on('exit', (code) => {
    isProcessRunning = false;  // Process has finished or was terminated

    // console.log(`Parent process exited with code ${code}`);
  });

}
const updateFilter = (newCropArgs) => {
  // spawn new one in first !!! 

  startFfmpeg(newCropArgs);

  safeKillProcess(ffmpegProcess, isProcessRunning); /// remember to kill!!!

};

app.whenReady().then(() => {



  // globalShortcut.register('CommandOrControl+e', () => {
  //   // console.log('Starting playback... (OFF)');
  //   // startFfmpeg();

  //   // mainWindow.setSize(0,0);
  //   mainWindow.setOpacity(0.5);
  //   mainWindow.focus();
  //   // console.log(windowSize[0]);
  //   if (tog) {
  //     console.log(`window already hidden (option 1 unhide) (option 2 unhide show partial) (option 3 do nothing)`);
  //     mainWindow.setOpacity(1);
  //     // mainWindow.setSize(Math.floor(crop[0]/2),  Math.floor(crop[1]/2));
  //     updateFilter(crop.toString().replaceAll(",", ":"));
  //     tog = false;
  //   }
  //   else {
  //     tog = true;
  //     let windowPos = mainWindow.getPosition()
  //     let windowSize = mainWindow.getSize();  // [width, height]  
  //     console.log('update');
  //     crop = [windowSize[0], windowSize[1], windowPos[0], windowPos[1]];
  //     updateFilter(crop.toString().replaceAll(",", ":"));
  //   }
  // });

  globalShortcut.register('e', () => {
    // updateFilter(crop.toString().replaceAll(",", ":"))
    mainWindow.focus();
  });


  globalShortcut.register('CommandOrControl+t', () => {
    // opac = toggleOpacity ? 0.5 : 0; 
    mainWindow.setOpacity(toggleOpacity ? defaultOpacity : 0);
    toggleOpacity = !toggleOpacity;
  });

  // globalShortcut.register('CommandOrControl+y', () => {

  //   ffmpegProcess.kill("SIGTERM")
  // });

  createWindow();
});

app.on('quit', () => {
  // console.log("all windows closed remember to close ffmpeg subproc")
  safeKillProcess(ffmpegProcess)
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

function safeKillProcess(process) {
  if (isProcessRunning) {
    logger('Killing the process...');
    process.kill('SIGKILL');  // Force kill the process
    isProcessRunning = false; // After killing, mark as not running
  } else {
    logger('Process is already closed, cannot kill.');
  }

}

function logger(...Params)
{
  if (DEBUG)
  {
    console.log(Params)
  } 
}