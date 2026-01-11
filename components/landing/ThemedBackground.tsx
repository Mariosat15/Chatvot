'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LandingTheme } from '@/lib/themes/landing-themes';

interface ThemedBackgroundProps {
  theme: LandingTheme | undefined;
}

// Floating Icon Component
function FloatingIcon({ 
  icon, 
  delay = 0, 
  duration = 20, 
  startX = 0, 
  startY = 0,
  size = 24,
  opacity = 0.15,
  rotation = 0,
  color = '#ffffff'
}: { 
  icon: string;
  delay?: number;
  duration?: number;
  startX?: number;
  startY?: number;
  size?: number;
  opacity?: number;
  rotation?: number;
  color?: string;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ 
        left: `${startX}%`, 
        top: `${startY}%`,
        fontSize: size,
        opacity,
        color,
      }}
      initial={{ y: 0, rotate: rotation }}
      animate={{ 
        y: [0, -30, 0],
        rotate: [rotation, rotation + 15, rotation - 15, rotation],
        scale: [1, 1.1, 1],
      }}
      transition={{ 
        repeat: Infinity, 
        duration, 
        delay,
        ease: "easeInOut"
      }}
    >
      {icon}
    </motion.div>
  );
}

// Snow Particle for Christmas
function SnowParticle({ delay, x }: { delay: number; x: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: -20 }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ 
        y: ['0vh', '100vh'],
        x: [0, Math.sin(delay) * 50, 0],
        opacity: [0, 1, 1, 0],
        rotate: [0, 360],
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 8 + Math.random() * 4,
        delay,
        ease: "linear"
      }}
    >
      <span className="text-white text-opacity-80" style={{ fontSize: 12 + Math.random() * 12 }}>❄</span>
    </motion.div>
  );
}

// Confetti Particle for Black Friday/Easter
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ 
        left: `${x}%`, 
        top: -20,
        width: 8 + Math.random() * 8,
        height: 8 + Math.random() * 8,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ 
        y: ['0vh', '100vh'],
        x: [0, Math.sin(delay * 2) * 100, 0],
        opacity: [0, 1, 1, 0],
        rotate: [0, 720],
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 6 + Math.random() * 4,
        delay,
        ease: "linear"
      }}
    />
  );
}

// Sparkle Particle for Gaming/Casino
function SparkleParticle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 2 + Math.random() * 2,
        delay,
        ease: "easeInOut"
      }}
    >
      <span style={{ color, fontSize: 16 + Math.random() * 12 }}>✦</span>
    </motion.div>
  );
}

// Matrix Rain for Cyberpunk
function MatrixRain({ x, delay }: { x: number; delay: number }) {
  const chars = '01アイウエオカキクケコサシスセソタチツテト';
  const [char, setChar] = useState(chars[Math.floor(Math.random() * chars.length)]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setChar(chars[Math.floor(Math.random() * chars.length)]);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="absolute pointer-events-none font-mono"
      style={{ 
        left: `${x}%`, 
        top: -20,
        color: '#fcee09',
        fontSize: 14,
        textShadow: '0 0 10px #fcee09',
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ 
        y: ['0vh', '100vh'],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 4 + Math.random() * 3,
        delay,
        ease: "linear"
      }}
    >
      {char}
    </motion.div>
  );
}

// Bubble Particle for Holographic
function BubbleParticle({ x, delay, color }: { x: number; delay: number; color: string }) {
  const size = 10 + Math.random() * 30;
  return (
    <motion.div
      className="absolute pointer-events-none rounded-full"
      style={{ 
        left: `${x}%`, 
        bottom: -50,
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${color}40, ${color}10)`,
        border: `1px solid ${color}30`,
      }}
      initial={{ y: 0, opacity: 0 }}
      animate={{ 
        y: [0, -window.innerHeight - 100],
        opacity: [0, 0.6, 0.6, 0],
        scale: [1, 1.2, 0.8, 1],
      }}
      transition={{ 
        repeat: Infinity, 
        duration: 8 + Math.random() * 6,
        delay,
        ease: "easeOut"
      }}
    />
  );
}

// RGB Wave Effect
function RGBWave() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, rgba(255,0,0,0.1), rgba(0,255,0,0.1), rgba(0,0,255,0.1), rgba(255,0,0,0.1))',
        backgroundSize: '400% 100%',
      }}
      animate={{
        backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
      }}
      transition={{
        repeat: Infinity,
        duration: 5,
        ease: "linear"
      }}
    />
  );
}

export default function ThemedBackground({ theme }: ThemedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!theme) {
    // Default gaming background
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(234,179,8,0.15),transparent)]" />
      </div>
    );
  }

  // Theme-specific backgrounds
  const renderThemeBackground = () => {
    switch (theme.id) {
      // ========== CHRISTMAS ==========
      case 'christmas':
        return (
          <>
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1a12] via-[#122a1a] to-[#1a0a10]" />
            
            {/* Northern lights effect */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(187,37,40,0.2) 0%, transparent 50%), radial-gradient(ellipse at 30% 20%, rgba(22,91,51,0.2) 0%, transparent 40%)',
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 4 }}
            />
            
            {/* Snowflakes */}
            {Array.from({ length: 50 }).map((_, i) => (
              <SnowParticle key={i} delay={i * 0.3} x={Math.random() * 100} />
            ))}
            
            {/* Floating Christmas icons */}
            <FloatingIcon icon="🎄" startX={5} startY={20} delay={0} size={40} opacity={0.2} color="#165b33" />
            <FloatingIcon icon="🎁" startX={90} startY={60} delay={1} size={35} opacity={0.2} color="#bb2528" />
            <FloatingIcon icon="⭐" startX={15} startY={70} delay={2} size={30} opacity={0.25} color="#f8b229" />
            <FloatingIcon icon="🔔" startX={85} startY={25} delay={0.5} size={32} opacity={0.2} color="#f8b229" />
            <FloatingIcon icon="❄️" startX={50} startY={15} delay={1.5} size={35} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="🦌" startX={75} startY={80} delay={2.5} size={38} opacity={0.15} color="#8b4513" />
            <FloatingIcon icon="🎅" startX={25} startY={45} delay={3} size={36} opacity={0.2} color="#bb2528" />
            <FloatingIcon icon="☃️" startX={60} startY={75} delay={1.2} size={34} opacity={0.18} color="#ffffff" />
          </>
        );

      // ========== HALLOWEEN ==========
      case 'halloween':
        return (
          <>
            {/* Spooky gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a050f] via-[#150a1f] to-[#1a0510]" />
            
            {/* Fog effect */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 100%, rgba(139,0,255,0.15) 0%, transparent 50%)',
              }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 5 }}
            />
            
            {/* Moon glow */}
            <motion.div
              className="absolute w-32 h-32 rounded-full"
              style={{
                top: '10%',
                right: '15%',
                background: 'radial-gradient(circle, rgba(255,200,100,0.8) 0%, rgba(255,150,50,0.3) 50%, transparent 70%)',
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 4 }}
            />
            
            {/* Floating Halloween icons */}
            <FloatingIcon icon="🎃" startX={10} startY={30} delay={0} size={45} opacity={0.25} color="#ff6600" />
            <FloatingIcon icon="👻" startX={85} startY={50} delay={1} size={40} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="🦇" startX={20} startY={15} delay={0.5} size={35} opacity={0.2} color="#8b00ff" />
            <FloatingIcon icon="💀" startX={75} startY={75} delay={2} size={38} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="🕷️" startX={45} startY={20} delay={1.5} size={30} opacity={0.2} color="#000000" />
            <FloatingIcon icon="🕸️" startX={90} startY={10} delay={2.5} size={42} opacity={0.15} color="#888888" />
            <FloatingIcon icon="🧙" startX={5} startY={70} delay={3} size={36} opacity={0.18} color="#8b00ff" />
            <FloatingIcon icon="⚰️" startX={60} startY={85} delay={1.8} size={32} opacity={0.15} color="#4a3728" />
            <FloatingIcon icon="🌙" startX={30} startY={60} delay={0.8} size={34} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="🦉" startX={70} startY={25} delay={2.2} size={33} opacity={0.18} color="#8b4513" />
            
            {/* Flying bats animation */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={`bat-${i}`}
                className="absolute text-2xl pointer-events-none"
                style={{ 
                  left: `${10 + i * 12}%`,
                  top: `${15 + (i % 3) * 20}%`,
                }}
                animate={{
                  x: [0, 100, 200, 100, 0],
                  y: [0, -30, 0, 30, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 8 + i,
                  delay: i * 0.5,
                }}
              >
                <span style={{ opacity: 0.15 }}>🦇</span>
              </motion.div>
            ))}
          </>
        );

      // ========== BLACK FRIDAY ==========
      case 'black-friday':
        return (
          <>
            {/* Pure black with red accents */}
            <div className="absolute inset-0 bg-black" />
            
            {/* Diagonal stripes */}
            <div 
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, #ff0000 20px, #ff0000 22px)',
              }}
            />
            
            {/* Pulsing sale badges */}
            <motion.div
              className="absolute top-20 left-10 text-6xl font-black text-red-600"
              style={{ textShadow: '0 0 30px #ff0000' }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              %
            </motion.div>
            <motion.div
              className="absolute bottom-32 right-16 text-5xl font-black text-yellow-500"
              style={{ textShadow: '0 0 30px #ffd700' }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
            >
              $
            </motion.div>
            
            {/* Confetti */}
            {Array.from({ length: 30 }).map((_, i) => (
              <ConfettiParticle 
                key={i} 
                delay={i * 0.2} 
                x={Math.random() * 100}
                color={i % 3 === 0 ? '#ff0000' : i % 3 === 1 ? '#ffd700' : '#ffffff'}
              />
            ))}
            
            {/* Floating sale icons */}
            <FloatingIcon icon="🏷️" startX={15} startY={40} delay={0} size={40} opacity={0.2} color="#ff0000" />
            <FloatingIcon icon="💰" startX={80} startY={30} delay={1} size={38} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="🛒" startX={25} startY={70} delay={2} size={36} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="💳" startX={70} startY={60} delay={1.5} size={34} opacity={0.18} color="#ffd700" />
            <FloatingIcon icon="🎁" startX={50} startY={20} delay={0.8} size={35} opacity={0.2} color="#ff0000" />
          </>
        );

      // ========== EASTER ==========
      case 'easter':
        return (
          <>
            {/* Pastel gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1520] via-[#2a2030] to-[#1a2020]" />
            
            {/* Soft pastel glows */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,rgba(255,105,180,0.1)_0%,transparent_40%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_70%,rgba(135,206,235,0.1)_0%,transparent_40%)]" />
            
            {/* Confetti */}
            {Array.from({ length: 25 }).map((_, i) => (
              <ConfettiParticle 
                key={i} 
                delay={i * 0.3} 
                x={Math.random() * 100}
                color={['#ff69b4', '#87ceeb', '#98fb98', '#ffd700', '#dda0dd'][i % 5]}
              />
            ))}
            
            {/* Floating Easter icons */}
            <FloatingIcon icon="🐰" startX={10} startY={35} delay={0} size={42} opacity={0.2} color="#ff69b4" />
            <FloatingIcon icon="🥚" startX={85} startY={45} delay={1} size={38} opacity={0.22} color="#87ceeb" />
            <FloatingIcon icon="🐣" startX={20} startY={70} delay={2} size={36} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="🌷" startX={75} startY={25} delay={0.5} size={35} opacity={0.2} color="#ff69b4" />
            <FloatingIcon icon="🦋" startX={45} startY={15} delay={1.5} size={32} opacity={0.22} color="#dda0dd" />
            <FloatingIcon icon="🌸" startX={60} startY={80} delay={2.5} size={34} opacity={0.18} color="#ffb6c1" />
            <FloatingIcon icon="🐥" startX={30} startY={55} delay={0.8} size={33} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="🌼" startX={90} startY={70} delay={1.8} size={30} opacity={0.18} color="#98fb98" />
          </>
        );

      // ========== GAMING NEON ==========
      case 'gaming-neon':
        return (
          <>
            {/* Dark base with neon glows */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a1a]" />
            
            {/* Neon glow spots */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 20% 80%, rgba(0,245,255,0.15) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(255,0,255,0.15) 0%, transparent 40%)',
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
            
            {/* Sparkles */}
            {Array.from({ length: 30 }).map((_, i) => (
              <SparkleParticle 
                key={i}
                x={Math.random() * 100}
                y={Math.random() * 100}
                delay={i * 0.2}
                color={i % 3 === 0 ? '#00f5ff' : i % 3 === 1 ? '#ff00ff' : '#ffff00'}
              />
            ))}
            
            {/* Floating gaming icons */}
            <FloatingIcon icon="🎮" startX={8} startY={25} delay={0} size={40} opacity={0.2} color="#00f5ff" />
            <FloatingIcon icon="🕹️" startX={88} startY={65} delay={1} size={38} opacity={0.2} color="#ff00ff" />
            <FloatingIcon icon="⚡" startX={15} startY={75} delay={2} size={35} opacity={0.22} color="#ffff00" />
            <FloatingIcon icon="🏆" startX={82} startY={20} delay={0.5} size={36} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="💎" startX={50} startY={10} delay={1.5} size={32} opacity={0.22} color="#00f5ff" />
            <FloatingIcon icon="🚀" startX={25} startY={50} delay={2.5} size={34} opacity={0.18} color="#ff00ff" />
          </>
        );

      // ========== RETRO ARCADE ==========
      case 'retro-arcade':
        return (
          <>
            {/* Retro gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
            
            {/* Scanlines effect */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
              }}
            />
            
            {/* Pixel dots */}
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: 4,
                  height: 4,
                  backgroundColor: ['#ff6b6b', '#4ecdc4', '#ffe66d'][i % 3],
                }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1 + Math.random(), delay: i * 0.1 }}
              />
            ))}
            
            {/* Floating retro icons */}
            <FloatingIcon icon="👾" startX={10} startY={30} delay={0} size={45} opacity={0.2} color="#ff6b6b" />
            <FloatingIcon icon="🕹️" startX={85} startY={55} delay={1} size={40} opacity={0.2} color="#4ecdc4" />
            <FloatingIcon icon="💾" startX={20} startY={70} delay={2} size={35} opacity={0.2} color="#ffe66d" />
            <FloatingIcon icon="🎯" startX={75} startY={20} delay={0.5} size={38} opacity={0.2} color="#ff6b6b" />
            <FloatingIcon icon="⭐" startX={50} startY={15} delay={1.5} size={32} opacity={0.22} color="#ffe66d" />
            <FloatingIcon icon="🏅" startX={30} startY={85} delay={2.5} size={34} opacity={0.18} color="#4ecdc4" />
          </>
        );

      // ========== RGB GAMING ==========
      case 'rgb-gaming':
        return (
          <>
            {/* Dark base */}
            <div className="absolute inset-0 bg-[#050510]" />
            
            {/* RGB wave */}
            <RGBWave />
            
            {/* Glowing orbs */}
            <motion.div
              className="absolute w-64 h-64 rounded-full blur-3xl"
              style={{ top: '20%', left: '10%', backgroundColor: 'rgba(255,0,128,0.2)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 4 }}
            />
            <motion.div
              className="absolute w-48 h-48 rounded-full blur-3xl"
              style={{ top: '60%', right: '15%', backgroundColor: 'rgba(0,255,128,0.2)' }}
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
              transition={{ repeat: Infinity, duration: 5, delay: 1 }}
            />
            <motion.div
              className="absolute w-56 h-56 rounded-full blur-3xl"
              style={{ bottom: '10%', left: '30%', backgroundColor: 'rgba(128,0,255,0.2)' }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ repeat: Infinity, duration: 4.5, delay: 2 }}
            />
            
            {/* Sparkles */}
            {Array.from({ length: 40 }).map((_, i) => (
              <SparkleParticle 
                key={i}
                x={Math.random() * 100}
                y={Math.random() * 100}
                delay={i * 0.15}
                color={`hsl(${(i * 25) % 360}, 100%, 60%)`}
              />
            ))}
            
            {/* RGB gaming icons */}
            <FloatingIcon icon="⌨️" startX={12} startY={28} delay={0} size={42} opacity={0.2} color="#ff0080" />
            <FloatingIcon icon="🖱️" startX={85} startY={62} delay={1} size={38} opacity={0.2} color="#00ff80" />
            <FloatingIcon icon="🎧" startX={18} startY={72} delay={2} size={36} opacity={0.2} color="#8000ff" />
            <FloatingIcon icon="🖥️" startX={78} startY={22} delay={0.5} size={40} opacity={0.18} color="#ff0080" />
            <FloatingIcon icon="💿" startX={45} startY={12} delay={1.5} size={34} opacity={0.2} color="#00ff80" />
          </>
        );

      // ========== CYBERPUNK ==========
      case 'cyberpunk':
        return (
          <>
            {/* Dark cyberpunk base */}
            <div className="absolute inset-0 bg-[#0d0d0d]" />
            
            {/* Grid pattern */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'linear-gradient(#fcee0910 1px, transparent 1px), linear-gradient(90deg, #fcee0910 1px, transparent 1px)',
                backgroundSize: '50px 50px',
              }}
            />
            
            {/* Yellow neon glow */}
            <motion.div
              className="absolute w-96 h-96 rounded-full blur-3xl"
              style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(252,238,9,0.1)' }}
              animate={{ opacity: [0.1, 0.2, 0.1] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
            
            {/* Matrix rain */}
            {Array.from({ length: 25 }).map((_, i) => (
              <MatrixRain key={i} x={i * 4} delay={i * 0.2} />
            ))}
            
            {/* Cyberpunk icons */}
            <FloatingIcon icon="🤖" startX={8} startY={32} delay={0} size={42} opacity={0.2} color="#fcee09" />
            <FloatingIcon icon="🔌" startX={88} startY={58} delay={1} size={36} opacity={0.2} color="#00f0ff" />
            <FloatingIcon icon="💉" startX={15} startY={75} delay={2} size={34} opacity={0.18} color="#ff2a6d" />
            <FloatingIcon icon="🧬" startX={80} startY={18} delay={0.5} size={38} opacity={0.2} color="#fcee09" />
            <FloatingIcon icon="⚙️" startX={48} startY={8} delay={1.5} size={40} opacity={0.2} color="#00f0ff" />
            <FloatingIcon icon="🔋" startX={25} startY={52} delay={2.5} size={32} opacity={0.18} color="#ff2a6d" />
          </>
        );

      // ========== HOLOGRAPHIC ==========
      case 'holographic':
        return (
          <>
            {/* Dark iridescent base */}
            <div className="absolute inset-0 bg-[#0f0f1a]" />
            
            {/* Holographic gradient overlay */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 25%, rgba(240,147,251,0.1) 50%, rgba(245,87,108,0.1) 75%, rgba(79,172,254,0.1) 100%)',
                backgroundSize: '400% 400%',
              }}
              animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            />
            
            {/* Bubbles */}
            {Array.from({ length: 20 }).map((_, i) => (
              <BubbleParticle 
                key={i}
                x={Math.random() * 100}
                delay={i * 0.5}
                color={['#667eea', '#f093fb', '#4facfe'][i % 3]}
              />
            ))}
            
            {/* Holographic icons */}
            <FloatingIcon icon="💫" startX={10} startY={28} delay={0} size={38} opacity={0.22} color="#667eea" />
            <FloatingIcon icon="🔮" startX={85} startY={55} delay={1} size={40} opacity={0.2} color="#f093fb" />
            <FloatingIcon icon="✨" startX={20} startY={72} delay={2} size={34} opacity={0.22} color="#4facfe" />
            <FloatingIcon icon="🌈" startX={75} startY={18} delay={0.5} size={36} opacity={0.18} color="#f5576c" />
            <FloatingIcon icon="💠" startX={50} startY={85} delay={1.5} size={32} opacity={0.2} color="#667eea" />
          </>
        );

      // ========== CASINO ROYALE ==========
      case 'casino-royale':
        return (
          <>
            {/* Rich dark red gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0505] via-[#1a0a0a] to-[#0a0505]" />
            
            {/* Gold accent glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,215,0,0.1)_0%,transparent_50%)]" />
            
            {/* Sparkles */}
            {Array.from({ length: 25 }).map((_, i) => (
              <SparkleParticle 
                key={i}
                x={Math.random() * 100}
                y={Math.random() * 100}
                delay={i * 0.2}
                color={i % 2 === 0 ? '#ffd700' : '#dc143c'}
              />
            ))}
            
            {/* Casino icons */}
            <FloatingIcon icon="🎰" startX={8} startY={30} delay={0} size={45} opacity={0.2} color="#dc143c" />
            <FloatingIcon icon="🃏" startX={88} startY={55} delay={1} size={40} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="🎲" startX={15} startY={72} delay={2} size={38} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="♠️" startX={78} startY={18} delay={0.5} size={42} opacity={0.2} color="#000000" />
            <FloatingIcon icon="♥️" startX={45} startY={12} delay={1.5} size={36} opacity={0.22} color="#dc143c" />
            <FloatingIcon icon="💎" startX={25} startY={85} delay={2.5} size={34} opacity={0.18} color="#00ffff" />
            <FloatingIcon icon="🏆" startX={70} startY={75} delay={0.8} size={36} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="♦️" startX={55} startY={45} delay={1.8} size={32} opacity={0.18} color="#dc143c" />
          </>
        );

      // ========== VEGAS NIGHTS ==========
      case 'vegas-night':
        return (
          <>
            {/* Dark purple base */}
            <div className="absolute inset-0 bg-[#0a0a15]" />
            
            {/* Neon glows */}
            <motion.div
              className="absolute w-72 h-72 rounded-full blur-3xl"
              style={{ top: '10%', left: '20%', backgroundColor: 'rgba(255,0,255,0.15)' }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
            <motion.div
              className="absolute w-64 h-64 rounded-full blur-3xl"
              style={{ top: '50%', right: '10%', backgroundColor: 'rgba(0,255,255,0.15)' }}
              animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.15, 0.3] }}
              transition={{ repeat: Infinity, duration: 4, delay: 1 }}
            />
            
            {/* Sparkles */}
            {Array.from({ length: 35 }).map((_, i) => (
              <SparkleParticle 
                key={i}
                x={Math.random() * 100}
                y={Math.random() * 100}
                delay={i * 0.15}
                color={i % 3 === 0 ? '#ff00ff' : i % 3 === 1 ? '#00ffff' : '#ffff00'}
              />
            ))}
            
            {/* Vegas icons */}
            <FloatingIcon icon="🎰" startX={10} startY={28} delay={0} size={44} opacity={0.22} color="#ff00ff" />
            <FloatingIcon icon="🎭" startX={85} startY={58} delay={1} size={40} opacity={0.2} color="#00ffff" />
            <FloatingIcon icon="🍸" startX={18} startY={75} delay={2} size={36} opacity={0.2} color="#ffff00" />
            <FloatingIcon icon="💃" startX={78} startY={20} delay={0.5} size={38} opacity={0.18} color="#ff00ff" />
            <FloatingIcon icon="🎪" startX={48} startY={10} delay={1.5} size={42} opacity={0.2} color="#00ffff" />
            <FloatingIcon icon="🎵" startX={30} startY={50} delay={2.5} size={32} opacity={0.18} color="#ffff00" />
            <FloatingIcon icon="💰" startX={65} startY={82} delay={0.8} size={35} opacity={0.2} color="#ffd700" />
          </>
        );

      // ========== SPORTS BETTING ==========
      case 'sports-betting':
        return (
          <>
            {/* Dark blue sports gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f2d] via-[#1e3a5f] to-[#0d1f2d]" />
            
            {/* Field lines effect */}
            <div 
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: 'linear-gradient(0deg, transparent 49%, rgba(255,255,255,0.5) 50%, transparent 51%)',
                backgroundSize: '100% 100px',
              }}
            />
            
            {/* Sports icons */}
            <FloatingIcon icon="⚽" startX={10} startY={25} delay={0} size={42} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="🏀" startX={85} startY={55} delay={1} size={40} opacity={0.2} color="#ff6d00" />
            <FloatingIcon icon="🏈" startX={20} startY={72} delay={2} size={38} opacity={0.2} color="#8b4513" />
            <FloatingIcon icon="⚾" startX={75} startY={18} delay={0.5} size={36} opacity={0.2} color="#ffffff" />
            <FloatingIcon icon="🎾" startX={50} startY={85} delay={1.5} size={34} opacity={0.2} color="#ccff00" />
            <FloatingIcon icon="🏆" startX={30} startY={45} delay={2.5} size={40} opacity={0.22} color="#ffd600" />
            <FloatingIcon icon="🥇" startX={65} startY={35} delay={0.8} size={35} opacity={0.18} color="#ffd600" />
            <FloatingIcon icon="⏱️" startX={42} startY={60} delay={1.8} size={32} opacity={0.18} color="#00c853" />
          </>
        );

      // ========== CHAMPIONSHIP ==========
      case 'championship':
        return (
          <>
            {/* Dark with gold accents */}
            <div className="absolute inset-0 bg-[#0a0a0a]" />
            
            {/* Gold spotlight */}
            <motion.div
              className="absolute w-96 h-96 rounded-full blur-3xl"
              style={{ top: '0%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,215,0,0.1)' }}
              animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 4 }}
            />
            
            {/* Sparkles */}
            {Array.from({ length: 30 }).map((_, i) => (
              <SparkleParticle 
                key={i}
                x={Math.random() * 100}
                y={Math.random() * 100}
                delay={i * 0.2}
                color={i % 3 === 0 ? '#ffd700' : i % 3 === 1 ? '#c0c0c0' : '#cd7f32'}
              />
            ))}
            
            {/* Championship icons */}
            <FloatingIcon icon="🏆" startX={50} startY={8} delay={0} size={50} opacity={0.25} color="#ffd700" />
            <FloatingIcon icon="🥇" startX={10} startY={30} delay={0.5} size={40} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="🥈" startX={85} startY={45} delay={1} size={38} opacity={0.2} color="#c0c0c0" />
            <FloatingIcon icon="🥉" startX={15} startY={70} delay={1.5} size={36} opacity={0.2} color="#cd7f32" />
            <FloatingIcon icon="👑" startX={80} startY={75} delay={2} size={42} opacity={0.2} color="#ffd700" />
            <FloatingIcon icon="⭐" startX={35} startY={55} delay={2.5} size={34} opacity={0.22} color="#ffd700" />
            <FloatingIcon icon="🎖️" startX={65} startY={20} delay={0.8} size={36} opacity={0.18} color="#ffd700" />
          </>
        );

      // ========== MINIMAL DARK ==========
      case 'minimal-dark':
        return (
          <>
            <div className="absolute inset-0 bg-[#0a0a0a]" />
            {/* Subtle gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.03)_0%,transparent_50%)]" />
          </>
        );

      // ========== MINIMAL LIGHT ==========
      case 'minimal-light':
        return (
          <>
            <div className="absolute inset-0 bg-white" />
            {/* Subtle gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,0,0,0.02)_0%,transparent_50%)]" />
          </>
        );

      // ========== DEFAULT ==========
      default:
        return (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(234,179,8,0.15),transparent)]" />
          </>
        );
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {renderThemeBackground()}
      
      {/* Grid overlay for all themes */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(${theme.colors.text}40 1px, transparent 1px), linear-gradient(90deg, ${theme.colors.text}40 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}

