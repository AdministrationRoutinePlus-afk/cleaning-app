"use client";

import { useState } from "react";
import SplashScreen from "../SplashScreen";

interface SplashProviderProps {
  children: React.ReactNode;
}

export default function SplashProvider({ children }: SplashProviderProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);

  const handleSplashComplete = () => {
    setContentVisible(true);
  };

  return (
    <>
      {showSplash && (
        <SplashScreen
          onComplete={() => {
            handleSplashComplete();
            // Small delay before removing splash from DOM
            setTimeout(() => setShowSplash(false), 100);
          }}
        />
      )}
      <div
        className={`transition-opacity duration-300 ${
          contentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </>
  );
}
