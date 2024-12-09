// early version 
// no rescaling / repositioning
// operates as a standalone version of the program
// need to provide the path of ffmpeg binary
// does not use ffmpeg from node, harder to build into .app container...

const { app, BrowserWindow, TouchBar, nativeImage, globalShortcut } = require('electron');
const { spawn } = require('child_process');

let button;
let intervalId;
let mainWindow;

const { TouchBarButton } = TouchBar;
const frameWidth = 1085; // Set the frame width according to your video settings
const frameHeight = 30; // Set the frame height according to your video settings

const ffmpegPath = './ffmpeg'; // Update this based on your desired path
// Get the path to the app's Resources directory

const DEBUG = false;

// Function to create the main window
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1,
    height: 1,
    modal: true,
    alwaysOnTop: true, // Set this option to true
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Required for nodeIntegration
    },
  });

  // Create and set up the Touch Bar
  // may be unnecessary (can be done after ffmpeg initializes)
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


  //   setInterval(() => { 
  //     if (mainWindow && !mainWindow.isFocused()) {
  //         mainWindow.focus();
  //     }
  // }, 100); // Check every 100 milliseconds


  startFfmpeg();

}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function enumFfmpeg(callback) {


  function extractVideoDevices(output) {


    // Regex to match content between 'AVFoundation video devices:' and 'AVFoundation audio devices:'
    const regex = /AVFoundation video devices:\s*([\s\S]*?)AVFoundation audio devices:/;
    const match = output.match(regex);

    console.log(output);
    if (match && match[1]) {
      // Split the matched video devices section into lines and filter them

      a = match[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('screen')); // Remove empty lines (THIS FILTER WILL MEAN NO OTHER DEVICE IS EVER USED)

      console.log(a);
      // console.log(a);      
      // return a[0][39]; // we only care about the device index 
      return a[0][39].toString();
      // [AVFoundation indev @ 0xfffffff] [2] Capture screen 0
      //                                   ^this 

      // maybe use another regex or something cleaner...


    }
  }


  // get the available devices and return the selected device (0 means device error)
  let tmp_devices_index = "";

  const ffmpegProcess = spawn(ffmpegPath, [
    '-f', 'avfoundation',
    '-list_devices', 'true',
    '-i', '' // <- include this empty string dumb but works
  ]);

  let iter_devices = 0;
  ffmpegProcess.stderr.on('data', (error) => { // seen as error when we enum

    if (iter_devices == 3) {
      tmp_devices_index = extractVideoDevices(error.toString());
    }
    console.log(tmp_devices_index);
    iter_devices += 1;
  });


  // theres async across all this fucking enum function either i deal with it or just wait till proc closes (async might be a bit faster at retrival)

  return new Promise(resolve => {
    ffmpegProcess.on('close', function (code) {

      // if (callback) callback(tmp_devices_index);  // this callback method is a good approach it requires the caller to wrap itself when using the var so not as elgant (but no async req on caller) 
      resolve(tmp_devices_index);

    });

  });


}


async function startFfmpeg() { // caller async req from enumFfmpeg
  // Start ffmpeg to output raw MJPEG frames to stdout

  const FALLBACK_screenIndex = await enumFfmpeg(); 
  const screenIndex = 0;

  console.log(screenIndex)

  // const ffmpegProcess = spawn('ffmpeg', [
  //   '-f', 'avfoundation',
  //   '-framerate', '10',
  //   '-i', '2',
  //   '-vf', 'fps=60,scale=2170:60',
  //   '-f', 'mjpeg',
  //   'pipe:1' // Output to stdout
  // ]);

  // const ffmpegProcess = spawn(ffmpegPath, [
  //   '-f', 'avfoundation',
  //   '-framerate', '10', // Increased frame rate for better quality
  //   '-i', '0',
  //   '-vf', 'fps=60,scale=1085:30:flags=lanczos', // Use lanczos scaling for better quality
  //   '-f', 'mjpeg',
  //   'pipe:1' // Output to stdout
  // ]);

  const ffmpegProcess = spawn(ffmpegPath, [
    '-f', 'avfoundation',
    '-capture_cursor', '1', // Capture the mouse cursor
    '-capture_mouse_clicks', '1', // Enable mouse click capture
    '-framerate', '60', // Frame rate
    '-i', screenIndex,
    '-vf', 'fps=60,crop=1085:30:500:500, scale=1085:30:flags=lanczos', // Centered capture ; consider crop=x1:y1:x2:y2 where _1 indicates size _2 is position. keep in mind size + position (leq) screen size for the program to run
    '-f', 'mjpeg',
    'pipe:1' // Output to stdout
  ]);

  // const ffmpegProcess = spawn(ffmpegPath, [
  //   '-f', 'avfoundation',
  //   '-framerate', '1', // Frame rate
  //   '-video_size', '1085x30', // Specify the desired video size directly
  //   '-i', '0',
  //   '-vf', 'fps=1,scale=1085:30:flags=lanczos', // Use scaling without cropping
  //   '-f', 'mjpeg',
  //   'pipe:1' // Output to stdout
  // ]);

  processFFMPEG(ffmpegProcess)


}

function processFFMPEG(ffmpegProcess) {

  ffmpegProcess.stdout.on('data', (data) => {

    const img = nativeImage.createFromBuffer(data, {
      width: frameWidth,
      height: frameHeight,
    });
    button.icon = img; // Update the Touch Bar button icon

  });

  if (DEBUG == true) {
    ffmpegProcess.stderr.on('data', (error) => { // seen as error when we enum
      console.log(error.toString());
    });
  }

  ffmpegProcess.on('close', () => {
    console.log('FFmpeg process ended.');
  });

}

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+e', () => {
    // console.log('Starting playback... (OFF)');
    // startFfmpeg();
    mainWindow.focus()
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});



