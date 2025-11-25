/// <reference types="@react-three/fiber" />
/**
 * ⚠️ 【重要】このCharacterModel.tsxは非推奨です ⚠️
 *
 * 新しい実装では以下の専用コンポーネントを使用してください：
 * - 敵キャラ: EnemyCharacterModel.tsx（アニメーション専用、姿勢変更の影響を受けない）
 * - プレイヤーキャラ: PlayerCharacterModel.tsx（姿勢制御専用、アニメーション機能なし）
 *
 * このファイルは互換性のため残されていますが、以下の問題があります：
 * - 敵のアニメーション中に姿勢変更でアニメーションがリセットされる
 * - isAnimatingとpostureStateが混在して複雑
 */
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

// Inner component to load and display the GLB model
const Model = ({ url, onLoad, isAnimating, onAnimationComplete, postureState = 'standing', viewDirection = 'front' }: {
  url: string;
  onLoad?: () => void;
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
  postureState?: 'standing' | 'sitting';
  viewDirection?: 'front' | 'back';
}) => {
  const modelRef = React.useRef<Group>(null!);
  const [isModelReady, setIsModelReady] = React.useState(false);
  // Load model and animations from the provided URL.
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, modelRef);

  // 姿勢フレーム定義
  const POSTURE_FRAMES = {
    standing: 1,   // 立っているフレーム
    sitting: 24    // しゃがんでいるフレーム
  } as const;

  // Handle animation control
  React.useEffect(() => {
        console.log('🎯 利用可能なアニメーション:', names);
    console.log('🎯 アニメーション数:', names?.length || 0);
    if (names && names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        // Setup animation settings
        action.clampWhenFinished = true; // Stay at last frame when finished
        action.setLoop(THREE.LoopOnce, 1); // Play only once
        action.timeScale = 0.5; // 0.5倍速でアニメーション再生

        // Frame control settings (1-50 frames)
        const fps = 30; // Standard animation FPS
        const animationSpeed = 0.5; // アニメーション速度倍率
        const startFrame = 1;
        const endFrame = 45;
        const startTime = startFrame / fps; // Convert frame to time
        const endTime = endFrame / fps;
        const baseDuration = endTime - startTime;
        const duration = baseDuration / animationSpeed; // 0.5倍速なので時間は2倍

        console.log('📊 フレーム計算詳細:', {
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
          console.log('🎯 CharacterModel: アニメーション開始', { startFrame, endFrame, duration });
          // Show model immediately when animation starts
          setIsModelReady(true);
          // Start animation from frame 1
          action.reset();
          action.time = startTime;
          console.log(`⏯️ アニメーション設定: time=${startTime}秒 (フレーム${startFrame})`);
          action.play();
          action.paused = false;
          console.log('▶️ アニメーション再生開始');

          // Stop at frame 50 and trigger callback
          const animationTimer = setTimeout(() => {
            console.log('⏰ CharacterModel: アニメーション完了タイマー実行');
            console.log(`⏹️ アニメーション停止: time=${action.time}秒 (フレーム${Math.round(action.time * fps)})`);
            action.paused = true;
            if (onAnimationComplete) {
              console.log('📞 CharacterModel: onAnimationComplete呼び出し');
              onAnimationComplete();
            } else {
              console.log('❌ CharacterModel: onAnimationCompleteがundefined');
            }
          }, duration * 1000); // Convert to milliseconds

          return () => {
            console.log('🧹 CharacterModel: アニメーションタイマークリーンアップ');
            clearTimeout(animationTimer);
          };
        } else {
          // 姿勢制御: 特定フレームで停止
          const targetFrame = POSTURE_FRAMES[postureState];
          const targetTime = targetFrame / fps;

          action.reset();
          action.time = targetTime;
          action.play();
          action.paused = true;

          console.log(`🧍 姿勢設定: ${postureState} (フレーム${targetFrame}, time=${targetTime.toFixed(3)}秒)`);

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
  }, [actions, names, onLoad, isAnimating, onAnimationComplete, postureState]);

  // Render the loaded 3D scene.
  // The model's scale and position are adjusted for proper display.
  // Scale specific models with different ratios
  const getModelScale = (modelUrl: string) => {
    if (modelUrl.includes('RPGBoy1.glb') || modelUrl.includes('RPGGirl.glb')) {
      return 18 * 0.5; // Current size * 0.5 = 9
    }
    if (modelUrl.includes('enemy0.glb')) {
      return 18 * 0.3; // Current size * 0.3 = 5.4
    }
    return 1.8; // Default scale
  };

  // Y軸回転角度を計算（後ろ向きの場合は180度回転）
  const rotationY = viewDirection === 'back' ? Math.PI : 0;

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={getModelScale(url)}
      position={[0, -2, 0]}
      rotation={[0, rotationY, 0]}
      visible={isModelReady}
    />
  );
};

// Main component for displaying the 3D character model.
// It sets up the 3D scene with a camera and lighting.
interface CharacterModelProps {
  modelPath: string;
  onLoad?: () => void;
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
  postureState?: 'standing' | 'sitting';
  viewDirection?: 'front' | 'back';
}

const CharacterModel = ({ modelPath, onLoad, isAnimating, onAnimationComplete, postureState = 'standing', viewDirection = 'front' }: CharacterModelProps) => {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 30 }}>
      {/* Lighting setup for a clear and pleasant look */}
      <ambientLight intensity={2} />
      <directionalLight position={[3, 3, 5]} intensity={3} />
      {/* The Model component is rendered here. Suspense for loading is handled by the parent component. */}
      <Model
        url={modelPath}
        onLoad={onLoad}
        isAnimating={isAnimating}
        onAnimationComplete={onAnimationComplete}
        postureState={postureState}
        viewDirection={viewDirection}
      />
    </Canvas>
  );
};

export default CharacterModel;