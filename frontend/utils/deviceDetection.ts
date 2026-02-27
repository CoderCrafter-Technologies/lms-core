// lib/utils/deviceDetection.js
export const checkMediaDevices = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return {
        hasCamera: false,
        hasMicrophone: false,
        devicesAvailable: false
      };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some(device => device.kind === 'videoinput');
    const hasMicrophone = devices.some(device => device.kind === 'audioinput');
    
    return {
      hasCamera,
      hasMicrophone,
      devicesAvailable: true
    };
  } catch (error) {
    console.error("Error checking media devices:", error);
    return {
      hasCamera: false,
      hasMicrophone: false,
      devicesAvailable: false
    };
  }
};

export const requestMediaPermissions = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    
    // Stop all tracks immediately since we just wanted permission
    stream.getTracks().forEach(track => track.stop());
    
    return true;
  } catch (error) {
    console.warn("Could not get media permissions:", error);
    return false;
  }
};