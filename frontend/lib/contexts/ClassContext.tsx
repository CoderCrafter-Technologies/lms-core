"use client"
import { createContext, useState, ReactNode } from "react";

// Interface for the class data state
interface ClassData {
  camOn: boolean;
  micOn: boolean;
  isSharing: boolean;
  isHandRaised: boolean;
}

// Interface for the context value
interface ClassContextValue {
  liveClassData: ClassData;
  toggleCam: (value:boolean) => void;
  toggleMic: (value:boolean) => void;
  // Add other actions as needed
}

// Interface for the provider props
interface ClassContextProviderProps {
  children: ReactNode;
}

// Create context with default values
export const ClassContext = createContext<ClassContextValue>({
  liveClassData: {
    camOn: true,
    micOn: true,
    isSharing: false,
    isHandRaised: false,
  },
  toggleCam: (value: boolean) => {},
  toggleMic: (value: boolean) => {},
});

export const ClassContextProvider = ({ children }: ClassContextProviderProps) => {
  const [liveClassData, setLiveClassData] = useState<ClassData>({
    camOn: true,
    micOn: true,
    isSharing: false,
    isHandRaised: false,
  });

  const toggleCam = (value: boolean) => {
    setLiveClassData(prev => ({ ...prev, camOn: value }));
  };

  const toggleMic = () => {
    setLiveClassData(prev => ({ ...prev, micOn: !prev.micOn }));
  };

  const value: ClassContextValue = {
    liveClassData,
    toggleCam,
    toggleMic,
    // Add other actions as needed
  };

  return (
    <ClassContext.Provider value={value}>
      {children}
    </ClassContext.Provider>
  );
};