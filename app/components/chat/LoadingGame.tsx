import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState(359);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percentage = (timeLeft / 359) * 100;

  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 transform -rotate-90">
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-700 opacity-20" />
        <circle
          cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none"
          strokeDasharray={`${2 * Math.PI * 28}`}
          strokeDashoffset={`${2 * Math.PI * 28 * (1 - percentage / 100)}`}
          className="text-cyan-400 transition-all duration-1000" strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-green-400">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

interface Obstacle {
  id: number;
  x: number;
  type: 'cactus' | 'bird';
}

const HACKER_MESSAGES = [
  '> Initializing neural network...',
  '> Loading AI models...',
  '> Compiling components...',
  '> Optimizing algorithms...',
  '> Generating UI patterns...',
  '> Deploying creativity...',
];

export function LoadingGame() {
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [dinoY, setDinoY] = useState(0);
  const [velocityY, setVelocityY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const animationFrameRef = useRef<number>();
  const gameSpeed = useRef(3);
  const gravity = 0.6;
  const jumpPower = 14;
  const obstacleCounter = useRef(0);

  // Typing animation for terminal message
  useEffect(() => {
    const msg = HACKER_MESSAGES[messageIndex];
    let index = 0;
    const interval = setInterval(() => {
      if (index < msg.length) {
        setMessage(msg.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setMessage('');
          setMessageIndex((prev) => (prev + 1) % HACKER_MESSAGES.length);
        }, 1500);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [messageIndex]);

  // Game Loop
  const loop = useCallback(() => {
    if (gameOver) return;

    // Update dino position
    setDinoY((prevY) => {
      let newVelocity = velocityY;
      newVelocity -= gravity;
      let newY = prevY + newVelocity;

      if (newY <= 0) {
        newY = 0;
        newVelocity = 0;
        setIsJumping(false);
      }

      setVelocityY(newVelocity);
      return newY;
    });

    // Move obstacles and detect collisions
    setObstacles((prev) => {
      const updated = prev
        .map((obs) => ({ ...obs, x: obs.x - gameSpeed.current }))
        .filter((obs) => obs.x > -50);

      updated.forEach((obs) => {
        const dinoLeft = 50;
        const dinoRight = 90;
        const dinoBottom = 48 + dinoY;
        const dinoTop = 90 + dinoY;

        const obsLeft = obs.x;
        const obsRight = obs.x + 30;
        const obsBottom = obs.type === 'bird' ? 80 : 48;
        const obsTop = obsBottom + 30;

        if (
          dinoRight > obsLeft &&
          dinoLeft < obsRight &&
          dinoTop > obsBottom &&
          dinoBottom < obsTop
        ) {
          setGameOver(true);
        }
      });

      return updated;
    });

    // Spawn obstacles occasionally (only one at a time for score < 100)
    setObstacles((prev) => {
      const currentScore = Math.floor(score / 10);
      const maxObstacles = currentScore < 100 ? 1 : 2;
      
      if (prev.length < maxObstacles && Math.random() < 0.02) {
        return [
          ...prev,
          {
            id: obstacleCounter.current++,
            x: 450,
            type: Math.random() > 0.7 ? 'bird' : 'cactus',
          },
        ];
      }
      return prev;
    });

    // Increment score
    setScore((s) => s + 1);

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [gameOver, velocityY]);

  useEffect(() => {
    if (!gameOver) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [loop, gameOver]);

  // Simulate progress bar / steps
  useEffect(() => {
    const steps = [2000, 4000, 6000];
    const timers = steps.map((delay, i) =>
      setTimeout(() => setCurrentStep(i + 2), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Jump or restart
  const handleJump = () => {
    if (gameOver) {
      setGameOver(false);
      setScore(0);
      setDinoY(0);
      setVelocityY(0);
      setIsJumping(false);
      setObstacles([]);
      gameSpeed.current = 3;
      obstacleCounter.current = 0;
      return;
    }

    if (!isJumping) {
      setIsJumping(true);
      setVelocityY(jumpPower);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-4">
      {/* Countdown Timer */}
      <CountdownTimer />

      {/* Status */}
      <div className="text-center space-y-1">
        <div className="text-lg font-mono font-bold text-green-400">
          <span className="animate-pulse">▸</span> Please wait … Elaric is
          building your app
        </div>
        <div className="text-sm font-mono font-semibold text-cyan-400">
          SCORE: {Math.floor(score / 10)}{' '}
          {gameOver && '- GAME OVER! Click to restart'}
        </div>
      </div>

      {/* Game Area */}
      <div
        onClick={handleJump}
        onKeyDown={(e) => e.key === ' ' && handleJump()}
        tabIndex={0}
        className="relative w-[450px] h-[250px] bg-gradient-to-b from-gray-900 to-black rounded-lg border-2 border-green-500/30 overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.3)] cursor-pointer focus:outline-none"
      >
        <div className="absolute bottom-12 left-0 right-0 h-0.5 bg-green-500/50" />

        {/* Dino */}
        <div
          className="absolute left-12 text-4xl z-10"
          style={{ bottom: 48 + dinoY }}
        >
{gameOver ? '💀' : <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>🦖</span>}

        </div>

        {/* Obstacles */}
        {obstacles.map((obs) => (
          <div
            key={obs.id}
            className="absolute text-3xl"
            style={{
              left: obs.x,
              bottom: obs.type === 'bird' ? 80 : 48,
            }}
          >
            {obs.type === 'cactus' ? '🌵' : '🦅'}
          </div>
        ))}

        {/* Message */}
        <div className="absolute bottom-2 left-2 right-2 font-mono text-xs text-green-400 bg-black/50 p-2 rounded border border-green-500/30 z-20">
          {message}
          <span className="animate-pulse">_</span>
        </div>
      </div>

      {/* Footer */}
      <motion.div
        className="text-[10px] font-mono text-green-500/50 select-none"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        [COMPILING] Building your masterpiece...
      </motion.div>
    </div>
  );
}
