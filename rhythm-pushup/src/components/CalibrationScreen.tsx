import { useState, useEffect, useRef } from 'react';
import { Results } from '@mediapipe/pose';
import PoseDetection from './PoseDetection';
import type { CalibrationData } from '../types';
import './CalibrationScreen.css';

interface CalibrationScreenProps {
  onComplete: (data: CalibrationData) => void;
}

type CalibrationStep = 'intro' | 'upper' | 'lower' | 'complete';

const CalibrationScreen = ({ onComplete }: CalibrationScreenProps) => {
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [currentAngle, setCurrentAngle] = useState<number>(0);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [upperAngle, setUpperAngle] = useState<number>(0);
  const [lowerAngle, setLowerAngle] = useState<number>(0);

  const RECORDING_DURATION = 3000; // 3秒間記録
  const UPPER_ANGLE_MIN = 170; // 上の姿勢の最低角度
  const LOWER_ANGLE_MAX = 90; // 下の姿勢の最大角度

  // useRefで角度バッファを管理（再レンダリングを防ぐ）
  const angleBufferRef = useRef<number[]>([]);
  const frameCountRef = useRef<number>(0);

  const handlePoseDetected = (results: Results) => {
    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      const rightShoulder = landmarks[12];
      const rightElbow = landmarks[14];
      const rightWrist = landmarks[16];

      // 角度計算
      const radians =
        Math.atan2(rightWrist.y - rightElbow.y, rightWrist.x - rightElbow.x) -
        Math.atan2(rightShoulder.y - rightElbow.y, rightShoulder.x - rightElbow.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);

      if (angle > 180.0) {
        angle = 360 - angle;
      }

      const roundedAngle = Math.round(angle);

      // 毎フレーム角度を更新（スムーズな表示のため）
      setCurrentAngle(roundedAngle);

      // 記録処理
      if (step === 'upper' && roundedAngle >= UPPER_ANGLE_MIN) {
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
      } else if (step === 'lower' && roundedAngle > 0 && roundedAngle <= LOWER_ANGLE_MAX) {
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
      }
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
    const defaultData: CalibrationData = {
      upperAngle: 175,
      lowerAngle: 85,
      upperThreshold: 160,
      lowerThreshold: 90,
    };
    onComplete(defaultData);
  };

  const renderStepContent = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="calibration-content">
            <h1>キャリブレーション</h1>
            <p>腕立て伏せの姿勢を認識するため、</p>
            <p>あなたの動きを記録します</p>
            <br />
            <p>カメラの前で腕立て伏せの姿勢になり、</p>
            <p>指示に従ってください</p>
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
        return (
          <div className="calibration-content">
            <h2>ステップ 1/2</h2>
            <h3>腕立て伏せの「上」の姿勢</h3>
            <p>腕を伸ばした状態になってください</p>
            <div className="angle-display">
              <div className="angle-value">{currentAngle}°</div>
              {!isUpperAngleValid && (
                <div className="angle-warning">
                  もっと上げてください（{UPPER_ANGLE_MIN}度以上）
                </div>
              )}
              {isUpperAngleValid && (
                <div className="angle-success">
                  この姿勢をキープ！
                </div>
              )}
            </div>
            {isUpperAngleValid && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${recordingProgress}%` }}
                />
              </div>
            )}
          </div>
        );

      case 'lower':
        const isLowerAngleValid = currentAngle > 0 && currentAngle <= LOWER_ANGLE_MAX;
        return (
          <div className="calibration-content">
            <h2>ステップ 2/2</h2>
            <h3>腕立て伏せの「下」の姿勢</h3>
            <p>腕を曲げて下がってください</p>
            <div className="angle-display">
              <div className="angle-value">{currentAngle}°</div>
              {!isLowerAngleValid && (
                <div className="angle-warning">
                  もっと下げてください（{LOWER_ANGLE_MAX}度以下）
                </div>
              )}
              {isLowerAngleValid && (
                <div className="angle-success">
                  この姿勢をキープ！
                </div>
              )}
            </div>
            {isLowerAngleValid && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${recordingProgress}%` }}
                />
              </div>
            )}
          </div>
        );

      case 'complete':
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
            <button onClick={handleComplete} className="btn-primary">
              ゲーム開始
            </button>
          </div>
        );
    }
  };

  return (
    <div className="calibration-screen">
      <img
        src="/image/pushup_background.jpg"
        alt="Background"
        className="calibration-background"
      />
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
