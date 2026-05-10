import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Vector } from '../types';

interface JoystickProps {
  onMove: (dir: Vector) => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const [isCasting, setIsCasting] = useState(false);
  const [position, setPosition] = useState<Vector>({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);
  const radius = 50;

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsCasting(true);
    handleMove(e);
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
    if (!isCasting || !baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const normalizedDistance = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    
    const moveX = Math.cos(angle) * normalizedDistance;
    const moveY = Math.sin(angle) * normalizedDistance;

    setPosition({ x: moveX, y: moveY });
    onMove({ x: moveX / radius, y: moveY / radius });
  };

  const handleEnd = () => {
    setIsCasting(false);
    setPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (isCasting) {
      window.addEventListener('touchmove', handleMove as any, { passive: false });
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('mousemove', handleMove as any);
      window.addEventListener('mouseup', handleEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleMove as any);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [isCasting]);

  return (
    <div 
      className="relative w-32 h-32 flex items-center justify-center select-none touch-none"
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <div 
        ref={baseRef}
        className="w-24 h-24 rounded-full bg-white/5 border-2 border-white/10 backdrop-blur-md flex items-center justify-center"
      >
        <motion.div
          animate={{ x: position.x, y: position.y }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="w-12 h-12 rounded-full bg-[#00ccff] shadow-[0_0_15px_rgba(0,204,255,0.6)] border-2 border-white/20"
        />
      </div>
    </div>
  );
};
