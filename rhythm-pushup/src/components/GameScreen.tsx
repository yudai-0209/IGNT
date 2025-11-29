import { useState, useEffect, useRef } from 'react';
import './GameScreen.css';
import PushUpModel from './PushUpModel';
import PoseDetection from './PoseDetection';
import type { CalibrationData } from '../types';

interface GameScreenProps {
  calibrationData: CalibrationData | null;
  onBackToStart: () => void;
}

function GameScreen({ calibrationData, onBackToStart: _onBackToStart }: GameScreenProps) {
  const [countdown, setCountdown] = useState<number>(15);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [targetFrame, setTargetFrame] = useState<number>(25);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);
  const [demoFrame, setDemoFrame] = useState<number>(25);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isGoingDownRef = useRef<boolean>(true);
  const animationFrameIdRef = useRef<number | null>(null);
  const countdownStartTimeRef = useRef<number | null>(null);
  const demoStartTimeRef = useRef<number | null>(null);
  const demoAnimationFrameRef = useRef<number | null>(null);
  const interpolationFrameRef = useRef<number | null>(null);
  const wakeLockRef = useRef<globalThis.WakeLockSentinel | null>(null);

  const ANIMATION_DURATION = 1000; // 1秒

  // 画面スリープを防止（Wake Lock API）
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && navigator.wakeLock) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake Lock: 画面スリープ防止を有効化');
        }
      } catch (err) {
        console.log('Wake Lock: 取得できませんでした', err);
      }
    };

    requestWakeLock();

    // ページが再表示されたときに再取得
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        console.log('Wake Lock: 画面スリープ防止を解除');
      }
    };
  }, []);

  // プリロード済みの音楽を使用
  useEffect(() => {
    if (!audioRef.current) {
      const cachedAudioUrl = (window as any).__cachedAudioUrl;
      audioRef.current = new Audio(cachedAudioUrl || '/music/Metronome_120.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0;
      if (!cachedAudioUrl) {
        audioRef.current.load();
      }
    }
  }, []);

  // フレーム補間（滑らかなアニメーション）
  useEffect(() => {
    if (!isGameStarted) return;

    const interpolate = () => {
      setCurrentFrame(prev => {
        const diff = targetFrame - prev;
        // 目標フレームに向かって60%ずつ近づける（リアルタイム性最優先）
        if (Math.abs(diff) < 0.01) {
          return targetFrame; // 十分近づいたら目標値にする
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

  // カウントダウン処理（時刻ベースで正確に）
  useEffect(() => {
    if (!countdownStartTimeRef.current) {
      countdownStartTimeRef.current = performance.now();
    }

    let frameId: number;

    const checkCountdown = () => {
      const elapsed = performance.now() - countdownStartTimeRef.current!;
      const newCountdown = Math.max(0, 15 - Math.floor(elapsed / 1000));

      if (newCountdown !== countdown) {
        setCountdown(newCountdown);
      }

      if (newCountdown > 0) {
        frameId = requestAnimationFrame(checkCountdown);
      } else if (newCountdown === 0 && isModelLoaded) {
        // カウントダウン終了かつモデル読み込み完了でゲーム開始
        setIsGameStarted(true);
      }
    };

    frameId = requestAnimationFrame(checkCountdown);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [countdown, isModelLoaded]);

  // デモアニメーション（カウントダウン10秒→8秒の間に2回腕立て）
  useEffect(() => {
    if (countdown <= 10 && countdown > 0 && !isGameStarted) {
      if (!demoStartTimeRef.current) {
        demoStartTimeRef.current = performance.now();
      }

      const animateDemo = (timestamp: number) => {
        const elapsed = timestamp - demoStartTimeRef.current!;

        // 2秒後から4秒間で2回腕立て
        if (elapsed >= 2000 && elapsed < 6000) {
          const demoElapsed = elapsed - 2000;
          const cycleTime = demoElapsed % 2000;
          const isDown = cycleTime < 1000;
          const progress = isDown ? cycleTime / 1000 : (cycleTime - 1000) / 1000;

          if (isDown) {
            const frame = 25 + (25 * progress);
            setDemoFrame(Math.round(frame));
          } else {
            const frame = 50 - (25 * progress);
            setDemoFrame(Math.round(frame));
          }
        } else if (elapsed >= 6000) {
          setDemoFrame(25);
        } else {
          setDemoFrame(25);
        }

        if (countdown > 0 && !isGameStarted) {
          demoAnimationFrameRef.current = requestAnimationFrame(animateDemo);
        }
      };

      demoAnimationFrameRef.current = requestAnimationFrame(animateDemo);

      return () => {
        if (demoAnimationFrameRef.current) {
          cancelAnimationFrame(demoAnimationFrameRef.current);
        }
      };
    } else {
      demoStartTimeRef.current = null;
      setDemoFrame(25);
    }
  }, [countdown, isGameStarted]);

  // メトロノーム音楽の再生とcircleアニメーション（ゲーム開始後のみ）
  useEffect(() => {
    if (!isGameStarted) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        // 初回フレームで音楽を同時に開始
        if (audioRef.current) {
          // 音楽を0秒から確実に開始
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((error) => {
            console.error('メトロノーム音楽の再生に失敗しました:', error);
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
      {countdown > 5 && (
        <div className="countdown-overlay">
          <h1 className="countdown-title">15秒後に開始！</h1>
          <p className="countdown-text">腕立て伏せの準備をしてください</p>
        </div>
      )}
      {countdown <= 5 && countdown > 0 && (
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
      {/* プリロード済みのモデルを使用 */}
      <div className="model-container" style={{ visibility: countdown > 10 ? 'hidden' : 'visible' }}>
        <PushUpModel
          modelPath={(window as any).__cachedModelUrl || '/models/pushUp.glb'}
          currentFrame={isGameStarted ? currentFrame : demoFrame}
          onLoad={handleModelLoad}
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
