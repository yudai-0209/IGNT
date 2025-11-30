import { useState, useEffect, useRef } from 'react';
import './AsyncGameScreen.css';
import PushUpModel from './PushUpModel';
import AssetLoader from './AssetLoader';
import { useWakeLock } from '../hooks/useWakeLock';

interface AsyncGameScreenProps {
  onBackToStart: () => void;
}

const AsyncGameScreen = ({ onBackToStart }: AsyncGameScreenProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [showReady, setShowReady] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isGameCleared, setIsGameCleared] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);
  const [remainingReps, setRemainingReps] = useState<number>(30);
  const [showWarmUpMessage, setShowWarmUpMessage] = useState<boolean>(true);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);
  const pauseTimeRef = useRef<number>(0);
  const isGoingDownRef = useRef<boolean>(true);
  const repCountRef = useRef<number>(0);
  const countdownStartTimeRef = useRef<number | null>(null);
  const musicStartOffsetRef = useRef<number>(0);

  // ゲーム中は画面スリープを防止
  useWakeLock(isGameStarted && !isPaused && !isGameCleared);

  // アセットローディング完了時（ファイルダウンロード完了）
  const handleLoadComplete = () => {
    // アンロック済みの音声があればそれを優先使用
    const unlockedAudio = (window as any).__unlockedAudio;
    if (unlockedAudio) {
      console.log('アンロック済み音声を使用');
      audioRef.current = unlockedAudio;
    } else {
      // プリロードされた音楽URLを使用
      const preloadedUrl = (window as any).__preloadedMusicUrl;
      if (preloadedUrl) {
        audioRef.current = new Audio(preloadedUrl);
      } else {
        audioRef.current = new Audio('/music/Metronome_120.mp3');
      }
    }
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = 0; // 音量は0のまま維持
    }

    // ファイルダウンロード完了、次は3Dモデルのシーン構築を待つ
    setIsLoading(false);
  };

  // 3Dモデル準備完了時（シーン構築完了）
  const handleModelReady = () => {
    console.log('3Dモデルのシーン構築完了');

    // 準備完了のタイミングで音量を1にする
    if (audioRef.current) {
      audioRef.current.volume = 1.0;
      console.log('音量を1.0に設定');
    }

    setIsModelReady(true);
    setShowReady(true);

    // 1秒後に「準備完了！」を消してカウントダウン開始
    setTimeout(() => {
      setShowReady(false);
      countdownStartTimeRef.current = performance.now();
    }, 1000);
  };

  // カウントダウン処理（5秒）
  useEffect(() => {
    if (isLoading || !isModelReady || showReady) return;

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
  }, [countdown, isLoading, isModelReady, showReady]);

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

    const GAME_DURATION = 64000; // 64秒 = 64000ms

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
            const errorMessage = `音楽再生エラー: ${error.name} - ${error.message}`;
            setAudioError(errorMessage);
          });
          musicStartOffsetRef.current = audioRef.current.currentTime * 1000;
        }
      }

      const musicTime = audioRef.current ? (audioRef.current.currentTime * 1000) - musicStartOffsetRef.current : 0;

      // 3秒経過したらウォームアップメッセージを非表示
      if (musicTime >= 3000 && showWarmUpMessage) {
        setShowWarmUpMessage(false);
      }

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
        // 最初の4秒（2回分）はカウントしない
        if (isGoingDownRef.current) {
          isGoingDownRef.current = false;
          if (musicTime >= 4000) {
            repCountRef.current += 1;
            setRemainingReps(30 - repCountRef.current);
          }
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
  }, [isGameStarted, isPaused, onBackToStart, showWarmUpMessage]);

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
          opacity: circleVisible && isModelReady ? 1 : 0,
          transition: 'opacity 0.1s ease'
        }}
      />
      {!isModelReady && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">3Dモデル準備中...</h1>
        </div>
      )}
      {isModelReady && showReady && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">準備完了！</h1>
        </div>
      )}
      {isModelReady && !showReady && countdown > 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <div className="async-countdown-display">
            {countdown}
          </div>
        </div>
      )}
      {isModelReady && countdown === 0 && !isGameStarted && (
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
            <div className="async-rep-label">残り</div>
            {remainingReps}/30
          </div>
        </>
      )}
      {isGameStarted && !isGameCleared && !isPaused && showWarmUpMessage && (
        <div className="async-countdown-overlay" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
          <h1 className="async-countdown-title">リズムに合わせて腕立てしよう！</h1>
        </div>
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
      {audioError && (
        <div className="async-countdown-overlay" style={{ backgroundColor: 'rgba(200, 0, 0, 0.9)' }}>
          <h1 className="async-countdown-title" style={{ fontSize: '24px' }}>エラー発生</h1>
          <p className="async-countdown-text" style={{ fontSize: '14px', wordBreak: 'break-all', padding: '0 20px' }}>
            {audioError}
          </p>
          <button
            onClick={() => {
              setAudioError(null);
              if (audioRef.current) {
                audioRef.current.play().catch((e) => {
                  setAudioError(`再試行失敗: ${e.name} - ${e.message}`);
                });
              }
            }}
            style={{
              marginTop: '20px',
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#fff',
              color: '#c00',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            タップして再試行
          </button>
          <button
            onClick={onBackToStart}
            style={{
              marginTop: '10px',
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              color: '#fff',
              border: '1px solid #fff',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            スタートに戻る
          </button>
        </div>
      )}
      <div className="async-model-container">
        <PushUpModel
          modelPath="/models/pushUp.glb"
          currentFrame={currentFrame}
          onLoad={handleModelReady}
        />
      </div>
    </div>
  );
};

export default AsyncGameScreen;
