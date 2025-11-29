import { useState, useEffect, useRef } from 'react';
import './GameScreen.css';
import PushUpModel from './PushUpModel';
import PoseDetection from './PoseDetection';
import AssetLoader from './AssetLoader';
import type { CalibrationData } from '../types';

interface GameScreenProps {
  calibrationData: CalibrationData | null;
  onBackToStart: () => void;
}

function GameScreen({ calibrationData, onBackToStart: _onBackToStart }: GameScreenProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showReady, setShowReady] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [targetFrame, setTargetFrame] = useState<number>(25);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isGoingDownRef = useRef<boolean>(true);
  const animationFrameIdRef = useRef<number | null>(null);
  const countdownStartTimeRef = useRef<number | null>(null);
  const interpolationFrameRef = useRef<number | null>(null);

  const ANIMATION_DURATION = 1000; // 1秒

  // ローディング完了時
  const handleLoadComplete = () => {
    // プリロードされた音楽URLを使用
    const preloadedUrl = (window as any).__preloadedMusicUrl;
    if (preloadedUrl) {
      audioRef.current = new Audio(preloadedUrl);
    } else {
      audioRef.current = new Audio('/music/Metronome_120.mp3');
    }
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0;

    setIsLoading(false);
    setShowReady(true);

    // 1秒後に「準備完了！」を消してカウントダウン開始
    setTimeout(() => {
      setShowReady(false);
      countdownStartTimeRef.current = performance.now();
    }, 1000);
  };

  // フレーム補間（滑らかなアニメーション）
  useEffect(() => {
    if (!isGameStarted) return;

    const interpolate = () => {
      setCurrentFrame(prev => {
        const diff = targetFrame - prev;
        if (Math.abs(diff) < 0.01) {
          return targetFrame;
        }
        return prev + diff * 0.6;
      });
      interpolationFrameRef.current = requestAnimationFrame(interpolate);
    };

    interpolationFrameRef.current = requestAnimationFrame(interpolate);

    return () => {
      if (interpolationFrameRef.current) {
        cancelAnimationFrame(interpolationFrameRef.current);
      }
    };
  }, [targetFrame, isGameStarted]);

  // カウントダウン処理（5秒）
  useEffect(() => {
    if (isLoading || showReady) return;

    let frameId: number;

    const checkCountdown = () => {
      if (!countdownStartTimeRef.current) return;

      const elapsed = performance.now() - countdownStartTimeRef.current;
      const newCountdown = Math.max(0, 5 - Math.floor(elapsed / 1000));

      if (newCountdown !== countdown) {
        setCountdown(newCountdown);
      }

      if (newCountdown > 0) {
        frameId = requestAnimationFrame(checkCountdown);
      } else if (newCountdown === 0) {
        setIsGameStarted(true);
      }
    };

    frameId = requestAnimationFrame(checkCountdown);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [countdown, isLoading, showReady]);

  // メトロノーム音楽の再生とcircleアニメーション（ゲーム開始後のみ）
  useEffect(() => {
    if (!isGameStarted) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((error) => {
            console.error('メトロノーム音楽の再生に失敗しました:', error);
          });
        }
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      if (isGoingDownRef.current) {
        const scale = 1.0 - (0.6 * progress);
        setCircleScale(scale);
        setCircleVisible(true);

        if (progress >= 1) {
          isGoingDownRef.current = false;
          startTimeRef.current = timestamp - (elapsed - ANIMATION_DURATION);
        }
      } else {
        setCircleScale(0.4);
        setCircleVisible(true);

        if (progress >= 1) {
          isGoingDownRef.current = true;
          startTimeRef.current = timestamp - (elapsed - ANIMATION_DURATION);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isGameStarted]);

  // ローディング中
  if (isLoading) {
    return (
      <AssetLoader
        onLoadComplete={handleLoadComplete}
        modelPath="/models/pushUp.glb"
        musicPath="/music/Metronome_120.mp3"
        imagePaths={['/image/pushup_background.jpg', '/image/circle.png']}
      />
    );
  }

  return (
    <div className="game-screen">
      <img
        src="/image/pushup_background.jpg"
        alt="Background"
        className="game-background"
      />
      <img
        src="/image/circle.png"
        alt="Circle"
        className="circle-center"
        style={{
          transform: `translate(-50%, -50%) scale(${circleScale})`,
          opacity: circleVisible ? 1 : 0,
          transition: 'opacity 0.1s ease'
        }}
      />
      {showReady && (
        <div className="countdown-overlay">
          <h1 className="countdown-title">準備完了！</h1>
        </div>
      )}
      {!showReady && countdown > 0 && !isGameStarted && (
        <div className="countdown-overlay">
          <div className="countdown-display">
            {countdown}
          </div>
        </div>
      )}
      {countdown === 0 && !isGameStarted && (
        <div className="countdown-overlay">
          <h1 className="countdown-title">スタート！</h1>
        </div>
      )}
      <div className="model-container">
        <PushUpModel
          modelPath="/models/pushUp.glb"
          currentFrame={currentFrame}
        />
      </div>
      {isGameStarted && (
        <PoseDetection
          calibrationData={calibrationData}
          onFrameUpdate={setTargetFrame}
        />
      )}
    </div>
  );
}

export default GameScreen;
