"use client";

import React, { useState, useEffect } from "react";
import { useSpring, animated, config } from "@react-spring/web";

interface CottonMascotProps {
  mode?: "home" | "chat";
  state?: "idle" | "thinking" | "speaking" | "happy";
  className?: string;
}

// Blob paths - ensuring same number of points for smooth interpolation
// These are roughly circular but distorted.
// Generated/Simplified for demonstration.
// All paths are based on a 200x200 viewbox, centered roughly at 100,100.
const BLOB_SHAPES = [
  // Shape 1: Slightly wide
  "M100,30 C140,30 170,60 170,100 C170,140 140,170 100,170 C60,170 30,140 30,100 C30,60 60,30 100,30Z",
  // Shape 2: Slightly tall/leaning right
  "M100,25 C150,35 165,70 165,100 C165,140 130,175 100,175 C60,175 35,130 35,100 C35,60 60,25 100,25Z",
  // Shape 3: Leaning left/squashed
  "M100,35 C130,35 175,65 175,100 C175,135 140,165 100,165 C50,165 25,135 25,100 C25,65 70,35 100,35Z",
  // Shape 4: Happy/Excited (More irregular)
  "M100,20 C145,20 180,55 180,100 C180,145 145,180 100,180 C55,180 20,145 20,100 C20,55 55,20 100,20Z",
];

export const CottonMascot: React.FC<CottonMascotProps> = ({
  mode = "home",
  state = "idle",
  className,
}) => {
  const [shapeIndex, setShapeIndex] = useState(0);

  // 1. Morphing Animation (Continuous)
  // We cycle through shapes slowly
  useEffect(() => {
    const interval = setInterval(() => {
      setShapeIndex((prev) => (prev + 1) % BLOB_SHAPES.length);
    }, 4000); // Change shape every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const { path } = useSpring({
    path: BLOB_SHAPES[shapeIndex],
    config: {
      duration: 4000,
      easing: (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    }, // easeInOutCubic manually approximated or use standard config
  });

  // 2. Breathing Animation (Continuous)
  const { scale } = useSpring({
    from: { scale: 1 },
    to: async (next) => {
      while (true) {
        await next({ scale: 1.05 });
        await next({ scale: 1 });
      }
    },
    config: {
      duration: 4000,
      easing: (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    }, // 4s inhale, 4s exhale
  });

  // 3. Float Animation (Continuous)
  const { y } = useSpring({
    from: { y: 0 },
    to: async (next) => {
      while (true) {
        await next({ y: -10 });
        await next({ y: 0 });
      }
    },
    config: {
      duration: 3500,
      easing: (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    },
  });

  // 4. State-based reactions (Thinking/Speaking/Happy)
  const stateSpring = useSpring({
    scale:
      state === "thinking"
        ? 0.95
        : state === "speaking"
        ? 1.1
        : state === "happy"
        ? 1.2
        : 1,
    rotate: state === "happy" ? 10 : 0,
    config: config.wobbly,
  });

  // Combine scales
  // We need to interpolate the breathing scale with the state scale
  // Since we can't easily multiply animated values without `to`, we'll apply them to different wrapper elements or transform strings.

  const defaultSize = mode === "home" ? "w-64 h-64" : "w-16 h-16";

  return (
    <div
      className={`relative ${
        className || defaultSize
      } flex items-center justify-center`}
    >
      {/* Glow/Aura - Only visible in home mode or when speaking */}
      {(mode === "home" || state === "speaking" || state === "happy") && (
        <animated.div
          style={{
            scale: scale.to((s) => s * 1.2),
            opacity: 0.4,
          }}
          className='absolute inset-0 bg-orange-100 rounded-full blur-3xl'
        />
      )}

      {/* Main Body Container - Handles Float & State Scale */}
      <animated.div
        style={{
          y,
          scale: stateSpring.scale,
          rotate: stateSpring.rotate,
        }}
        className='w-full h-full relative z-10'
      >
        {/* Breathing Container */}
        <animated.div
          style={{
            scale,
          }}
          className='w-full h-full'
        >
          <svg
            viewBox='0 0 200 200'
            className='w-full h-full overflow-visible drop-shadow-xl'
          >
            <defs>
              <linearGradient
                id='cottonGradient'
                x1='0%'
                y1='0%'
                x2='100%'
                y2='100%'
              >
                <stop offset='0%' stopColor='#FFF7ED' /> {/* Cream */}
                <stop offset='50%' stopColor='#FFEDD5' /> {/* Peach */}
                <stop offset='100%' stopColor='#FECACA' /> {/* Coral */}
              </linearGradient>
              <filter
                id='softGlow'
                x='-20%'
                y='-20%'
                width='140%'
                height='140%'
              >
                <feGaussianBlur stdDeviation='4' result='blur' />
                <feComposite in='SourceGraphic' in2='blur' operator='over' />
              </filter>
            </defs>

            <animated.path
              d={path}
              fill='url(#cottonGradient)'
              filter='url(#softGlow)'
              className='transition-all duration-1000'
            />

            {/* Face (Optional - kept minimal/abstract as per "blob" description, but user mentioned "mascot") */}
            {/* If we want a face, it should be very subtle. Let's add simple eyes that blink. */}
            <g transform='translate(100, 100)'>
              {/* Eyes */}
              <circle cx='-20' cy='-10' r='3' fill='#FFFFFF' opacity='0.8' />
              <circle cx='20' cy='-10' r='3' fill='#FFFFFF' opacity='0.8' />
              {/* Mouth - tiny curve */}
              <path
                d={state === "happy" ? "M-8 5 Q0 12 8 5" : "M-5 5 Q0 8 5 5"}
                stroke='#FFFFFF'
                strokeWidth='2'
                fill='none'
                opacity='0.6'
                strokeLinecap='round'
              />
            </g>
          </svg>
        </animated.div>
      </animated.div>
    </div>
  );
};
