import { useState, useEffect, useRef } from 'react';
import './AsyncGameScreen.css';
import PoseDetection from './PoseDetection';
import { useWakeLock } from '../hooks/useWakeLock';
import type { CalibrationData } from '../types';

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

// circleのスタイル型
export interface CircleStyle {
  scale: number;
  rotation: number;
  opacity: number;
  blur: number;
}

// burstのスタイル型
export interface BurstStyle {
  scale: number;
  opacity: number;
}

interface GameScreenProps {
  calibrationData: CalibrationData | null;
  onBackToStart: () => void;
  onFrameUpdate?: (frame: number) => void;
  onCircleStyleUpdate?: (style: CircleStyle) => void;
  onBurstStyleUpdate?: (style: BurstStyle) => void;
  modelReady?: boolean;
}

const GameScreen = ({
  calibrationData,
  onBackToStart,
  onFrameUpdate,
  onCircleStyleUpdate,
  onBurstStyleUpdate,
  modelReady = true
}: GameScreenProps) => {
  const [showExerciseInfo, setShowExerciseInfo] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(5);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isGameCleared, setIsGameCleared] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isBodyNotVisible, setIsBodyNotVisible] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [showWarmUpMessage, setShowWarmUpMessage] = useState<boolean>(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [combo, setCombo] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);
  const pauseTimeRef = useRef<number>(0);
  const isGoingDownRef = useRef<boolean>(true);
  const repCountRef = useRef<number>(0);
  const countdownStartTimeRef = useRef<number | null>(null);
  const musicStartOffsetRef = useRef<number>(0);
  const burstTriggeredRef = useRef<boolean>(false); // バーストが発動済みか
  const wasUpRef = useRef<boolean>(true); // 前回上にいたか（上に戻らないと再発動しない）
  const lastCycleRef = useRef<number>(-1); // 前回のサイクル番号（コンボ判定用）
  const cycleHadBurstRef = useRef<boolean>(false); // このサイクルでバーストがあったか

  useWakeLock(true);

  // 初期化時に事前ロードされた音声を取得
  useEffect(() => {
    const syncModeAudio = (window as any).__syncModeAudio;
    if (syncModeAudio) {
      audioRef.current = syncModeAudio;
    } else {
      audioRef.current = new Audio('/music/Metronome_120.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0;
    }
  }, []);

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
    if (!modelReady || showExerciseInfo) return;

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
  }, [countdown, modelReady, showExerciseInfo]);

  // フレーム更新を直接App.tsxへ通知（差分が小さい時はスキップしてガタつき防止）
  const lastFrameRef = useRef<number>(25);
  const FRAME_THRESHOLD = 3; // この差分以上の時だけ更新

  const handleFrameUpdate = (frame: number) => {
    const diff = Math.abs(frame - lastFrameRef.current);
    if (diff >= FRAME_THRESHOLD) {
      lastFrameRef.current = frame;
      setCurrentFrame(frame);
      if (onFrameUpdate) {
        onFrameUpdate(frame);
      }
    }
  };

  // 一時停止処理（手動一時停止または体が見えない場合）
  useEffect(() => {
    if (isPaused || isBodyNotVisible) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isPaused, isBodyNotVisible]);

  // Circleアニメーション処理 → App.tsxに通知
  useEffect(() => {
    if (!isGameStarted) return;

    const GAME_DURATION = 64000;

    const animate = (timestamp: number) => {
      if (isPaused || isBodyNotVisible) {
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
            setAudioError(`音楽再生エラー: ${error.name} - ${error.message}`);
          });
          musicStartOffsetRef.current = audioRef.current.currentTime * 1000;
        }
      }

      // アニメーションを0.2秒早める（音楽との同期調整）
      const ANIMATION_OFFSET = 200; // ms
      const musicTime = audioRef.current ? (audioRef.current.currentTime * 1000) - musicStartOffsetRef.current + ANIMATION_OFFSET : 0;

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
      const currentCycle = Math.floor(musicTime / 2000);
      let circleStyle: CircleStyle = { scale: 1.0, rotation: 0, opacity: 1.0, blur: 0 };
      let burstStyle: BurstStyle = { scale: 0, opacity: 0 };

      // 新しいサイクルに入った時のコンボリセット判定（最初の2サイクルはスキップ）
      if (currentCycle !== lastCycleRef.current && currentCycle >= 2) {
        if (lastCycleRef.current >= 2) {
          // 前のサイクルでバーストがなかったらコンボリセット
          if (!cycleHadBurstRef.current) {
            setCombo(0);
          }
        }
        lastCycleRef.current = currentCycle;
        cycleHadBurstRef.current = false;
      }

      // ユーザーが「下」の位置にいるか判定（フレーム42以上 = 下の姿勢）
      const isUserDown = currentFrame >= 42;
      // circleが最小のタイミング（500ms）前0.25秒〜後0.5秒
      const isCircleSmallestTiming = cycleTime >= 250 && cycleTime <= 1000;

      // ユーザーが上に戻ったらバースト発動フラグをリセット
      if (!isUserDown && wasUpRef.current === false) {
        wasUpRef.current = true;
        burstTriggeredRef.current = false;
      }
      if (isUserDown) {
        wasUpRef.current = false;
      }

      if (cycleTime < 100) {
        const progress = cycleTime / 100;
        circleStyle = {
          scale: 1.0 + (0.15 * easeOutCubic(progress)),
          rotation: 0,
          opacity: 1.0,
          blur: 0
        };
        isGoingDownRef.current = true;
      } else if (cycleTime < 500) {
        const progress = (cycleTime - 100) / 400;
        const easedProgress = easeInCubic(progress);
        const speed = easedProgress > 0.5 ? (easedProgress - 0.5) * 2 : 0;
        circleStyle = {
          scale: 1.15 - (0.75 * easedProgress),
          rotation: -180 * easedProgress,
          opacity: 1.0,
          blur: speed * 5
        };

        // バーストエフェクト：250ms以降でユーザーが下の位置なら発動（1サイクル1回のみ）
        if (isUserDown && isCircleSmallestTiming && !cycleHadBurstRef.current) {
          burstTriggeredRef.current = true;
          cycleHadBurstRef.current = true; // このサイクルでバーストあり
          setCombo(prev => prev + 1); // コンボ加算
        }

        isGoingDownRef.current = true;
      } else if (cycleTime < 1000) {
        const bounceProgress = Math.min((cycleTime - 500) / 150, 1);
        const glowProgress = Math.min((cycleTime - 500) / 200, 1);

        circleStyle = {
          scale: 0.35 + (0.05 * easeOutBounce(bounceProgress)),
          rotation: -180,
          opacity: 1.0 + 0.3 * Math.sin(glowProgress * Math.PI),
          blur: 0
        };

        // バーストエフェクト：ユーザーが下の位置 かつ circleが最小のタイミング の時のみ発動（1サイクル1回のみ）
        if (isUserDown && isCircleSmallestTiming && !cycleHadBurstRef.current) {
          burstTriggeredRef.current = true;
          cycleHadBurstRef.current = true; // このサイクルでバーストあり
          setCombo(prev => prev + 1); // コンボ加算
        }

        // バーストが発動済みならアニメーション表示
        if (burstTriggeredRef.current) {
          const burstProgress = Math.min((cycleTime - 500) / 500, 1);
          const burstEased = easeOutCubic(burstProgress);
          burstStyle = {
            scale: 0.5 + burstEased * 1.5,
            opacity: 1.0 * (1 - burstEased)
          };
        }

        if (isGoingDownRef.current) {
          isGoingDownRef.current = false;
        }
      } else if (cycleTime < 1500) {
        const progress = (cycleTime - 1000) / 500;
        const easedProgress = easeOutBack(progress);
        const blurAmount = progress < 0.3 ? (0.3 - progress) * 8 : 0;
        circleStyle = {
          scale: Math.min(0.4 + (0.75 * easedProgress), 1.15),
          rotation: -180 - (180 * easeOutCubic(progress)),
          opacity: 1.0,
          blur: blurAmount
        };
        isGoingDownRef.current = false;
      } else {
        const settleProgress = Math.min((cycleTime - 1500) / 300, 1);
        circleStyle = {
          scale: 1.15 - (0.15 * easeOutCubic(settleProgress)),
          rotation: -360,
          opacity: 1.0,
          blur: 0
        };
        isGoingDownRef.current = false;
      }

      // App.tsxに通知
      if (onCircleStyleUpdate) {
        onCircleStyleUpdate(circleStyle);
      }
      if (onBurstStyleUpdate) {
        onBurstStyleUpdate(burstStyle);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isGameStarted, isPaused, isBodyNotVisible, onBackToStart, showWarmUpMessage, onCircleStyleUpdate, onBurstStyleUpdate]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePushUpCount = (count: number) => {
    repCountRef.current = count;
  };

  // 体の可視性変化ハンドラ
  const handleBodyVisibilityChange = (isVisible: boolean) => {
    if (!isGameStarted || isGameCleared || isPaused) return;

    if (!isVisible) {
      // 体が見えなくなった → 自動一時停止
      setIsBodyNotVisible(true);
      if (startTimeRef.current && gameStartTimeRef.current) {
        pauseTimeRef.current = performance.now() - startTimeRef.current;
      }
    } else {
      // 体が見えるようになった → 自動再開
      const now = performance.now();
      if (startTimeRef.current && pauseTimeRef.current > 0) {
        const pauseDuration = now - (startTimeRef.current + pauseTimeRef.current);
        startTimeRef.current = startTimeRef.current + pauseDuration;
        gameStartTimeRef.current = gameStartTimeRef.current! + pauseDuration;
      }
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      setIsBodyNotVisible(false);
    }
  };

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
      audioRef.current.play().catch(() => {});
    }

    setIsPaused(false);
  };

  const handleRestart = () => {
    window.location.reload();
  };

  // 未使用変数警告を回避
  void currentFrame;

  return (
    <div className="async-game-screen" style={{ background: 'transparent' }}>
      {/* 背景、circle、3DモデルはApp.tsxで表示 */}

      {/* 筋トレ説明画面 */}
      {showExerciseInfo && (
        <div className="async-countdown-overlay async-exercise-info">
          <h1 className="async-countdown-title">今からリズムに合わせて</h1>
          <h1 className="async-countdown-title">腕立てをします</h1>
          <p className="async-exercise-tip">きつくなったら膝をついてもOK！</p>
        </div>
      )}

      {/* カウントダウン */}
      {modelReady && !showExerciseInfo && countdown > 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <div className="async-countdown-display">{countdown}</div>
        </div>
      )}
      {modelReady && !showExerciseInfo && countdown === 0 && !isGameStarted && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">スタート！</h1>
        </div>
      )}

      {/* ゲーム中のUI */}
      {isGameStarted && !isGameCleared && (
        <>
          <button className="async-pause-button" onClick={handlePause}>⏸</button>
          {combo > 0 && !showWarmUpMessage && (
            <div className="combo-counter">
              COMBO: {combo}x
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
            <button onClick={handleResume} className="async-btn-primary">再開</button>
            <button onClick={handleRestart} className="async-btn-secondary">最初に戻る</button>
          </div>
        </div>
      )}

      {/* 体が見えない時の自動一時停止 */}
      {isBodyNotVisible && !isPaused && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">カメラの中に</h1>
          <h1 className="async-countdown-title">全身を入れてください</h1>
          <p className="async-countdown-text">
            体が検出されると自動的に再開します
          </p>
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

      {/* PoseDetection */}
      {isGameStarted && (
        <PoseDetection
          calibrationData={calibrationData}
          onFrameUpdate={handleFrameUpdate}
          onPushUpCount={handlePushUpCount}
          onBodyVisibilityChange={handleBodyVisibilityChange}
        />
      )}
    </div>
  );
};

export default GameScreen;
