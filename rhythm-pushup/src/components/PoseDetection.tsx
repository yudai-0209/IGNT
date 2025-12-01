import { useEffect, useRef, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import type { Results, NormalizedLandmark } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import type { CalibrationData } from '../types';
import './PoseDetection.css';

interface PoseDetectionProps {
  onPoseDetected?: (results: Results) => void;
  onPushUpCount?: (count: number) => void;
  onFrameUpdate?: (frame: number) => void;
  onBodyVisibilityChange?: (isVisible: boolean) => void;
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

// 角度から3Dモデルのフレーム番号を計算（25-50の範囲）
function angleToFrame(
  currentAngle: number,
  upperAngle: number,
  lowerAngle: number
): number {
  // 角度を0-1の範囲に正規化
  const normalizedAngle = (currentAngle - lowerAngle) / (upperAngle - lowerAngle);

  // 0-1の値を25-50のフレーム範囲にマッピング
  // 上限角度(大きい角度) → フレーム25(高い位置)
  // 下限角度(小さい角度) → フレーム50(低い位置)
  const frame = 50 - (normalizedAngle * 25);

  // フレーム範囲を25-50にクランプ
  return Math.max(25, Math.min(50, Math.round(frame)));
}

const PoseDetection = ({
  onPoseDetected,
  onPushUpCount,
  onFrameUpdate,
  onBodyVisibilityChange,
  calibrationData,
}: PoseDetectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // カメラサイズの状態
  const [cameraSize, setCameraSize] = useState({ width: 640, height: 480 });
  // 画面の向き（変更時にカメラを再起動するため）
  const [orientation, setOrientation] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight ? 'landscape' : 'portrait' : 'portrait'
  );

  // 腕立て伏せの状態管理
  const [pushUpCount, setPushUpCount] = useState(0);
  const [currentState, setCurrentState] = useState<'up' | 'down' | 'unknown'>('unknown');
  const [currentAngle, setCurrentAngle] = useState<number>(0);
  const [isPositionValid, setIsPositionValid] = useState<boolean>(false);

  const stateRef = useRef<'up' | 'down' | 'unknown'>('unknown');
  const countRef = useRef<number>(0);
  const onPoseDetectedRef = useRef(onPoseDetected);
  const onPushUpCountRef = useRef(onPushUpCount);
  const onFrameUpdateRef = useRef(onFrameUpdate);
  const onBodyVisibilityChangeRef = useRef(onBodyVisibilityChange);
  const lastVisibilityRef = useRef<boolean | null>(null);
  const invisibleFrameCountRef = useRef<number>(0);
  const INVISIBLE_THRESHOLD_FRAMES = 15; // 約0.5秒間見えない状態が続いたら通知

  // しきい値（キャリブレーションデータがあれば15度内側、なければデフォルト値）
  const upperThresholdRef = useRef(150); // デフォルト: 150度
  const lowerThresholdRef = useRef(120); // デフォルト: 120度

  // refを常に最新の値に更新
  useEffect(() => {
    onPoseDetectedRef.current = onPoseDetected;
    onPushUpCountRef.current = onPushUpCount;
    onFrameUpdateRef.current = onFrameUpdate;
    onBodyVisibilityChangeRef.current = onBodyVisibilityChange;
  });

  // キャリブレーションデータから閾値を設定
  useEffect(() => {
    if (calibrationData) {
      // キャリブレーションの角度から15度内側を閾値にする
      upperThresholdRef.current = calibrationData.upperAngle - 15;
      lowerThresholdRef.current = calibrationData.lowerAngle + 15;
      console.log(`カウント閾値設定: 上=${upperThresholdRef.current}° 下=${lowerThresholdRef.current}°`);
    } else {
      // スキップ時のデフォルト値
      upperThresholdRef.current = 150;
      lowerThresholdRef.current = 120;
      console.log('カウント閾値: デフォルト値使用 (上=150° 下=120°)');
    }
  }, [calibrationData]);

  // 画面回転を検知してorientationを更新（カメラ再起動のトリガー）
  useEffect(() => {
    const handleOrientationChange = () => {
      setTimeout(() => {
        const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        setOrientation(prev => {
          if (prev !== newOrientation) {
            console.log(`画面回転検出: ${prev} → ${newOrientation}`);
            return newOrientation;
          }
          return prev;
        });
      }, 300);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

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

        // 両腕の必要なランドマーク
        const leftShoulder = landmarks[11];   // LEFT_SHOULDER
        const leftElbow = landmarks[13];      // LEFT_ELBOW
        const leftWrist = landmarks[15];      // LEFT_WRIST
        const rightShoulder = landmarks[12];  // RIGHT_SHOULDER
        const rightElbow = landmarks[14];     // RIGHT_ELBOW
        const rightWrist = landmarks[16];     // RIGHT_WRIST

        // すべてのランドマークの可視性をチェック（visibility > 0.5）
        const requiredLandmarks = [
          leftShoulder, leftElbow, leftWrist,
          rightShoulder, rightElbow, rightWrist
        ];

        const allVisible = requiredLandmarks.every(
          landmark => landmark.visibility && landmark.visibility > 0.3
        );

        if (allVisible) {
          setIsPositionValid(true);
          // 見えるようになったらカウンターをリセット
          invisibleFrameCountRef.current = 0;
          // 可視性が変化した場合のみコールバックを呼ぶ（即座に通知）
          if (lastVisibilityRef.current !== true) {
            lastVisibilityRef.current = true;
            if (onBodyVisibilityChangeRef.current) {
              onBodyVisibilityChangeRef.current(true);
            }
          }

          // 右腕の角度を計算（肩-肘-手首）
          const angle = calculateAngle(rightShoulder, rightElbow, rightWrist);
          const currentAngle = Math.round(angle);

          setCurrentAngle(currentAngle);

          // 角度から3Dモデルのフレーム番号を計算して通知（リアルタイム）
          if (onFrameUpdateRef.current) {
            const frame = angleToFrame(
              currentAngle,
              upperThresholdRef.current,
              lowerThresholdRef.current
            );
            onFrameUpdateRef.current(frame);
          }

          // 腕立て伏せの状態判定（現在の角度を使用）
          // 上→下で1回とカウント
          if (currentAngle < lowerThresholdRef.current && stateRef.current === 'up') {
            // 下がった状態（カウントアップ）
            stateRef.current = 'down';
            setCurrentState('down');
            countRef.current += 1;
            setPushUpCount(countRef.current);

            if (onPushUpCountRef.current) {
              onPushUpCountRef.current(countRef.current);
            }
          } else if (currentAngle > upperThresholdRef.current && stateRef.current === 'down') {
            // 上がった状態
            stateRef.current = 'up';
            setCurrentState('up');
          } else if (currentAngle > upperThresholdRef.current && stateRef.current === 'unknown') {
            // 初期状態を「上」に設定
            stateRef.current = 'up';
            setCurrentState('up');
          }
        } else {
          // ランドマークが見えない場合
          setIsPositionValid(false);
          setCurrentAngle(0);
          // 連続で見えないフレーム数をカウント
          invisibleFrameCountRef.current += 1;
          // 一定フレーム数連続で見えない場合のみ通知（デバウンス）
          if (invisibleFrameCountRef.current >= INVISIBLE_THRESHOLD_FRAMES) {
            if (lastVisibilityRef.current !== false) {
              lastVisibilityRef.current = false;
              if (onBodyVisibilityChangeRef.current) {
                onBodyVisibilityChangeRef.current(false);
              }
            }
          }
        }
      }

      // コールバック実行
      if (onPoseDetectedRef.current) {
        onPoseDetectedRef.current(results);
      }
    });

    // カメラを起動（内カメラを明示的に指定）
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await pose.send({ image: videoRef.current });
        }
      },
      width: 1280,  // 希望する最大幅（実際のカメラに依存）
      height: 720,  // 希望する最大高さ
      facingMode: 'user',  // 内カメラ（フロントカメラ）を使用
    });

    camera.start();

    // カメラの実際のサイズを取得
    const checkVideoSize = () => {
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        const width = videoRef.current.videoWidth;
        const height = videoRef.current.videoHeight;
        setCameraSize({ width, height });

        // canvasもカメラサイズに合わせる
        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
        console.log(`カメラサイズ: ${width}x${height} (${orientation})`);
      } else {
        // まだ取得できない場合は再試行
        setTimeout(checkVideoSize, 100);
      }
    };
    checkVideoSize();

    return () => {
      camera.stop();
      pose.close();
    };
  }, [orientation]); // orientation変更時にカメラを再起動

  // 表示用のサイズを計算（最大幅25vw、アスペクト比維持）
  const displayWidth = Math.min(window.innerWidth * 0.25, 320);
  const aspectRatio = cameraSize.height / cameraSize.width;
  const displayHeight = displayWidth * aspectRatio;

  return (
    <div
      ref={containerRef}
      className="pose-detection-container"
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
    >
      <video
        ref={videoRef}
        className="pose-video"
        width={cameraSize.width}
        height={cameraSize.height}
        autoPlay
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="pose-canvas"
        width={cameraSize.width}
        height={cameraSize.height}
      />
      <div className="pose-debug-info">
        {!isPositionValid && (
          <div style={{ color: '#ff3333', fontWeight: 'bold' }}>
            両腕を画面内に入れてください
          </div>
        )}
        <div>カウント: {pushUpCount}</div>
        <div>状態: {currentState === 'up' ? '上' : currentState === 'down' ? '下' : '不明'}</div>
        <div>角度: {currentAngle}°</div>
      </div>
    </div>
  );
};

export default PoseDetection;
