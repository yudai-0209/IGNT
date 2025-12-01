import { useState, useEffect, useRef } from 'react';
import type { Results } from '@mediapipe/pose';
import PoseDetection from './PoseDetection';
import type { CalibrationData } from '../types';
import './CalibrationScreen.css';
import './AsyncGameScreen.css';

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
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [upperAngle, setUpperAngle] = useState<number>(0);
  const [lowerAngle, setLowerAngle] = useState<number>(0);
  const [postureStatus, setPostureStatus] = useState<PostureStatus>({
    allLandmarksVisible: false,
    wristBelowShoulder: false,
  });
  const [upperPostureStableTime, setUpperPostureStableTime] = useState<number>(0);
  const [lowerPostureStableTime, setLowerPostureStableTime] = useState<number>(0);

  // 未使用の警告を防ぐ
  void assetsLoaded;

  const UPPER_ANGLE_MIN = 170; // 上の姿勢の最低角度
  const LOWER_ANGLE_MAX = 120; // 下の姿勢の最大角度
  const REQUIRED_STABLE_TIME = 3000; // 3秒 = 3000ms

  // useRefで角度バッファを管理（再レンダリングを防ぐ）
  const angleBufferRef = useRef<number[]>([]);
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

      // 記録処理（上の姿勢）
      if (step === 'upper') {
        // 上の姿勢の全条件が5秒以上満たされている場合のみ記録
        const upperStable = upperPostureStableStartRef.current !== null &&
                            (now - upperPostureStableStartRef.current) >= REQUIRED_STABLE_TIME;

        if (upperStable) {
          angleBufferRef.current.push(roundedAngle);

          if (angleBufferRef.current.length >= 30) {
            const average =
              angleBufferRef.current.reduce((sum, a) => sum + a, 0) /
              angleBufferRef.current.length;
            setUpperAngle(Math.round(average));
            setStep('lower');
            angleBufferRef.current = [];
            setRecordingProgress(0);
          } else {
            setRecordingProgress((angleBufferRef.current.length / 30) * 100);
          }
        } else {
          // 条件を満たさなくなったらバッファをリセット
          if (angleBufferRef.current.length > 0) {
            angleBufferRef.current = [];
            setRecordingProgress(0);
          }
        }
      } else if (step === 'lower') {
        // 下の姿勢の全条件が5秒以上満たされている場合のみ記録
        const lowerStable = lowerPostureStableStartRef.current !== null &&
                            (now - lowerPostureStableStartRef.current) >= REQUIRED_STABLE_TIME;

        if (lowerStable) {
          angleBufferRef.current.push(roundedAngle);

          if (angleBufferRef.current.length >= 30) {
            const average =
              angleBufferRef.current.reduce((sum, a) => sum + a, 0) /
              angleBufferRef.current.length;
            setLowerAngle(Math.round(average));
            setStep('complete');
          } else {
            setRecordingProgress((angleBufferRef.current.length / 30) * 100);
          }
        } else {
          // 条件を満たさなくなったらバッファをリセット
          if (angleBufferRef.current.length > 0) {
            angleBufferRef.current = [];
            setRecordingProgress(0);
          }
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

  // ステップ変更時にバッファをリセット
  useEffect(() => {
    angleBufferRef.current = [];
    setRecordingProgress(0);
  }, [step]);

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
        const upperReadyToRecord = upperPostureStableTime >= REQUIRED_STABLE_TIME;

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

            {upperReadyToRecord && (
              <div className="angle-success">
                この姿勢をキープ！記録中...
                <div className="progress-bar">
                  <div
                    className="progress-fill recording"
                    style={{ width: `${recordingProgress}%` }}
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
        const lowerReadyToRecord = lowerPostureStableTime >= REQUIRED_STABLE_TIME;

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

            {lowerReadyToRecord && (
              <div className="angle-success">
                この姿勢をキープ！記録中...
                <div className="progress-bar">
                  <div
                    className="progress-fill recording"
                    style={{ width: `${recordingProgress}%` }}
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

  return (
    <div className="calibration-screen async-game-screen" style={{ background: 'transparent' }}>
      {/* 背景、circle、3DモデルはApp.tsxで表示するため削除 */}
      <div className="calibration-main">
        {renderStepContent()}
      </div>
      {step !== 'intro' && step !== 'complete' && (
        <div className="calibration-camera">
          <PoseDetection onPoseDetected={handlePoseDetected} />
        </div>
      )}
    </div>
  );
};

export default CalibrationScreen;
