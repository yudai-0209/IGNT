import { useState, useEffect, useRef } from 'react';
import './AsyncGameScreen.css';
import PushUpModel from './PushUpModel';

interface AsyncGameScreenProps {
  onBackToStart: () => void;
}

const AsyncGameScreen = ({ onBackToStart }: AsyncGameScreenProps) => {
  const [countdown, setCountdown] = useState<number>(15);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isGameCleared, setIsGameCleared] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(25);
  const [circleScale, setCircleScale] = useState<number>(1.0);
  const [circleVisible, setCircleVisible] = useState<boolean>(true);
  const [remainingReps, setRemainingReps] = useState<number>(30);
  const [demoFrame, setDemoFrame] = useState<number>(25);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);
  const pauseTimeRef = useRef<number>(0);
  const isGoingDownRef = useRef<boolean>(true);
  const repCountRef = useRef<number>(0);
  const countdownStartTimeRef = useRef<number | null>(null);
  const musicStartOffsetRef = useRef<number>(0);
  const demoStartTimeRef = useRef<number | null>(null);
  const demoAnimationFrameRef = useRef<number | null>(null);

  // 音楽を事前にプリロード（マウント時）
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/music/Metronome_120.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0;
      // プリロード
      audioRef.current.load();
    }

    // 3Dモデルも最初からロード開始（handleModelLoadで完了通知）
  }, []);

  // デモアニメーション（カウントダウン10秒→8秒の間に2回腕立て）
  useEffect(() => {
    if (countdown <= 10 && countdown > 0 && !isGameStarted) {
      if (!demoStartTimeRef.current) {
        demoStartTimeRef.current = performance.now();
      }

      const animateDemo = (timestamp: number) => {
        const elapsed = timestamp - demoStartTimeRef.current!;

        // 2秒後から4秒間で2回腕立て（1回2秒 × 2回 = 4秒）
        if (elapsed >= 2000 && elapsed < 6000) {
          const demoElapsed = elapsed - 2000; // 0~4000ms
          const cycleTime = demoElapsed % 2000; // 0~2000ms (1回の腕立てサイクル)
          const isDown = cycleTime < 1000;
          const progress = isDown ? cycleTime / 1000 : (cycleTime - 1000) / 1000;

          if (isDown) {
            // 25 → 50
            const frame = 25 + (25 * progress);
            setDemoFrame(Math.round(frame));
          } else {
            // 50 → 25
            const frame = 50 - (25 * progress);
            setDemoFrame(Math.round(frame));
          }
        } else if (elapsed >= 6000) {
          // デモ終了、フレームを初期位置に
          setDemoFrame(25);
        } else {
          // 2秒待機中
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

  // 一時停止処理
  useEffect(() => {
    if (isPaused) {
      // 一時停止時
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
        // 初回フレームで音楽を同時に開始
        if (audioRef.current) {
          // 音楽を0秒から確実に開始
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((error) => {
            console.error('メトロノーム音楽の再生に失敗しました:', error);
          });
          // 最初のフレームでの音楽時刻をオフセットとして記録
          musicStartOffsetRef.current = audioRef.current.currentTime * 1000;
        }
      }

      // 音楽の再生時刻を基準にする（ずれを防ぐ）
      const musicTime = audioRef.current ? (audioRef.current.currentTime * 1000) - musicStartOffsetRef.current : 0;

      // ゲーム開始からの経過時間をチェック
      if (musicTime >= GAME_DURATION) {
        // 1分経過、ゲームクリア
        setIsGameCleared(true);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        // 5秒後に最初の画面に戻る
        setTimeout(() => {
          onBackToStart();
        }, 5000);
        return; // アニメーション停止
      }

      // 音楽時刻から現在のサイクル位置を計算（2秒で1サイクル）
      const cycleTime = musicTime % 2000; // 0~2000ms
      const isDownPhase = cycleTime < 1000;
      const phaseProgress = isDownPhase ? cycleTime / 1000 : (cycleTime - 1000) / 1000;

      if (isDownPhase) {
        // 下降フェーズ: 25 → 50
        const frame = 25 + (25 * phaseProgress);
        setCurrentFrame(Math.round(frame));

        // circle画像: 最大(1.0)から最小(0.4)に縮小
        const scale = 1.0 - (0.6 * phaseProgress);
        setCircleScale(scale);
        setCircleVisible(true);

        // 方向フラグを更新
        if (!isGoingDownRef.current) {
          isGoingDownRef.current = true;
        }
      } else {
        // 上昇フェーズ: 50 → 25
        const frame = 50 - (25 * phaseProgress);
        setCurrentFrame(Math.round(frame));

        // circle画像: 0.7秒間小さいまま表示、その後非表示
        if (phaseProgress <= 0.7) {
          setCircleScale(0.4);
          setCircleVisible(true);
        } else {
          setCircleVisible(false);
        }

        // 方向フラグを更新 & カウント更新
        if (isGoingDownRef.current) {
          isGoingDownRef.current = false;
          repCountRef.current += 1;
          setRemainingReps(30 - repCountRef.current);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isGameStarted, isPaused]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleModelLoad = () => {
    setIsModelLoaded(true);
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

    // 音楽を再開
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
      {countdown > 5 && (
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">15秒後に開始！</h1>
          <p className="async-countdown-text">腕立て伏せの準備をしてください</p>
        </div>
      )}
      {countdown <= 5 && countdown > 0 && (
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
      {/* 最初からモデルをロード開始、残り10秒で表示 */}
      <div className="async-model-container" style={{ visibility: countdown > 10 ? 'hidden' : 'visible' }}>
        <PushUpModel
          modelPath="/models/pushUp.glb"
          currentFrame={isGameStarted ? currentFrame : demoFrame}
          onLoad={handleModelLoad}
        />
      </div>
    </div>
  );
};

export default AsyncGameScreen;
