import { useState, useEffect, useRef } from 'react';
import './AsyncGameScreen.css';
import PushUpModel from './PushUpModel';
import AssetLoader from './AssetLoader';
import { useWakeLock } from '../hooks/useWakeLock';

// イージング関数
const easeInCubic = (t: number): number => t * t * t;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutBounce = (t: number): number => {
  if (t < 0.5) {
    return 1 - Math.cos(t * Math.PI * 4) * (1 - t * 2) * 0.15;
  }
  return 1;
};

interface AsyncGameScreenProps {
  onBackToStart: () => void;
}

const AsyncGameScreen = ({ onBackToStart }: AsyncGameScreenProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [showReady, setShowReady] = useState<boolean>(false);
  const [showPosturePrep, setShowPosturePrep] = useState<boolean>(false);
  const [showExerciseInfo, setShowExerciseInfo] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isGameCleared, setIsGameCleared] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleRotation, setCircleRotation] = useState<number>(0);
  const [circleOpacity, setCircleOpacity] = useState<number>(1.0);
  const [circleBlur, setCircleBlur] = useState<number>(0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);
  const [burstScale, setBurstScale] = useState<number>(0);
  const [burstOpacity, setBurstOpacity] = useState<number>(0);
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

  // 画面スリープを防止（ゲーム画面にいる間は常に有効）
  useWakeLock(true);

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

    // 1秒後に「準備完了！」を消して姿勢準備画面へ
    setTimeout(() => {
      setShowReady(false);
      setShowPosturePrep(true);
    }, 1000);
  };

  // 姿勢準備画面（5秒間表示）
  useEffect(() => {
    if (!showPosturePrep) return;

    const timer = setTimeout(() => {
      setShowPosturePrep(false);
      setShowExerciseInfo(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showPosturePrep]);

  // 筋トレ説明画面（5秒間表示）
  useEffect(() => {
    if (!showExerciseInfo) return;

    const timer = setTimeout(() => {
      setShowExerciseInfo(false);
      countdownStartTimeRef.current = performance.now();
    }, 5000);

    return () => clearTimeout(timer);
  }, [showExerciseInfo]);

  // ゲームカウントダウン処理（5秒）
  useEffect(() => {
    if (isLoading || !isModelReady || showReady || showPosturePrep || showExerciseInfo) return;

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
  }, [countdown, isLoading, isModelReady, showReady, showPosturePrep, showExerciseInfo]);

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

      // アニメーションを0.2秒早める（音楽との同期調整）
      const ANIMATION_OFFSET = 200; // ms
      const musicTime = audioRef.current ? (audioRef.current.currentTime * 1000) - musicStartOffsetRef.current + ANIMATION_OFFSET : 0;

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

      if (cycleTime < 100) {
        // 予備動作 (0-100ms): 縮む前に一瞬膨らむ（アンティシペーション）
        const progress = cycleTime / 100;
        const frame = 25;
        setCurrentFrame(frame);
        // 1.0 → 1.15 に膨らむ
        const scale = 1.0 + (0.15 * easeOutCubic(progress));
        setCircleScale(scale);
        setCircleRotation(0);
        setCircleOpacity(1.0);
        setCircleBlur(0);
        setCircleVisible(true);
        // 放射線: 非表示
        setBurstScale(0);
        setBurstOpacity(0);
        isGoingDownRef.current = true;
      } else if (cycleTime < 500) {
        // 1拍目 (100-500ms): 下降 - ググッと縮む + 回転 + ブラー
        const progress = (cycleTime - 100) / 400; // 0→1
        const frame = 25 + (25 * progress); // 25→50
        setCurrentFrame(Math.round(frame));
        // ease-in-cubic: ゆっくり始まり、最後に加速（ググッと感）
        const easedProgress = easeInCubic(progress);
        const scale = 1.15 - (0.75 * easedProgress); // 1.15→0.4
        setCircleScale(scale);
        // 回転: 0度 → -180度（半回転）
        setCircleRotation(-180 * easedProgress);
        // 不透明度: 通常
        setCircleOpacity(1.0);
        // ブラー: 縮む速度に応じてブラー（最大5px）
        const speed = easedProgress > 0.5 ? (easedProgress - 0.5) * 2 : 0;
        setCircleBlur(speed * 5);
        setCircleVisible(true);
        // 放射線: 非表示
        setBurstScale(0);
        setBurstOpacity(0);

        isGoingDownRef.current = true;
      } else if (cycleTime < 1000) {
        // 2拍目 (500-1000ms): 静止（最下点）- 跳ね返り + 光る + 放射線
        setCurrentFrame(50);
        // 最初の150msでオーバーシュート（0.35まで縮んで0.4に戻る）
        const bounceProgress = Math.min((cycleTime - 500) / 150, 1);
        const bounceScale = 0.35 + (0.05 * easeOutBounce(bounceProgress));
        setCircleScale(bounceScale);
        // 回転: -180度で維持
        setCircleRotation(-180);
        // 不透明度: 最小点で明るく光る（1.0 → 1.3 → 1.0）
        const glowProgress = Math.min((cycleTime - 500) / 200, 1);
        setCircleOpacity(1.0 + 0.3 * Math.sin(glowProgress * Math.PI));
        // ブラー解除
        setCircleBlur(0);
        setCircleVisible(true);

        // 放射線エフェクト: 500msで発動、500ms間で拡大しながらフェードアウト
        const burstProgress = Math.min((cycleTime - 500) / 500, 1);
        const burstEased = easeOutCubic(burstProgress);
        setBurstScale(0.5 + burstEased * 1.5); // 0.5 → 2.0（より大きく広がる）
        setBurstOpacity(1.0 * (1 - burstEased)); // 濃いめの透明度

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
        // 3拍目 (1000-1500ms): 上昇（0.5秒）- ポンッと膨らむ + 続けて回転
        const progress = (cycleTime - 1000) / 500; // 0→1
        const frame = 50 - (25 * progress); // 50→25
        setCurrentFrame(Math.round(frame));
        // ease-out-back: パッと広がり、少しオーバーシュート（1.15まで）
        const easedProgress = easeOutBack(progress);
        const scale = 0.4 + (0.75 * easedProgress); // 0.4→1.15
        setCircleScale(Math.min(scale, 1.15));
        // 回転: -180度 → -360度（続けて回転）
        setCircleRotation(-180 - (180 * easeOutCubic(progress)));
        // 不透明度: 通常
        setCircleOpacity(1.0);
        // ブラー: 膨らむ初期にブラー
        const blurAmount = progress < 0.3 ? (0.3 - progress) * 8 : 0;
        setCircleBlur(blurAmount);
        setCircleVisible(true);
        // 放射線: 非表示
        setBurstScale(0);
        setBurstOpacity(0);

        isGoingDownRef.current = false;
      } else {
        // 4拍目 (1500-2000ms): 静止（最上点）- ふわっと安定
        setCurrentFrame(25);
        // 最初の300msで1.15から1.0に落ち着く
        const settleProgress = Math.min((cycleTime - 1500) / 300, 1);
        const settleScale = 1.15 - (0.15 * easeOutCubic(settleProgress));
        setCircleScale(settleScale);
        // 回転: -360度（=0度）で維持、次のサイクルで0度にリセット
        setCircleRotation(-360);
        // 不透明度: 通常
        setCircleOpacity(1.0);
        // ブラー解除
        setCircleBlur(0);
        setCircleVisible(true);
        // 放射線: 非表示
        setBurstScale(0);
        setBurstOpacity(0);

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
      {/* 放射線エフェクト（circleの後ろ） */}
      <div
        className="async-burst-effect"
        style={{
          transform: `translate(-50%, -50%) scale(${burstScale})`,
          opacity: burstOpacity
        }}
      />
      <img
        src="/image/circle.png"
        alt="Circle"
        className="async-circle-center"
        style={{
          transform: `translate(-50%, -50%) scale(${circleScale}) rotate(${circleRotation}deg)`,
          opacity: circleVisible && isModelReady ? circleOpacity : 0,
          filter: circleBlur > 0 ? `blur(${circleBlur}px)` : 'none',
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
      {isModelReady && showPosturePrep && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">カメラを正面に、腕立ての姿勢になってください</h1>
        </div>
      )}
      {isModelReady && showExerciseInfo && (
        <div className="async-countdown-overlay async-exercise-info">
          <h1 className="async-countdown-title">今からリズムに合わせて</h1>
          <p className="async-exercise-reps">30回</p>
          <h1 className="async-countdown-title">腕立てをします</h1>
          <p className="async-exercise-tip">きつくなったら膝をついてもOK！</p>
        </div>
      )}
      {isModelReady && !showReady && !showPosturePrep && !showExerciseInfo && countdown > 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <div className="async-countdown-display">
            {countdown}
          </div>
        </div>
      )}
      {isModelReady && !showPosturePrep && !showExerciseInfo && countdown === 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">スタート！</h1>
        </div>
      )}
      {isGameStarted && !isGameCleared && (
        <>
          <button className="async-pause-button" onClick={handlePause}>
            ⏸
          </button>
          {!showWarmUpMessage && (
            <div className="async-rep-counter">
              <div className="async-rep-label">残り</div>
              {remainingReps}/30
            </div>
          )}
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
          <h1 className="async-countdown-title">エラー発生</h1>
          <p className="async-countdown-text" style={{ wordBreak: 'break-all' }}>
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
            className="async-btn-primary"
            style={{ marginTop: '2vmin' }}
          >
            タップして再試行
          </button>
          <button
            onClick={onBackToStart}
            className="async-btn-secondary"
            style={{ marginTop: '1vmin' }}
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
