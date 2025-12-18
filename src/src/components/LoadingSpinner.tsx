"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export default function LoadingSpinner({ size = "md", fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-16 h-16",
    lg: "w-32 h-32",
  };

  const glowSizes = {
    sm: "w-24 h-24",
    md: "w-40 h-40",
    lg: "w-72 h-72",
  };

  const spinner = (
    <div className="relative flex items-center justify-center">
      {/* Subtle glow effect */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute ${sizeClasses[size]} rounded-full bg-white/20 blur-md`}
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
          width={512}
          height={512}
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
