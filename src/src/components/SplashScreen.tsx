"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface SplashScreenProps {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Total splash duration: 2.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        setTimeout(onComplete, 500); // Wait for fade out animation
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black"
        >
          {/* Logo container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
            }}
            className="relative"
          >
            {/* Subtle glow effect behind logo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.3] }}
              transition={{
                duration: 1.5,
                delay: 0.5,
                times: [0, 0.5, 1],
              }}
              className="absolute inset-0 blur-3xl bg-white/10 rounded-full scale-150"
            />

            {/* Logo image */}
            <Image
              src="/logo-dark.png"
              alt="Groupe ABR | Routine"
              width={400}
              height={310}
              priority
              className="relative z-10 max-w-[85vw]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
