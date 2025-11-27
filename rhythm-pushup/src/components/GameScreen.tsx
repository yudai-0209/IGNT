import { useState, useEffect, useRef } from 'react';
import './GameScreen.css';
import PushUpModel from './PushUpModel';
import PoseDetection from './PoseDetection';
import type { CalibrationData } from '../types';

interface GameScreenProps {
  calibrationData: CalibrationData | null;
}

function GameScreen({ calibrationData }: GameScreenProps) {
  const [countdown, setCountdown] = useState<number>(15);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isGoingDownRef = useRef<boolean>(true);
  const animationFrameIdRef = useRef<number | null>(null);

  const ANIMATION_DURATION = 1000; // 1秒

  // カウントダウン処理
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && isModelLoaded) {
      // カウントダウン終了かつモデル読み込み完了でゲーム開始
      setIsGameStarted(true);
    }
  }, [countdown, isModelLoaded]);

  // メトロノーム音楽の再生とcircleアニメーション（ゲーム開始後のみ）
  useEffect(() => {
    if (!isGameStarted) return;

    // 音楽を準備
    audioRef.current = new Audio('/music/pushup_music.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0; // 音量を最大に設定

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        // 初回フレームで音楽を同時に開始
        if (audioRef.current) {
          audioRef.current.play().catch((error) => {
            console.error('音楽の再生に失敗しました:', error);
          });
        }
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      if (isGoingDownRef.current) {
        // 下降フェーズ: circle 1.0 → 0.4
        const scale = 1.0 - (0.6 * progress);
        setCircleScale(scale);
        setCircleVisible(true);

        if (progress >= 1) {
          isGoingDownRef.current = false;
          startTimeRef.current = timestamp - (elapsed - ANIMATION_DURATION);
        }
      } else {
        // 上昇フェーズ: circle 0.4のまま
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
      // 音楽を停止
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isGameStarted]);

  const handleModelLoad = () => {
    setIsModelLoaded(true);
  };

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
      {countdown > 0 && (
        <div className="countdown-overlay">
          <h1 className="countdown-title">腕立て伏せの準備をしてください</h1>
          <div className="countdown-display">
            {countdown}
          </div>
          <p className="countdown-text">ゲーム開始まで {countdown} 秒</p>
        </div>
      )}
      {countdown === 0 && !isGameStarted && (
        <div className="countdown-overlay">
          <h1 className="countdown-title">スタート！</h1>
        </div>
      )}
      {/* 最初からモデルをロード開始、残り10秒で表示 */}
      <div className="model-container" style={{ visibility: countdown > 10 ? 'hidden' : 'visible' }}>
        <PushUpModel
          modelPath="/models/pushUp.glb"
          currentFrame={currentFrame}
          onLoad={handleModelLoad}
        />
      </div>
      {isGameStarted && (
        <PoseDetection
          calibrationData={calibrationData}
          onFrameUpdate={setCurrentFrame}
        />
      )}
    </div>
  );
}

export default GameScreen;
