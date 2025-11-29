import { useState, useEffect, useRef } from 'react';
import './AsyncGameScreen.css';
import PushUpModel from './PushUpModel';
import AssetLoader from './AssetLoader';

interface AsyncGameScreenProps {
  onBackToStart: () => void;
}

const AsyncGameScreen = ({ onBackToStart }: AsyncGameScreenProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showReady, setShowReady] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isGameCleared, setIsGameCleared] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);
  const [remainingReps, setRemainingReps] = useState<number>(30);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);
  const pauseTimeRef = useRef<number>(0);
  const isGoingDownRef = useRef<boolean>(true);
  const repCountRef = useRef<number>(0);
  const countdownStartTimeRef = useRef<number | null>(null);
  const musicStartOffsetRef = useRef<number>(0);

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

  // 一時停止処理
  useEffect(() => {
    if (isPaused) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isPaused]);

  // アニメーション処理
  useEffect(() => {
    if (!isGameStarted) return;

    const GAME_DURATION = 60000; // 1分 = 60000ms

    const animate = (timestamp: number) => {
      if (isPaused) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        gameStartTimeRef.current = timestamp;
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((error) => {
            console.error('メトロノーム音楽の再生に失敗しました:', error);
          });
          musicStartOffsetRef.current = audioRef.current.currentTime * 1000;
        }
      }

      const musicTime = audioRef.current ? (audioRef.current.currentTime * 1000) - musicStartOffsetRef.current : 0;

      if (musicTime >= GAME_DURATION) {
        setIsGameCleared(true);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setTimeout(() => {
          onBackToStart();
        }, 5000);
        return;
      }

      const cycleTime = musicTime % 2000;

      if (cycleTime < 500) {
        // 1拍目 (0-500ms): 下降（0.5秒）
        const progress = cycleTime / 500; // 0→1
        const frame = 25 + (25 * progress); // 25→50
        setCurrentFrame(Math.round(frame));
        const scale = 1.0 - (0.6 * progress); // 1.0→0.4
        setCircleScale(scale);
        setCircleVisible(true);

        isGoingDownRef.current = true;
      } else if (cycleTime < 1000) {
        // 2拍目 (500-1000ms): 静止（最下点）
        setCurrentFrame(50);
        setCircleScale(0.4);
        setCircleVisible(true);

        // 1拍目（下降）から2拍目（静止）に入った瞬間にカウント
        if (isGoingDownRef.current) {
          isGoingDownRef.current = false;
          repCountRef.current += 1;
          setRemainingReps(30 - repCountRef.current);
        }
      } else if (cycleTime < 1500) {
        // 3拍目 (1000-1500ms): 上昇（0.5秒）
        const progress = (cycleTime - 1000) / 500; // 0→1
        const frame = 50 - (25 * progress); // 50→25
        setCurrentFrame(Math.round(frame));
        const scale = 0.4 + (0.6 * progress); // 0.4→1.0
        setCircleScale(scale);
        setCircleVisible(true);

        isGoingDownRef.current = false;
      } else {
        // 4拍目 (1500-2000ms): 静止（最上点）
        setCurrentFrame(25);
        setCircleScale(1.0);
        setCircleVisible(true);

        isGoingDownRef.current = false;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isGameStarted, isPaused, onBackToStart]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePause = () => {
    setIsPaused(true);
    if (startTimeRef.current && gameStartTimeRef.current) {
      pauseTimeRef.current = performance.now() - startTimeRef.current;
    }
  };

  const handleResume = () => {
    const now = performance.now();
    const pauseDuration = now - (startTimeRef.current! + pauseTimeRef.current);
    startTimeRef.current = startTimeRef.current! + pauseDuration;
    gameStartTimeRef.current = gameStartTimeRef.current! + pauseDuration;

    if (audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.error('音楽の再生に失敗しました:', error);
      });
    }

    setIsPaused(false);
  };

  const handleRestart = () => {
    window.location.reload();
  };

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
    <div className="async-game-screen">
      <img
        src="/image/pushup_background.jpg"
        alt="Background"
        className="async-game-background"
      />
      <img
        src="/image/circle.png"
        alt="Circle"
        className="async-circle-center"
        style={{
          transform: `translate(-50%, -50%) scale(${circleScale})`,
          opacity: circleVisible ? 1 : 0,
          transition: 'opacity 0.1s ease'
        }}
      />
      {showReady && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">準備完了！</h1>
        </div>
      )}
      {!showReady && countdown > 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <div className="async-countdown-display">
            {countdown}
          </div>
        </div>
      )}
      {countdown === 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">スタート！</h1>
        </div>
      )}
      {isGameStarted && !isGameCleared && (
        <>
          <button className="async-pause-button" onClick={handlePause}>
            ⏸
          </button>
          <div className="async-rep-counter">
            {remainingReps}/30
          </div>
        </>
      )}
      {isPaused && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">一時停止中</h1>
          <div className="async-pause-buttons">
            <button onClick={handleResume} className="async-btn-primary">
              再開
            </button>
            <button onClick={handleRestart} className="async-btn-secondary">
              最初に戻る
            </button>
          </div>
        </div>
      )}
      {isGameCleared && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">ゲームクリア！</h1>
          <p className="async-countdown-text">お疲れ様でした！</p>
        </div>
      )}
      <div className="async-model-container">
        <PushUpModel
          modelPath="/models/pushUp.glb"
          currentFrame={currentFrame}
        />
      </div>
    </div>
  );
};

export default AsyncGameScreen;
