import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Vector } from '../types';

interface JoystickProps {
  onMove: (dir: Vector) => void;
  position: Vector;
  onEnd: () => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, position, onEnd }) => {
  const [knobPosition, setKnobPosition] = useState<Vector>({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);
  const radius = 50;

  const handleMove = (e: TouchEvent | MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - position.x;
    const dy = clientY - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const normalizedDistance = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    
    const moveX = Math.cos(angle) * normalizedDistance;
    const moveY = Math.sin(angle) * normalizedDistance;

    setKnobPosition({ x: moveX, y: moveY });
    onMove({ x: moveX / radius, y: moveY / radius });
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e);
    };
    
    const onTouchEnd = () => {
      setKnobPosition({ x: 0, y: 0 });
      onEnd();
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mousemove', handleMove as any);
    window.addEventListener('mouseup', onTouchEnd);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('mouseup', onTouchEnd);
    };
  }, [position, onEnd, onMove]);

  return (
    <div 
      ref={baseRef}
      style={{ left: position.x - 48, top: position.y - 48 }}
      className="fixed w-24 h-24 rounded-full bg-white/5 border-2 border-white/10 backdrop-blur-md flex items-center justify-center select-none touch-none z-[70] pointer-events-none"
    >
      <motion.div
        animate={{ x: knobPosition.x, y: knobPosition.y }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="w-12 h-12 rounded-full bg-[#00ccff] shadow-[0_0_15px_rgba(0,204,255,0.6)] border-2 border-white/20"
      />
    </div>
  );
};
