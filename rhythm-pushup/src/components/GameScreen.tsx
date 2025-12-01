import { useState, useEffect, useRef, useCallback } from 'react';
import './AsyncGameScreen.css';
import './CalibrationScreen.css';
import PoseDetection from './PoseDetection';
import type { PostureStatus } from './PoseDetection';
import { useWakeLock } from '../hooks/useWakeLock';
import type { CalibrationData } from '../types';

// 中断時の音声ファイルのパス（キャリブレーションと共通）
const INTERRUPTION_AUDIO_FILES = {
  showWholeBody: '/sounds/show_whole_body.mp3',
  wristBelowShoulder: '/sounds/wrist_below_shoulder.mp3',
};

// ゲーム開始時の音声ファイル
const GAME_AUDIO_FILES = {
  exerciseInfo: '/sounds/game_exercise_info.mp3',
  countdown5: '/sounds/game_countdown_5.mp3',
  countdown4: '/sounds/game_countdown_4.mp3',
  countdown3: '/sounds/game_countdown_3.mp3',
  countdown2: '/sounds/game_countdown_2.mp3',
  countdown1: '/sounds/game_countdown_1.mp3',
  start: '/sounds/game_start.mp3',
};

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
  const [postureStatus, setPostureStatus] = useState<PostureStatus>({
    allLandmarksVisible: true,
    wristBelowShoulder: true
  });
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [showWarmUpMessage, setShowWarmUpMessage] = useState<boolean>(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentRep, setCurrentRep] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(100); // 残り時間（%）

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 中断時音声関連
  const interruptionAudioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const currentInterruptionAudioRef = useRef<string | null>(null);
  const lastPlayedInterruptionAudioRef = useRef<string | null>(null);

  // ゲーム開始時音声関連
  const gameAudioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const currentGameAudioRef = useRef<HTMLAudioElement | null>(null);
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

  // 中断時音声ファイルのプリロード
  useEffect(() => {
    Object.entries(INTERRUPTION_AUDIO_FILES).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      interruptionAudioRefs.current[key] = audio;
    });

    return () => {
      Object.values(interruptionAudioRefs.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  // ゲーム開始時音声をプリロード済みから取得
  useEffect(() => {
    const preloaded = (window as any).__preloadedGameAudios;
    if (preloaded) {
      // プリロード済みの音声を使用
      gameAudioRefs.current = {
        exerciseInfo: preloaded['game_exercise_info'],
        countdown5: preloaded['game_countdown_5'],
        countdown4: preloaded['game_countdown_4'],
        countdown3: preloaded['game_countdown_3'],
        countdown2: preloaded['game_countdown_2'],
        countdown1: preloaded['game_countdown_1'],
        start: preloaded['game_start'],
      };
    } else {
      // フォールバック：プリロードがない場合は新規作成
      Object.entries(GAME_AUDIO_FILES).forEach(([key, path]) => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        gameAudioRefs.current[key] = audio;
      });
    }
  }, []);

  // ゲーム音声再生関数（Promiseを返す）
  const playGameAudio = useCallback((audioKey: string): Promise<void> => {
    return new Promise((resolve) => {
      // 現在再生中の音声を停止
      if (currentGameAudioRef.current) {
        currentGameAudioRef.current.pause();
        currentGameAudioRef.current.currentTime = 0;
      }

      const audio = gameAudioRefs.current[audioKey];
      if (audio) {
        currentGameAudioRef.current = audio;
        audio.currentTime = 0;

        audio.onended = () => {
          currentGameAudioRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          currentGameAudioRef.current = null;
          resolve();
        };

        audio.play().catch(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }, []);

  // 中断時音声再生関数
  const playInterruptionAudio = useCallback((audioKey: string) => {
    // 同じ音声が既に再生中の場合はスキップ
    if (currentInterruptionAudioRef.current === audioKey) {
      return;
    }

    // 前回と同じ音声の場合もスキップ（連続再生防止）
    if (lastPlayedInterruptionAudioRef.current === audioKey) {
      return;
    }

    // 現在再生中の音声を停止
    if (currentInterruptionAudioRef.current && interruptionAudioRefs.current[currentInterruptionAudioRef.current]) {
      interruptionAudioRefs.current[currentInterruptionAudioRef.current].pause();
      interruptionAudioRefs.current[currentInterruptionAudioRef.current].currentTime = 0;
    }

    // 新しい音声を再生
    const audio = interruptionAudioRefs.current[audioKey];
    if (audio) {
      currentInterruptionAudioRef.current = audioKey;
      lastPlayedInterruptionAudioRef.current = audioKey;
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Interruption audio playback failed:', err);
      });

      audio.onended = () => {
        currentInterruptionAudioRef.current = null;
      };
    }
  }, []);

  // 中断時音声を全て停止
  const stopInterruptionAudio = useCallback(() => {
    Object.values(interruptionAudioRefs.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    currentInterruptionAudioRef.current = null;
  }, []);

  // 中断状態に応じた音声再生
  useEffect(() => {
    if (isBodyNotVisible && !isPaused) {
      // 条件に応じて音声を再生
      if (!postureStatus.allLandmarksVisible) {
        playInterruptionAudio('showWholeBody');
      } else if (!postureStatus.wristBelowShoulder) {
        playInterruptionAudio('wristBelowShoulder');
      }
    } else {
      // 中断解除時はリセット
      stopInterruptionAudio();
      lastPlayedInterruptionAudioRef.current = null;
    }
  }, [isBodyNotVisible, isPaused, postureStatus, playInterruptionAudio, stopInterruptionAudio]);

  // カウント音声を再生する関数（プリロード済み音声を使用）
  const playCountAudio = (count: number) => {
    if (count < 1 || count > 30) return;

    // プリロード済み音声を取得
    const preloadedAudios = (window as any).__preloadedCountAudios;
    if (!preloadedAudios || !preloadedAudios[count]) {
      console.warn(`カウント音声 ${count} がプリロードされていません`);
      return;
    }

    // 前の音声が再生中なら停止
    if (countAudioRef.current) {
      countAudioRef.current.pause();
      countAudioRef.current.currentTime = 0;
    }

    // プリロード済み音声を使用
    const audio = preloadedAudios[count];
    audio.currentTime = 0;
    audio.volume = 0.8;
    countAudioRef.current = audio;

    audio.play().catch((error: Error) => {
      console.error(`カウント音声(${count})の再生に失敗:`, error);
    });
  };

  // 初期化時に事前ロードされた音声を取得
  useEffect(() => {
    const syncModeAudio = (window as any).__syncModeAudio;
    if (syncModeAudio) {
      // 確実に停止・無音状態にする
      syncModeAudio.pause();
      syncModeAudio.currentTime = 0;
      syncModeAudio.muted = true; // ミュート維持
      syncModeAudio.volume = 0;
      audioRef.current = syncModeAudio;
    } else {
      audioRef.current = new Audio('/music/Metronome_120.mp3');
      audioRef.current.loop = true;
      audioRef.current.muted = true; // ミュート維持
      audioRef.current.volume = 0;
    }
  }, []);

  // 筋トレ説明画面（音声再生後に次へ）
  useEffect(() => {
    if (!showExerciseInfo) return;

    let isCancelled = false;

    const playAndAdvance = async () => {
      await playGameAudio('exerciseInfo');
      // 音声終了後に少し待ってから次へ
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isCancelled) {
        setShowExerciseInfo(false);
        countdownStartTimeRef.current = performance.now();
      }
    };

    playAndAdvance();

    return () => {
      isCancelled = true;
    };
  }, [showExerciseInfo, playGameAudio]);

  // カウントダウン音声再生用のref
  const lastPlayedCountdownRef = useRef<number>(-1);

  // ゲームカウントダウン処理（音声付き）
  useEffect(() => {
    if (!modelReady || showExerciseInfo) return;

    let frameId: number;
    let isCancelled = false;

    const checkCountdown = async () => {
      if (!countdownStartTimeRef.current || isCancelled) return;

      const elapsed = performance.now() - countdownStartTimeRef.current;
      const newCountdown = Math.max(0, 5 - Math.floor(elapsed / 1000));

      // カウントダウン音声を再生（同じ数字は1回だけ）
      if (newCountdown !== lastPlayedCountdownRef.current && newCountdown > 0) {
        lastPlayedCountdownRef.current = newCountdown;
        setCountdown(newCountdown);
        const audioKey = `countdown${newCountdown}` as keyof typeof GAME_AUDIO_FILES;
        playGameAudio(audioKey);
      }

      if (newCountdown > 0) {
        frameId = requestAnimationFrame(checkCountdown);
      } else if (newCountdown === 0 && lastPlayedCountdownRef.current !== 0) {
        // 「スタート！」音声を再生してからゲーム開始
        lastPlayedCountdownRef.current = 0;
        setCountdown(0);
        await playGameAudio('start');
        if (!isCancelled) {
          setIsGameStarted(true);
        }
      }
    };

    frameId = requestAnimationFrame(checkCountdown);

    return () => {
      isCancelled = true;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [modelReady, showExerciseInfo, playGameAudio]);

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
          // ゲーム開始時にミュート解除・音量設定し、最初から再生
          audioRef.current.currentTime = 0;
          audioRef.current.muted = false; // ここでミュート解除
          audioRef.current.volume = 1.0;
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

      // 残り時間ゲージの計算（最初の4秒は100%のまま、その後60秒で0%に）
      const WARMUP_TIME = 4000; // 最初の4秒
      const ACTIVE_DURATION = 60000; // 実際のゲーム時間60秒
      if (musicTime <= WARMUP_TIME) {
        setTimeRemaining(100);
      } else {
        const activeTime = musicTime - WARMUP_TIME;
        const remaining = Math.max(0, 100 - (activeTime / ACTIVE_DURATION) * 100);
        setTimeRemaining(remaining);
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

      // 新しいサイクルに入った時のコンボリセット判定
      if (currentCycle !== lastCycleRef.current) {
        // 前のサイクルでバーストがなかったらコンボリセット
        if (lastCycleRef.current >= 0 && !cycleHadBurstRef.current) {
          setCombo(0);
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

        // バーストエフェクト：250ms以降でユーザーが下の位置なら発動（1サイクル1回、かつ上に戻ってから）
        if (isUserDown && isCircleSmallestTiming && !cycleHadBurstRef.current && !burstTriggeredRef.current) {
          burstTriggeredRef.current = true;
          cycleHadBurstRef.current = true; // このサイクルでバーストあり
          setCombo(prev => prev + 1); // コンボ加算
          setCurrentRep(prev => {
            const newCount = prev + 1;
            playCountAudio(newCount); // カウント音声を再生
            return newCount;
          });
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

        // バーストエフェクト：ユーザーが下の位置 かつ circleが最小のタイミング の時のみ発動（1サイクル1回、かつ上に戻ってから）
        if (isUserDown && isCircleSmallestTiming && !cycleHadBurstRef.current && !burstTriggeredRef.current) {
          burstTriggeredRef.current = true;
          cycleHadBurstRef.current = true; // このサイクルでバーストあり
          setCombo(prev => prev + 1); // コンボ加算
          setCurrentRep(prev => {
            const newCount = prev + 1;
            playCountAudio(newCount); // カウント音声を再生
            return newCount;
          });
        }

        // このサイクルでバーストが発動したならアニメーション表示
        if (cycleHadBurstRef.current) {
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

  // 姿勢ステータス変化ハンドラ
  const handlePostureStatusChange = (status: PostureStatus) => {
    setPostureStatus(status);
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
          <h1 className="async-countdown-title">１分間腕立てをします</h1>
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
          {/* 残り時間ゲージ */}
          <div className="time-gauge-container">
            <div
              className="time-gauge-bar"
              style={{ width: `${timeRemaining}%` }}
            />
          </div>
          {!showWarmUpMessage && (
            <>
              <div className="async-rep-counter">
                {currentRep}/30
              </div>
              {combo > 0 && (
                <div className="combo-counter">
                  COMBO: {combo}x
                </div>
              )}
            </>
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

      {isGameCleared && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">終了～！</h1>
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
          onPostureStatusChange={handlePostureStatusChange}
          showCamera={isBodyNotVisible}
          fullscreen={isBodyNotVisible}
          overlayContent={isBodyNotVisible && !isPaused ? (
            <div className="calibration-overlay calibration-overlay-centered">
              <div className="calibration-step-label">ゲーム一時停止中</div>
              <div className="calibration-completed-conditions">
                {postureStatus.allLandmarksVisible && <span className="completed-badge">✓ 全身</span>}
                {postureStatus.wristBelowShoulder && <span className="completed-badge">✓ 手首</span>}
              </div>
              <div className="calibration-pending-conditions">
                {!postureStatus.allLandmarksVisible && (
                  <div className="pending-condition">
                    <div className="pending-icon">👤</div>
                    <div className="pending-text">全身をカメラに映してください</div>
                  </div>
                )}
                {!postureStatus.wristBelowShoulder && postureStatus.allLandmarksVisible && (
                  <div className="pending-condition">
                    <div className="pending-icon">✋</div>
                    <div className="pending-text">手首を肩より下に</div>
                  </div>
                )}
              </div>
              <div className="game-resume-message">条件を満たすと自動的に再開します</div>
            </div>
          ) : undefined}
        />
      )}
    </div>
  );
};

export default GameScreen;
