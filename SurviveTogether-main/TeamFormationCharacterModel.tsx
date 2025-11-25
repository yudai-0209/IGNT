/// <reference types="@react-three/fiber" />
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

// チーム結成画面専用のInner component
const TeamFormationModel = ({ url, onLoad }: {
  url: string;
  onLoad?: () => void;
}) => {
  const modelRef = React.useRef<Group>(null!);
  const [isModelReady, setIsModelReady] = React.useState(false);
  // Load model and animations from the provided URL.
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, modelRef);

  // チーム結成画面専用の初期設定（フレーム1で停止表示）
  React.useEffect(() => {
    console.log('🎭 TeamFormationModel: 利用可能なアニメーション:', names);
    console.log('🎭 TeamFormationModel: アニメーション数:', names?.length || 0);
    if (names && names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        // Setup animation settings
        action.clampWhenFinished = true; // Stay at last frame when finished
        action.setLoop(THREE.LoopOnce, 1); // Play only once

        const fps = 30; // Standard animation FPS
        const standingFrame = 1; // 立っているフレーム
        const targetTime = standingFrame / fps;

        action.reset();
        action.time = targetTime;
        action.play();
        action.paused = true;

        console.log(`🎭 TeamFormationModel: フレーム${standingFrame}で停止表示`);

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
  }, [actions, names, onLoad]);

  // チーム結成画面専用のスケール（0.8倍で表示）
  const getTeamFormationScale = (modelUrl: string) => {
    if (modelUrl.includes('RPGBoy1.glb') || modelUrl.includes('RPGGirl.glb')) {
      return 18 * 0.5 * 0.6; // チーム結成画面用サイズ = 7.2
    }
    return 1.8; // Default scale
  };

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={getTeamFormationScale(url)}
      position={[0, -2, 0]}
      rotation={[0, 0, 0]}
      visible={isModelReady}
    />
  );
};

// チーム結成画面専用の3Dモデルコンポーネント
interface TeamFormationCharacterModelProps {
  modelPath: string;
  onLoad?: () => void;
}

const TeamFormationCharacterModel = ({ modelPath, onLoad }: TeamFormationCharacterModelProps) => {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 30 }}>
      {/* Lighting setup for a clear and pleasant look */}
      <ambientLight intensity={2} />
      <directionalLight position={[3, 3, 5]} intensity={3} />
      {/* The TeamFormationModel component is rendered here. Suspense for loading is handled by the parent component. */}
      <TeamFormationModel
        url={modelPath}
        onLoad={onLoad}
      />
    </Canvas>
  );
};

export default TeamFormationCharacterModel;