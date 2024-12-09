
# disclamers/known issues:
- electron, VTDecoderXPCService, and ffmpeg processes "sometimes" does not close properly 
Can be closed manually in activity monitor:

![screenshot](../screenshots/error.png)

- the touchbar recording doesnt start 
ffmpeg records the screen based on device id, best chance is to disconnect all other capturable devices (includes iphone camera), (Another option is to change source code and modify (`screenIndex  =`) to force desired capture device.) check with ffmpeg that device id is matching:

![screenshot](../screenshots/devicefind1.png)

![screenshot](../screenshots/devicefind2.png)

- to get more screen real-estate

![screenshot](../screenshots/optional.png)

# permission for screen recording needs to be granted:

![screenshot](../screenshots/permission1.png)
![screenshot](../screenshots/permission2.png)
