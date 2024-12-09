const { spawn } = require('child_process');
let a;
function enumerateAVFoundationDevices() {
  const ffmpegProcess = spawn('ffmpeg', [
    '-f', 'avfoundation',
    '-list_devices', 'true',
    '-i', '' // No input, just listing
  ]);

  const deviceList = [];

  ffmpegProcess.stdout.on('data', (data) => {
    // Split data into lines and add to the deviceList array
    deviceList.push(...data.toString().split('\n').filter(line => line.trim()));
  });

  // Capture stderr data (for errors)
  ffmpegProcess.stderr.on('data', (error) => { // //
    // console.error('Error:', error.toString());
    let estring = error.toString();
    a = extractVideoDevices(estring);
    console.log(a);
  });

  // Handle process exit
  ffmpegProcess.on('close', (code) => {
    if (code === 0) {
      return a;
    } else {
      return code;
    }
  });
}

// Usage with async/await
try {
    const devices = enumerateAVFoundationDevices();
    console.log('Available AVFoundation Devices:\n', devices);
  } catch (error) {
    console.error('Error enumerating devices:', error);
  }


  function extractVideoDevices(output) {
    console.log(output);
    // Regex to match content between 'AVFoundation video devices:' and 'AVFoundation audio devices:'
    const regex = /AVFoundation video devices:\s*([\s\S]*?)AVFoundation audio devices:/;
    const match = output.match(regex);
    
    if (match && match[1]) {
      // Split the matched video devices section into lines and filter them
       
      a = match[1]
        .split('\n')
        .map(line => line.trim())
        // .filter(line => line.includes('screen')); // Remove empty lines (THIS FILTER WILL MEAN NO OTHER DEVICE IS EVER USED)

        console.log(a)
        // [AVFoundation indev @ 0xfffffff] 
        // return a[0][];


    }
    
    
  }