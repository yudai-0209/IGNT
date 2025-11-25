/// <reference types="@react-three/fiber" />
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

// 敵キャラ専用のInner component
const EnemyModel = ({ url, onLoad, isAnimating, onAnimationComplete }: {
  url: string;
  onLoad?: () => void;
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
}) => {
  const modelRef = React.useRef<Group>(null!);
  const [isModelReady, setIsModelReady] = React.useState(false);
  // Load model and animations from the provided URL.
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, modelRef);

  // 敵キャラ専用のアニメーション制御（姿勢変更に影響されない）
  React.useEffect(() => {
    console.log('👹 EnemyModel: 利用可能なアニメーション:', names);
    console.log('👹 EnemyModel: アニメーション数:', names?.length || 0);
    if (names && names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        // Setup animation settings
        action.clampWhenFinished = true; // Stay at last frame when finished
        action.setLoop(THREE.LoopOnce, 1); // Play only once
        action.timeScale = 0.5; // 0.5倍速でアニメーション再生

        // Frame control settings (1-45 frames)
        const fps = 30; // Standard animation FPS
        const animationSpeed = 0.5; // アニメーション速度倍率
        const startFrame = 1;
        const endFrame = 80;
        const startTime = startFrame / fps; // Convert frame to time
        const endTime = endFrame / fps;
        const baseDuration = endTime - startTime;
        const duration = baseDuration / animationSpeed; // 0.5倍速なので時間は2倍

        console.log('👹 EnemyModel: フレーム計算詳細:', {
          fps,
          animationSpeed: `${animationSpeed}x`,
          startFrame,
          endFrame,
          startTime: `${startTime.toFixed(3)}秒`,
          endTime: `${endTime.toFixed(3)}秒`,
          baseDuration: `${baseDuration.toFixed(3)}秒`,
          duration: `${duration.toFixed(3)}秒`,
          durationMs: `${(duration * 1000).toFixed(0)}ms`
        });

        if (isAnimating) {
          console.log('👹 EnemyModel: 敵アニメーション開始', { startFrame, endFrame, duration });
          // Show model immediately when animation starts
          setIsModelReady(true);
          // Start animation from frame 1
          action.reset();
          action.time = startTime;
          console.log(`👹 EnemyModel: アニメーション設定: time=${startTime}秒 (フレーム${startFrame})`);
          action.play();
          action.paused = false;
          console.log('👹 EnemyModel: 敵アニメーション再生開始');

          // Stop at frame 45 and trigger callback
          const animationTimer = setTimeout(() => {
            console.log('👹 EnemyModel: 敵アニメーション完了タイマー実行');
            console.log(`👹 EnemyModel: アニメーション停止: time=${action.time}秒 (フレーム${Math.round(action.time * fps)})`);
            action.paused = true;
            if (onAnimationComplete) {
              console.log('👹 EnemyModel: onAnimationComplete呼び出し');
              onAnimationComplete();
            } else {
              console.log('👹 EnemyModel: onAnimationCompleteがundefined');
            }
          }, duration * 1000); // Convert to milliseconds

          return () => {
            console.log('👹 EnemyModel: アニメーションタイマークリーンアップ');
            clearTimeout(animationTimer);
          };
        } else {
          // 敵キャラは待機状態（フレーム1で停止）
          action.reset();
          action.time = startTime; // フレーム1
          action.play();
          action.paused = true;

          console.log('👹 EnemyModel: 敵キャラ待機状態 (フレーム1)');

          // Wait a frame to ensure the pose is set, then show the model
          setTimeout(() => {
            setIsModelReady(true);
          }, 50);
        }
      }
    }
    // Notify that the model has loaded
    if (onLoad && !isAnimating) {
      onLoad();
    }
  }, [actions, names, onLoad, isAnimating, onAnimationComplete]); // postureStateを除外

  // 敵キャラ専用のスケール（enemy0.glb用）
  const getEnemyScale = () => {
    return 18 * 0.3; // 敵キャラのサイズ
  };

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={getEnemyScale()}
      position={[0, -2, 0]}
      rotation={[0, 0, 0]}
      visible={isModelReady}
    />
  );
};

// 敵キャラ専用の3Dモデルコンポーネント
interface EnemyCharacterModelProps {
  modelPath: string;
  onLoad?: () => void;
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
}

const EnemyCharacterModel = ({ modelPath, onLoad, isAnimating, onAnimationComplete }: EnemyCharacterModelProps) => {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 30 }}>
      {/* Lighting setup for a clear and pleasant look */}
      <ambientLight intensity={2} />
      <directionalLight position={[3, 3, 5]} intensity={3} />
      {/* The EnemyModel component is rendered here. Suspense for loading is handled by the parent component. */}
      <EnemyModel
        url={modelPath}
        onLoad={onLoad}
        isAnimating={isAnimating}
        onAnimationComplete={onAnimationComplete}
      />
    </Canvas>
  );
};

export default EnemyCharacterModel;