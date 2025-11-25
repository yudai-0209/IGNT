import { useEffect, useRef, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { Pose, Results, NormalizedLandmark } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import type { CalibrationData } from '../types';
import './PoseDetection.css';

interface PoseDetectionProps {
  onPoseDetected?: (results: Results) => void;
  onPushUpCount?: (count: number) => void;
  calibrationData?: CalibrationData | null;
  width?: number;
  height?: number;
}

// 角度計算関数（3点から角度を計算）
function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

const PoseDetection = ({
  onPoseDetected,
  onPushUpCount,
  calibrationData,
  width = 320,
  height = 240
}: PoseDetectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 腕立て伏せの状態管理
  const [pushUpCount, setPushUpCount] = useState(0);
  const [currentState, setCurrentState] = useState<'up' | 'down' | 'unknown'>('unknown');
  const [currentAngle, setCurrentAngle] = useState<number>(0);

  const stateRef = useRef<'up' | 'down' | 'unknown'>('unknown');
  const countRef = useRef<number>(0);
  const onPoseDetectedRef = useRef(onPoseDetected);
  const onPushUpCountRef = useRef(onPushUpCount);

  // しきい値（キャリブレーションデータまたはデフォルト値）
  const upperThreshold = calibrationData?.upperThreshold ?? 160;
  const lowerThreshold = calibrationData?.lowerThreshold ?? 90;
  const upperThresholdRef = useRef(upperThreshold);
  const lowerThresholdRef = useRef(lowerThreshold);

  // refを常に最新の値に更新
  useEffect(() => {
    onPoseDetectedRef.current = onPoseDetected;
    onPushUpCountRef.current = onPushUpCount;
    upperThresholdRef.current = upperThreshold;
    lowerThresholdRef.current = lowerThreshold;
  });

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    pose.setOptions({
      modelComplexity: 0, // 0 = 軽量モデル（高速処理優先）
      smoothLandmarks: false, // ランドマーク平滑化無効（レイテンシ削減）
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: Results) => {
      if (!canvasRef.current) return;

      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      // Canvasをクリア（透明に）
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // 姿勢推定の骨格のみを描画（カメラ映像は描画しない）
      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 3,
        });
        drawLandmarks(canvasCtx, results.poseLandmarks, {
          color: '#FF0000',
          lineWidth: 1,
          radius: 3,
        });

        // 腕立て伏せ検出ロジック
        const landmarks = results.poseLandmarks;

        // 右腕の角度を計算（肩-肘-手首）
        const rightShoulder = landmarks[12]; // RIGHT_SHOULDER
        const rightElbow = landmarks[14]; // RIGHT_ELBOW
        const rightWrist = landmarks[16]; // RIGHT_WRIST

        const angle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        const roundedAngle = Math.round(angle);
        setCurrentAngle(roundedAngle);

        // 腕立て伏せの状態判定（refから最新の値を取得）
        if (roundedAngle < lowerThresholdRef.current && stateRef.current !== 'down') {
          // 下がった状態
          stateRef.current = 'down';
          setCurrentState('down');
        } else if (roundedAngle > upperThresholdRef.current && stateRef.current === 'down') {
          // 上がった状態（カウントアップ）
          stateRef.current = 'up';
          setCurrentState('up');
          countRef.current += 1;
          setPushUpCount(countRef.current);

          if (onPushUpCountRef.current) {
            onPushUpCountRef.current(countRef.current);
          }
        } else if (roundedAngle > upperThresholdRef.current && stateRef.current === 'unknown') {
          // 初期状態を「上」に設定
          stateRef.current = 'up';
          setCurrentState('up');
        }
      }

      // コールバック実行
      if (onPoseDetectedRef.current) {
        onPoseDetectedRef.current(results);
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await pose.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();

    return () => {
      camera.stop();
      pose.close();
    };
  }, []);

  return (
    <div className="pose-detection-container">
      <video ref={videoRef} className="pose-video" width={640} height={480} autoPlay playsInline />
      <canvas ref={canvasRef} className="pose-canvas" width={640} height={480} />
      <div className="pose-debug-info">
        <div>カウント: {pushUpCount}</div>
        <div>状態: {currentState === 'up' ? '上' : currentState === 'down' ? '下' : '不明'}</div>
        <div>角度: {currentAngle}°</div>
      </div>
    </div>
  );
};

export default PoseDetection;
