/// <reference types="@react-three/fiber" />
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

// プレイヤーキャラ専用のInner component
const PlayerModel = ({ url, onLoad, postureState = 'standing', viewDirection = 'front' }: {
  url: string;
  onLoad?: () => void;
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

  // プレイヤーキャラ専用の姿勢制御（アニメーション処理を含まない）
  React.useEffect(() => {
    console.log('🎮 PlayerModel: 利用可能なアニメーション:', names);
    console.log('🎮 PlayerModel: アニメーション数:', names?.length || 0);
    if (names && names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        // Setup animation settings
        action.clampWhenFinished = true; // Stay at last frame when finished
        action.setLoop(THREE.LoopOnce, 1); // Play only once

        const fps = 30; // Standard animation FPS

        // 姿勢制御: 特定フレームで停止
        const targetFrame = POSTURE_FRAMES[postureState];
        const targetTime = targetFrame / fps;

        action.reset();
        action.time = targetTime;
        action.play();
        action.paused = true;

        console.log(`🎮 PlayerModel: 姿勢設定: ${postureState} (フレーム${targetFrame}, time=${targetTime.toFixed(3)}秒)`);

        // Wait a frame to ensure the pose is set, then show the model
        setTimeout(() => {
          setIsModelReady(true);
        }, 50);
      }
    }
    // Notify that the model has loaded
    if (onLoad) {
      onLoad();
    }
  }, [actions, names, onLoad, postureState]); // isAnimatingを除外

  // プレイヤーキャラ専用のスケール（RPGBoy1.glb, RPGGirl.glb用）
  const getPlayerScale = (modelUrl: string) => {
    if (modelUrl.includes('RPGBoy1.glb') || modelUrl.includes('RPGGirl.glb')) {
      return 18 * 0.6; // プレイヤーキャラのサイズ
    }
    return 1.8; // Default scale
  };

  // Y軸回転角度を計算（後ろ向きの場合は180度回転）
  const rotationY = viewDirection === 'back' ? Math.PI : 0;

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={getPlayerScale(url)}
      position={[0, -2, 0]}
      rotation={[0, rotationY, 0]}
      visible={isModelReady}
    />
  );
};

// プレイヤーキャラ専用の3Dモデルコンポーネント
interface PlayerCharacterModelProps {
  modelPath: string;
  onLoad?: () => void;
  postureState?: 'standing' | 'sitting';
  viewDirection?: 'front' | 'back';
}

const PlayerCharacterModel = ({ modelPath, onLoad, postureState = 'standing', viewDirection = 'front' }: PlayerCharacterModelProps) => {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 30 }}>
      {/* Lighting setup for a clear and pleasant look */}
      <ambientLight intensity={2} />
      <directionalLight position={[3, 3, 5]} intensity={3} />
      {/* The PlayerModel component is rendered here. Suspense for loading is handled by the parent component. */}
      <PlayerModel
        url={modelPath}
        onLoad={onLoad}
        postureState={postureState}
        viewDirection={viewDirection}
      />
    </Canvas>
  );
};

export default PlayerCharacterModel;