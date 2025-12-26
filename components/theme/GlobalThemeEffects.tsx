'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalThemeEffectsProps {
  themeId: string;
  effects?: {
    particlesEnabled?: boolean;
    glowEffectsEnabled?: boolean;
    animationsEnabled?: boolean;
    // Intensity controls (0-100)
    snowIntensity?: number;
    bloodIntensity?: number;
    confettiIntensity?: number;
  };
}

// Optimized Snow Effect - uses CSS animations instead of JS for better performance
function SnowEffect({ intensity = 30 }: { intensity?: number }) {
  // Limit particles based on intensity (max 50 for performance)
  const count = Math.min(Math.max(Math.floor(intensity / 2), 5), 50);
  
  const snowflakes = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: `snow-${i}`,
      x: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 10 + Math.random() * 8,
      size: 12 + Math.random() * 10,
    })), [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-white select-none animate-snow"
          style={{ 
            left: `${flake.x}%`, 
            top: -30,
            fontSize: flake.size,
            opacity: 0.7,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
          }}
        >
          ❄
        </div>
      ))}
      <style jsx>{`
        @keyframes snow-fall {
          0% { transform: translateY(-30px) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(360deg); }
        }
        .animate-snow {
          animation: snow-fall linear infinite;
        }
      `}</style>
    </div>
  );
}

// Optimized Blood Drip Effect
function BloodDripsEffect({ intensity = 20 }: { intensity?: number }) {
  const count = Math.min(Math.max(Math.floor(intensity / 5), 3), 20);
  
  const drips = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: `blood-${i}`,
      x: (i * (100 / count)) + Math.random() * (100 / count / 2),
      delay: Math.random() * 3,
      height: 40 + Math.random() * 100,
      width: 6 + Math.random() * 8,
    })), [count]);

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-[9999] h-48 overflow-hidden">
      {drips.map((drip) => (
        <motion.div
          key={drip.id}
          className="absolute top-0"
          style={{ 
            left: `${drip.x}%`,
            width: drip.width,
          }}
          initial={{ height: 0 }}
          animate={{ height: drip.height }}
          transition={{ 
            repeat: Infinity,
            repeatType: "reverse",
            duration: 4 + Math.random() * 2,
            delay: drip.delay,
            ease: "easeInOut"
          }}
        >
          <div 
            className="h-full w-full rounded-b-full"
            style={{
              background: 'linear-gradient(180deg, #8B0000 0%, #DC143C 50%, #FF0000 100%)',
              boxShadow: '0 0 10px rgba(220,20,60,0.5)',
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// Optimized Confetti Effect
function ConfettiEffect({ intensity = 30 }: { intensity?: number }) {
  const count = Math.min(Math.max(Math.floor(intensity / 2), 10), 60);
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff69b4'];
  
  const confetti = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: `confetti-${i}`,
      x: Math.random() * 100,
      color: colors[i % colors.length],
      delay: Math.random() * 5,
      duration: 6 + Math.random() * 4,
      size: 8 + Math.random() * 8,
      rotation: Math.random() * 360,
    })), [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute select-none animate-confetti"
          style={{ 
            left: `${piece.x}%`, 
            top: -20,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: '2px',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.5; }
        }
        .animate-confetti {
          animation: confetti-fall linear infinite;
        }
      `}</style>
    </div>
  );
}

// Optimized Halloween Effects
function HalloweenEffects({ intensity = 20 }: { intensity?: number }) {
  const iconCount = Math.min(Math.max(Math.floor(intensity / 4), 4), 15);
  const icons = ['🎃', '👻', '🦇', '💀', '🕷️', '🕸️'];
  
  const elements = useMemo(() => 
    Array.from({ length: iconCount }, (_, i) => ({
      id: `halloween-${i}`,
      icon: icons[i % icons.length],
      x: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 12 + Math.random() * 8,
      size: 20 + Math.random() * 16,
    })), [iconCount]);

  return (
    <>
      <BloodDripsEffect intensity={intensity} />
      {/* Fog overlay */}
      <div 
        className="fixed bottom-0 left-0 right-0 h-48 pointer-events-none z-[9996]"
        style={{
          background: 'linear-gradient(to top, rgba(100,100,100,0.4), transparent)',
        }}
      />
      {/* Floating icons */}
      <div className="fixed inset-0 pointer-events-none z-[9997] overflow-hidden">
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute select-none animate-float-up"
            style={{ 
              left: `${el.x}%`, 
              bottom: -50,
              fontSize: el.size,
              animationDelay: `${el.delay}s`,
              animationDuration: `${el.duration}s`,
            }}
          >
            {el.icon}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes float-up {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
          100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up linear infinite;
        }
      `}</style>
    </>
  );
}

// Optimized Christmas Effects
function ChristmasEffects({ intensity = 30 }: { intensity?: number }) {
  const lightCount = Math.min(Math.max(Math.floor(intensity / 5), 5), 20);
  const lightColors = ['#ff0000', '#00ff00', '#ffd700', '#0000ff', '#ff00ff'];
  
  const lights = useMemo(() => 
    Array.from({ length: lightCount }, (_, i) => ({
      id: `light-${i}`,
      color: lightColors[i % lightColors.length],
      delay: i * 0.15,
    })), [lightCount]);

  return (
    <>
      <SnowEffect intensity={intensity} />
      {/* Christmas lights at top */}
      <div className="fixed top-0 left-0 right-0 pointer-events-none z-[9998]">
        <div className="flex justify-around px-4">
          {lights.map((light) => (
            <motion.div
              key={light.id}
              className="w-3 h-3 rounded-full mt-2"
              style={{
                backgroundColor: light.color,
                boxShadow: `0 0 10px ${light.color}`,
              }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.2,
                delay: light.delay,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Optimized Easter Effects
function EasterEffects({ intensity = 30 }: { intensity?: number }) {
  const iconCount = Math.min(Math.max(Math.floor(intensity / 3), 5), 25);
  const icons = ['🥚', '🐰', '🐣', '🌸', '🌷', '🦋'];
  const colors = ['#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C', '#E6E6FA'];
  
  const elements = useMemo(() => 
    Array.from({ length: iconCount }, (_, i) => ({
      id: `easter-${i}`,
      icon: icons[i % icons.length],
      x: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 10 + Math.random() * 6,
      size: 18 + Math.random() * 14,
    })), [iconCount]);

  return (
    <>
      <ConfettiEffect intensity={Math.floor(intensity * 0.6)} />
      <div className="fixed inset-0 pointer-events-none z-[9997] overflow-hidden">
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute select-none animate-float-down"
            style={{ 
              left: `${el.x}%`, 
              top: -40,
              fontSize: el.size,
              animationDelay: `${el.delay}s`,
              animationDuration: `${el.duration}s`,
            }}
          >
            {el.icon}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes float-down {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(180deg); opacity: 0.3; }
        }
        .animate-float-down {
          animation: float-down linear infinite;
        }
      `}</style>
    </>
  );
}

// Optimized Black Friday Effects
function BlackFridayEffects({ intensity = 30 }: { intensity?: number }) {
  const tagCount = Math.min(Math.max(Math.floor(intensity / 4), 4), 15);
  const tags = ['💰', '🏷️', '💵', '🛒', '⭐', '🔥'];
  
  const elements = useMemo(() => 
    Array.from({ length: tagCount }, (_, i) => ({
      id: `bf-${i}`,
      icon: tags[i % tags.length],
      x: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 8 + Math.random() * 6,
      size: 20 + Math.random() * 12,
    })), [tagCount]);

  return (
    <>
      <ConfettiEffect intensity={Math.floor(intensity * 0.5)} />
      <div className="fixed inset-0 pointer-events-none z-[9997] overflow-hidden">
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute select-none animate-float-down"
            style={{ 
              left: `${el.x}%`, 
              top: -40,
              fontSize: el.size,
              animationDelay: `${el.delay}s`,
              animationDuration: `${el.duration}s`,
            }}
          >
            {el.icon}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes float-down {
          0% { transform: translateY(-40px); opacity: 0.9; }
          100% { transform: translateY(110vh); opacity: 0.4; }
        }
        .animate-float-down {
          animation: float-down linear infinite;
        }
      `}</style>
    </>
  );
}

// Optimized Gaming Neon Effects
function GamingNeonEffects() {
  return (
    <>
      <motion.div
        className="fixed top-1/4 left-1/6 w-48 h-48 pointer-events-none z-[9996] rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(0, 255, 136, 0.08)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
      />
      <motion.div
        className="fixed bottom-1/4 right-1/6 w-40 h-40 pointer-events-none z-[9996] rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(0, 212, 255, 0.08)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.06, 0.1] }}
        transition={{ repeat: Infinity, duration: 6, delay: 1.5, ease: 'easeInOut' }}
      />
    </>
  );
}

// Optimized RGB Gaming Effects
function RGBGamingEffects() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9995]">
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(45deg, rgba(255,0,0,0.03), rgba(0,255,0,0.03), rgba(0,0,255,0.03))',
          backgroundSize: '400% 400%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
      />
    </div>
  );
}

// Optimized Cyberpunk Effects
function CyberpunkEffects() {
  return (
    <>
      <motion.div
        className="fixed top-1/3 left-1/4 w-56 h-56 pointer-events-none z-[9996] rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(255, 0, 255, 0.06)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ repeat: Infinity, duration: 5 }}
      />
      <motion.div
        className="fixed bottom-1/3 right-1/4 w-48 h-48 pointer-events-none z-[9996] rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(0, 255, 255, 0.06)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.08, 0.04, 0.08] }}
        transition={{ repeat: Infinity, duration: 6, delay: 1 }}
      />
    </>
  );
}

// Optimized Retro Arcade Effects
function RetroArcadeEffects() {
  const pixels = ['🕹️', '👾', '🎮', '⭐'];
  const elements = useMemo(() => 
    Array.from({ length: 8 }, (_, i) => ({
      id: `retro-${i}`,
      icon: pixels[i % pixels.length],
      x: 10 + (i * 12),
      delay: i * 0.6,
      duration: 10 + Math.random() * 4,
    })), []);

  return (
    <>
      {/* Scanlines */}
      <div 
        className="fixed inset-0 pointer-events-none z-[9995] opacity-5"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        }}
      />
      {/* Floating pixels */}
      <div className="fixed inset-0 pointer-events-none z-[9997] overflow-hidden">
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute select-none animate-float-down"
            style={{ 
              left: `${el.x}%`, 
              top: -40,
              fontSize: 24,
              animationDelay: `${el.delay}s`,
              animationDuration: `${el.duration}s`,
            }}
          >
            {el.icon}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes float-down {
          0% { transform: translateY(-40px) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(360deg); }
        }
        .animate-float-down {
          animation: float-down linear infinite;
        }
      `}</style>
    </>
  );
}

// Optimized Casino Effects
function CasinoEffects() {
  const icons = ['🎰', '💎', '🎲', '♠️', '♥️', '♦️', '♣️', '🃏'];
  const elements = useMemo(() => 
    Array.from({ length: 10 }, (_, i) => ({
      id: `casino-${i}`,
      icon: icons[i % icons.length],
      x: Math.random() * 100,
      delay: i * 0.8,
      duration: 12 + Math.random() * 6,
    })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9997] overflow-hidden">
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute select-none animate-float-down"
          style={{ 
            left: `${el.x}%`, 
            top: -40,
            fontSize: 22,
            animationDelay: `${el.delay}s`,
            animationDuration: `${el.duration}s`,
          }}
        >
          {el.icon}
        </div>
      ))}
      <style jsx>{`
        @keyframes float-down {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0.7; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0.2; }
        }
        .animate-float-down {
          animation: float-down linear infinite;
        }
      `}</style>
    </div>
  );
}

// Optimized Vegas Effects
function VegasEffects() {
  return (
    <>
      <motion.div
        className="fixed top-1/3 left-1/5 w-56 h-56 pointer-events-none z-[9996] rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(255, 0, 255, 0.08)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ repeat: Infinity, duration: 4 }}
      />
      <motion.div
        className="fixed bottom-1/3 right-1/5 w-48 h-48 pointer-events-none z-[9996] rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(0, 255, 255, 0.08)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.05, 0.1] }}
        transition={{ repeat: Infinity, duration: 5, delay: 1 }}
      />
    </>
  );
}

// Default intensity for each theme type
const themeIntensities: Record<string, number> = {
  'christmas': 30,
  'halloween': 20,
  'easter': 30,
  'black-friday': 25,
};

export default function GlobalThemeEffects({ themeId, effects = {} }: GlobalThemeEffectsProps) {
  const {
    particlesEnabled = true,
    glowEffectsEnabled = true,
    animationsEnabled = true,
    snowIntensity = 30,
    bloodIntensity = 20,
    confettiIntensity = 30,
  } = effects;

  if (!animationsEnabled) return null;

  // Theme-specific effects - automatically applied based on theme
  const renderThemeEffects = () => {
    const intensity = themeIntensities[themeId] || 25;
    
    switch (themeId) {
      // Holiday themes with automatic effects
      case 'christmas':
        return <ChristmasEffects intensity={snowIntensity || intensity} />;
      case 'halloween':
        return <HalloweenEffects intensity={bloodIntensity || intensity} />;
      case 'easter':
        return <EasterEffects intensity={confettiIntensity || intensity} />;
      case 'black-friday':
        return <BlackFridayEffects intensity={confettiIntensity || intensity} />;
      
      // Gaming themes
      case 'gaming-neon':
        return glowEffectsEnabled ? <GamingNeonEffects /> : null;
      case 'rgb-gaming':
        return glowEffectsEnabled ? <RGBGamingEffects /> : null;
      case 'cyberpunk':
        return glowEffectsEnabled ? <CyberpunkEffects /> : null;
      case 'retro-arcade':
        return particlesEnabled ? <RetroArcadeEffects /> : null;
      
      // Casino themes
      case 'casino-royale':
        return particlesEnabled ? <CasinoEffects /> : null;
      case 'vegas-night':
        return glowEffectsEnabled ? <VegasEffects /> : null;
      
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {renderThemeEffects()}
    </AnimatePresence>
  );
}
