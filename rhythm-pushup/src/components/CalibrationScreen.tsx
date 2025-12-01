import { useState, useRef, useEffect, useCallback } from 'react';
import type { Results } from '@mediapipe/pose';
import PoseDetection from './PoseDetection';
import type { CalibrationData } from '../types';
import './CalibrationScreen.css';
import './AsyncGameScreen.css';

// 音声ファイルのパス
const AUDIO_FILES = {
  calibrationIntro: '/sounds/calibration_intro.mp3',
  showWholeBody: '/sounds/show_whole_body.mp3',
  wristBelowShoulder: '/sounds/wrist_below_shoulder.mp3',
  extendArms: '/sounds/extend_arms.mp3',
  bendArms: '/sounds/bend_arms.mp3',
  holdPosition: '/sounds/hold_position.mp3',
  calibrationComplete: '/sounds/calibration_complete.mp3',
};

interface CalibrationScreenProps {
  onComplete: (data: CalibrationData) => void;
  assetsLoaded?: boolean;
  modelReady?: boolean;
}

type CalibrationStep = 'intro' | 'upper' | 'lower' | 'complete';

// 姿勢検証の状態
interface PostureStatus {
  allLandmarksVisible: boolean;  // 全ランドマーク検出
  wristBelowShoulder: boolean;   // 手首が肩より下
}

const CalibrationScreen = ({ onComplete, assetsLoaded = false, modelReady = false }: CalibrationScreenProps) => {
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [currentAngle, setCurrentAngle] = useState<number>(0);
  const [upperAngle, setUpperAngle] = useState<number>(0);
  const [lowerAngle, setLowerAngle] = useState<number>(0);
  const [postureStatus, setPostureStatus] = useState<PostureStatus>({
    allLandmarksVisible: false,
    wristBelowShoulder: false,
  });
  const [upperPostureStableTime, setUpperPostureStableTime] = useState<number>(0);
  const [lowerPostureStableTime, setLowerPostureStableTime] = useState<number>(0);

  // 音声関連
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const currentAudioRef = useRef<string | null>(null);
  const lastPlayedAudioRef = useRef<string | null>(null);

  // 未使用の警告を防ぐ
  void assetsLoaded;

  // 音声をプリロード済みから取得
  useEffect(() => {
    const preloaded = (window as any).__preloadedGameAudios;
    if (preloaded) {
      // プリロード済みの音声を使用
      audioRefs.current = {
        calibrationIntro: preloaded['calibration_intro'],
        showWholeBody: preloaded['show_whole_body'],
        wristBelowShoulder: preloaded['wrist_below_shoulder'],
        extendArms: preloaded['extend_arms'],
        bendArms: preloaded['bend_arms'],
        holdPosition: preloaded['hold_position'],
        calibrationComplete: preloaded['calibration_complete'],
      };
    } else {
      // フォールバック：プリロードがない場合は新規作成
      Object.entries(AUDIO_FILES).forEach(([key, path]) => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audioRefs.current[key] = audio;
      });
    }
  }, []);

  // 音声再生関数
  const playAudio = useCallback((audioKey: string) => {
    // 同じ音声が既に再生中の場合はスキップ
    if (currentAudioRef.current === audioKey) {
      return;
    }

    // 前回と同じ音声の場合もスキップ（連続再生防止）
    if (lastPlayedAudioRef.current === audioKey) {
      return;
    }

    // 現在再生中の音声を停止
    if (currentAudioRef.current && audioRefs.current[currentAudioRef.current]) {
      audioRefs.current[currentAudioRef.current].pause();
      audioRefs.current[currentAudioRef.current].currentTime = 0;
    }

    // 新しい音声を再生
    const audio = audioRefs.current[audioKey];
    if (audio) {
      currentAudioRef.current = audioKey;
      lastPlayedAudioRef.current = audioKey;
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Audio playback failed:', err);
      });

      // 再生終了時にクリア
      audio.onended = () => {
        currentAudioRef.current = null;
      };
    }
  }, []);

  // 全ての音声を停止
  const stopAllAudio = useCallback(() => {
    Object.values(audioRefs.current).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    currentAudioRef.current = null;
  }, []);

  const UPPER_ANGLE_MIN = 170; // 上の姿勢の最低角度
  const LOWER_ANGLE_MAX = 120; // 下の姿勢の最大角度

  // 状態に応じた音声再生
  useEffect(() => {
    if (step === 'intro') {
      playAudio('calibrationIntro');
    } else if (step === 'complete') {
      playAudio('calibrationComplete');
    }
  }, [step, playAudio]);

  // upper/lowerステップ時の条件に応じた音声再生
  useEffect(() => {
    if (step === 'upper') {
      const isUpperAngleValid = currentAngle >= UPPER_ANGLE_MIN;
      const isUpperPostureReady = postureStatus.allLandmarksVisible &&
                                   postureStatus.wristBelowShoulder &&
                                   isUpperAngleValid;

      if (isUpperPostureReady) {
        // 全条件達成：キープ音声
        playAudio('holdPosition');
      } else if (!postureStatus.allLandmarksVisible) {
        // 全身が見えない
        playAudio('showWholeBody');
      } else if (!postureStatus.wristBelowShoulder) {
        // 手首が肩より上
        playAudio('wristBelowShoulder');
      } else if (!isUpperAngleValid) {
        // 腕を伸ばしていない
        playAudio('extendArms');
      }
    } else if (step === 'lower') {
      const isLowerAngleValid = currentAngle > 0 && currentAngle <= LOWER_ANGLE_MAX;
      const isLowerPostureReady = postureStatus.allLandmarksVisible &&
                                   postureStatus.wristBelowShoulder &&
                                   isLowerAngleValid;

      if (isLowerPostureReady) {
        // 全条件達成：キープ音声
        playAudio('holdPosition');
      } else if (!postureStatus.allLandmarksVisible) {
        // 全身が見えない
        playAudio('showWholeBody');
      } else if (!postureStatus.wristBelowShoulder) {
        // 手首が肩より上
        playAudio('wristBelowShoulder');
      } else if (!isLowerAngleValid) {
        // 腕を曲げていない
        playAudio('bendArms');
      }
    }
  }, [step, currentAngle, postureStatus, playAudio]);

  // ステップ変更時にlastPlayedをリセット（新しいステップで同じ音声を再生可能に）
  useEffect(() => {
    lastPlayedAudioRef.current = null;
    stopAllAudio();
  }, [step, stopAllAudio]);

  const REQUIRED_STABLE_TIME = 3000; // 3秒 = 3000ms

  const upperPostureStableStartRef = useRef<number | null>(null);
  const lowerPostureStableStartRef = useRef<number | null>(null);

  const handlePoseDetected = (results: Results) => {
    const now = performance.now();

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;

      // 必要なランドマークを取得
      const nose = landmarks[0];           // 鼻（顔）
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];

      // 1. 全ランドマークの可視性チェック
      // visibility > 0.5 かつ 座標が画面内（0〜1の範囲）にあること
      const requiredLandmarks = [
        nose, leftShoulder, rightShoulder,
        leftElbow, rightElbow, leftWrist, rightWrist
      ];
      const isInFrame = (lm: { x: number; y: number; visibility?: number }) => {
        return lm.x >= 0 && lm.x <= 1 && lm.y >= 0 && lm.y <= 1;
      };
      const allLandmarksVisible = requiredLandmarks.every(
        lm => lm.visibility && lm.visibility > 0.5 && isInFrame(lm)
      );

      // ランドマークが見えていない場合はリセット
      if (!allLandmarksVisible) {
        setPostureStatus({
          allLandmarksVisible: false,
          wristBelowShoulder: false,
        });
        upperPostureStableStartRef.current = null;
        lowerPostureStableStartRef.current = null;
        setUpperPostureStableTime(0);
        setLowerPostureStableTime(0);
        setCurrentAngle(0);
        return;
      }

      // 2. 手首が肩より下かチェック（Y座標が大きい方が下）
      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const wristBelowShoulder = avgWristY > avgShoulderY;

      setPostureStatus({
        allLandmarksVisible: true,
        wristBelowShoulder,
      });

      // 角度計算（ランドマークが見えている場合のみ）
      const radians =
        Math.atan2(rightWrist.y - rightElbow.y, rightWrist.x - rightElbow.x) -
        Math.atan2(rightShoulder.y - rightElbow.y, rightShoulder.x - rightElbow.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);

      if (angle > 180.0) {
        angle = 360 - angle;
      }

      const roundedAngle = Math.round(angle);
      setCurrentAngle(roundedAngle);

      // 上の姿勢の安定時間の計算（全条件：全身見える＋手首が肩より下＋角度170度以上）
      const isUpperPostureValid = allLandmarksVisible && wristBelowShoulder &&
                                   roundedAngle >= UPPER_ANGLE_MIN;

      if (isUpperPostureValid) {
        if (upperPostureStableStartRef.current === null) {
          upperPostureStableStartRef.current = now;
        }
        const elapsed = now - upperPostureStableStartRef.current;
        setUpperPostureStableTime(elapsed);
      } else {
        upperPostureStableStartRef.current = null;
        setUpperPostureStableTime(0);
      }

      // 下の姿勢の安定時間の計算（全条件：全身見える＋手首が肩より下＋角度120度以下）
      const isLowerPostureValid = allLandmarksVisible && wristBelowShoulder &&
                                   roundedAngle > 0 && roundedAngle <= LOWER_ANGLE_MAX;

      if (isLowerPostureValid) {
        if (lowerPostureStableStartRef.current === null) {
          lowerPostureStableStartRef.current = now;
        }
        const elapsed = now - lowerPostureStableStartRef.current;
        setLowerPostureStableTime(elapsed);
      } else {
        lowerPostureStableStartRef.current = null;
        setLowerPostureStableTime(0);
      }

      // 記録処理（上の姿勢）- 3秒経過したら即完了
      if (step === 'upper') {
        const upperStable = upperPostureStableStartRef.current !== null &&
                            (now - upperPostureStableStartRef.current) >= REQUIRED_STABLE_TIME;

        if (upperStable) {
          // 3秒経過したらその時点の角度で完了
          setUpperAngle(roundedAngle);
          setStep('lower');
        }
      } else if (step === 'lower') {
        const lowerStable = lowerPostureStableStartRef.current !== null &&
                            (now - lowerPostureStableStartRef.current) >= REQUIRED_STABLE_TIME;

        if (lowerStable) {
          // 3秒経過したらその時点の角度で完了
          setLowerAngle(roundedAngle);
          setStep('complete');
        }
      }
    } else {
      // ランドマークが検出されない場合はリセット
      setPostureStatus({
        allLandmarksVisible: false,
        wristBelowShoulder: false,
      });
      upperPostureStableStartRef.current = null;
      lowerPostureStableStartRef.current = null;
      setUpperPostureStableTime(0);
      setLowerPostureStableTime(0);
    }
  };

  const handleComplete = () => {
    const calibrationData: CalibrationData = {
      upperAngle,
      lowerAngle,
      upperThreshold: upperAngle - 10,
      lowerThreshold: lowerAngle + 10,
    };
    onComplete(calibrationData);
  };

  const handleSkip = () => {
    // スキップ時はデフォルト値でキャリブレーション完了
    const calibrationData: CalibrationData = {
      upperAngle: 180,
      lowerAngle: 90,
      upperThreshold: 170,
      lowerThreshold: 100,
    };
    onComplete(calibrationData);
  };

  const renderStepContent = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="calibration-content">
            <h1>キャリブレーション</h1>
            <p>カメラを正面に、</p>
            <p>腕立ての姿勢をしてください</p>
            <div className="calibration-buttons">
              <button onClick={() => setStep('upper')} className="btn-primary">
                開始
              </button>
              <button onClick={handleSkip} className="btn-secondary">
                スキップ
              </button>
            </div>
          </div>
        );

      case 'upper':
        const isUpperAngleValid = currentAngle >= UPPER_ANGLE_MIN;
        const isUpperPostureReady = postureStatus.allLandmarksVisible &&
                                     postureStatus.wristBelowShoulder &&
                                     isUpperAngleValid;
        const upperWaitingForStable = isUpperPostureReady && upperPostureStableTime < REQUIRED_STABLE_TIME;

        return (
          <div className="calibration-content">
            <h2>ステップ 1/2</h2>
            <h3>腕立て伏せの「上」の姿勢</h3>
            <p>腕を伸ばした状態になってください</p>

            {/* 姿勢チェックリスト */}
            <div className="posture-checklist">
              <div className={`check-item ${postureStatus.allLandmarksVisible ? 'valid' : 'invalid'}`}>
                {postureStatus.allLandmarksVisible ? '✓' : '✗'} 全身が見えている
              </div>
              <div className={`check-item ${postureStatus.wristBelowShoulder ? 'valid' : 'invalid'}`}>
                {postureStatus.wristBelowShoulder ? '✓' : '✗'} 手首が肩より下
              </div>
              <div className={`check-item ${isUpperAngleValid ? 'valid' : 'invalid'}`}>
                {isUpperAngleValid ? '✓' : '✗'} 腕の角度 {currentAngle}° （{UPPER_ANGLE_MIN}°以上）
              </div>
            </div>

            {/* 安定時間の表示 */}
            {upperWaitingForStable && (
              <div className="stable-timer">
                姿勢を維持: {(upperPostureStableTime / 1000).toFixed(1)}秒 / 3秒
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(upperPostureStableTime / REQUIRED_STABLE_TIME) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {!isUpperPostureReady && (
              <div className="angle-warning">
                上記の条件を全て満たしてください
              </div>
            )}
          </div>
        );

      case 'lower':
        const isLowerAngleValid = currentAngle > 0 && currentAngle <= LOWER_ANGLE_MAX;
        const isLowerPostureReady = postureStatus.allLandmarksVisible &&
                                     postureStatus.wristBelowShoulder &&
                                     isLowerAngleValid;
        const lowerWaitingForStable = isLowerPostureReady && lowerPostureStableTime < REQUIRED_STABLE_TIME;

        return (
          <div className="calibration-content">
            <h2>ステップ 2/2</h2>
            <h3>腕立て伏せの「下」の姿勢</h3>
            <p>腕を曲げて下がってください</p>

            {/* 姿勢チェックリスト */}
            <div className="posture-checklist">
              <div className={`check-item ${postureStatus.allLandmarksVisible ? 'valid' : 'invalid'}`}>
                {postureStatus.allLandmarksVisible ? '✓' : '✗'} 全身が見えている
              </div>
              <div className={`check-item ${postureStatus.wristBelowShoulder ? 'valid' : 'invalid'}`}>
                {postureStatus.wristBelowShoulder ? '✓' : '✗'} 手首が肩より下
              </div>
              <div className={`check-item ${isLowerAngleValid ? 'valid' : 'invalid'}`}>
                {isLowerAngleValid ? '✓' : '✗'} 腕の角度 {currentAngle}° （{LOWER_ANGLE_MAX}°以下）
              </div>
            </div>

            {/* 安定時間の表示 */}
            {lowerWaitingForStable && (
              <div className="stable-timer">
                姿勢を維持: {(lowerPostureStableTime / 1000).toFixed(1)}秒 / 3秒
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(lowerPostureStableTime / REQUIRED_STABLE_TIME) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {!isLowerPostureReady && (
              <div className="angle-warning">
                上記の条件を全て満たしてください
              </div>
            )}
          </div>
        );

      case 'complete':
        // キャリブレーション完了後、自動的にゲーム開始
        setTimeout(() => {
          handleComplete();
        }, 1500);

        return (
          <div className="calibration-content">
            <h1>キャリブレーション完了！</h1>
            <div className="calibration-results">
              <div className="result-item">
                <span>上の姿勢:</span>
                <span>{upperAngle}°</span>
              </div>
              <div className="result-item">
                <span>下の姿勢:</span>
                <span>{lowerAngle}°</span>
              </div>
              <div className="result-item">
                <span>検出範囲:</span>
                <span>{lowerAngle + 10}° - {upperAngle - 10}°</span>
              </div>
            </div>
          </div>
        );
    }
  };

  // 3Dモデル準備中はローディング表示
  if (!modelReady) {
    return (
      <div className="calibration-screen async-game-screen" style={{ background: 'transparent' }}>
        <div className="async-countdown-overlay">
          <h1 className="async-countdown-title">3Dモデル準備中...</h1>
        </div>
      </div>
    );
  }

  // キャリブレーション用のオーバーレイコンテンツを生成
  const renderCalibrationOverlay = () => {
    const circumference = 2 * Math.PI * 45; // SVG円の円周

    if (step === 'upper') {
      const isUpperAngleValid = currentAngle >= UPPER_ANGLE_MIN;
      const isUpperPostureReady = postureStatus.allLandmarksVisible &&
                                   postureStatus.wristBelowShoulder &&
                                   isUpperAngleValid;
      const progressPercent = (upperPostureStableTime / REQUIRED_STABLE_TIME) * 100;

      // 全条件達成 → 円形プログレス
      if (isUpperPostureReady) {
        return (
          <div className="calibration-overlay calibration-overlay-centered">
            <div className="calibration-step-label">ステップ 1/2「上」の姿勢</div>
            <div className="circular-progress-container">
              <svg className="circular-progress" viewBox="0 0 100 100">
                <circle className="circular-progress-bg" cx="50" cy="50" r="45" />
                <circle
                  className="circular-progress-fill"
                  cx="50" cy="50" r="45"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * progressPercent / 100)}
                />
              </svg>
              <div className="circular-progress-text">
                {Math.ceil((REQUIRED_STABLE_TIME - upperPostureStableTime) / 1000)}
              </div>
            </div>
            <div className="calibration-hold-message">キープ！！</div>
          </div>
        );
      }

      // 条件未達成 → 未達成を強調
      return (
        <div className="calibration-overlay">
          <div className="calibration-step-label">ステップ 1/2「上」の姿勢</div>
          <div className="calibration-completed-conditions">
            {postureStatus.allLandmarksVisible && <span className="completed-badge">✓ 全身</span>}
            {postureStatus.wristBelowShoulder && <span className="completed-badge">✓ 手首</span>}
            {isUpperAngleValid && <span className="completed-badge">✓ 角度</span>}
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
            {!isUpperAngleValid && postureStatus.allLandmarksVisible && postureStatus.wristBelowShoulder && (
              <div className="pending-condition">
                <div className="pending-icon">📐</div>
                <div className="pending-text">腕を伸ばしてください</div>
                <div className="pending-detail">現在 {currentAngle}° → {UPPER_ANGLE_MIN}°以上</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (step === 'lower') {
      const isLowerAngleValid = currentAngle > 0 && currentAngle <= LOWER_ANGLE_MAX;
      const isLowerPostureReady = postureStatus.allLandmarksVisible &&
                                   postureStatus.wristBelowShoulder &&
                                   isLowerAngleValid;
      const progressPercent = (lowerPostureStableTime / REQUIRED_STABLE_TIME) * 100;

      // 全条件達成 → 円形プログレス
      if (isLowerPostureReady) {
        return (
          <div className="calibration-overlay calibration-overlay-centered">
            <div className="calibration-step-label">ステップ 2/2「下」の姿勢</div>
            <div className="circular-progress-container">
              <svg className="circular-progress" viewBox="0 0 100 100">
                <circle className="circular-progress-bg" cx="50" cy="50" r="45" />
                <circle
                  className="circular-progress-fill"
                  cx="50" cy="50" r="45"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * progressPercent / 100)}
                />
              </svg>
              <div className="circular-progress-text">
                {Math.ceil((REQUIRED_STABLE_TIME - lowerPostureStableTime) / 1000)}
              </div>
            </div>
            <div className="calibration-hold-message">キープ！！</div>
          </div>
        );
      }

      // 条件未達成 → 未達成を強調
      return (
        <div className="calibration-overlay">
          <div className="calibration-step-label">ステップ 2/2「下」の姿勢</div>
          <div className="calibration-completed-conditions">
            {postureStatus.allLandmarksVisible && <span className="completed-badge">✓ 全身</span>}
            {postureStatus.wristBelowShoulder && <span className="completed-badge">✓ 手首</span>}
            {isLowerAngleValid && <span className="completed-badge">✓ 角度</span>}
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
            {!isLowerAngleValid && postureStatus.allLandmarksVisible && postureStatus.wristBelowShoulder && (
              <div className="pending-condition">
                <div className="pending-icon">📐</div>
                <div className="pending-text">腕を曲げてください</div>
                <div className="pending-detail">現在 {currentAngle}° → {LOWER_ANGLE_MAX}°以下</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="calibration-screen async-game-screen" style={{ background: 'transparent' }}>
      {/* intro と complete はカメラなしで表示 */}
      {(step === 'intro' || step === 'complete') && (
        <div className="calibration-main">
          {renderStepContent()}
        </div>
      )}
      {/* upper と lower はフルスクリーンカメラ + オーバーレイ */}
      {(step === 'upper' || step === 'lower') && (
        <PoseDetection
          onPoseDetected={handlePoseDetected}
          fullscreen={true}
          overlayContent={renderCalibrationOverlay()}
        />
      )}
    </div>
  );
};

export default CalibrationScreen;
