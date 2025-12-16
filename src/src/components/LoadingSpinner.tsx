"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export default function LoadingSpinner({ size = "md", fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const glowSizes = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  };

  const spinner = (
    <div className="relative flex items-center justify-center">
      {/* Glow effect */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute ${glowSizes[size]} rounded-full bg-white/30 blur-xl`}
      />

      {/* Logo with pulse */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`relative ${sizeClasses[size]}`}
      >
        <Image
          src="/logo-icon.png"
          alt="Loading..."
          width={64}
          height={64}
          className="w-full h-full object-contain"
        />
      </motion.div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      {spinner}
    </div>
  );
}
