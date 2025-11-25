/// <reference types="@react-three/fiber" />
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

const Model = ({ url, currentFrame, onLoad }: { url: string; currentFrame: number; onLoad?: () => void }) => {
  const modelRef = React.useRef<Group>(null!);
  const [isModelReady, setIsModelReady] = React.useState(false);
  const { scene, animations } = useGLTF(url, true); // useDraco = true
  const { actions, names } = useAnimations(animations, modelRef);

  React.useEffect(() => {
    console.log('Scene children:', scene.children);
    console.log('Scene children count:', scene.children.length);
    console.log('Available animations:', names);
    console.log('Animation count:', names?.length || 0);

    // マテリアルのテクスチャエンコーディングを修正
    scene.traverse((child) => {
      if ('material' in child) {
        const mesh = child as THREE.Mesh;
        console.log('Mesh name:', mesh.name);

        const processMaterial = (mat: THREE.Material) => {
          console.log('Material:', {
            name: mat.name,
            type: mat.type,
            color: 'color' in mat ? mat.color : undefined,
            map: 'map' in mat ? mat.map : undefined,
          });

          // テクスチャのカラースペース設定
          if ('map' in mat && mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }

          // マテリアルを更新
          mat.needsUpdate = true;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(processMaterial);
        } else {
          processMaterial(mesh.material);
        }
      }
    });

    // GLBファイルに複数のモデルが含まれている場合、最初の1つだけを表示
    if (scene.children.length > 1) {
      // 2番目以降の子要素を非表示にする
      scene.children.forEach((child, index) => {
        if (index > 0) {
          child.visible = false;
        }
      });
    }

    // アニメーションを準備（自動再生はしない）
    if (names && names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.paused = true; // 一時停止状態で開始
        action.play();
        console.log('Animation prepared:', names[0]);
      }
    }

    setIsModelReady(true);
    if (onLoad) {
      onLoad();
    }
  }, [onLoad, scene, actions, names]);

  // フレーム番号に基づいてアニメーション時間を制御
  React.useEffect(() => {
    if (names && names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        const clip = action.getClip();
        const totalFrames = 50; // 総フレーム数
        const timePerFrame = clip.duration / totalFrames;
        const targetTime = currentFrame * timePerFrame;

        action.time = targetTime;
        action.paused = true; // 一時停止状態を維持
      }
    }
  }, [currentFrame, actions, names]);

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={10}
      position={[0.5, -4, 0]}
      rotation={[0, 0, 0]}
      visible={isModelReady}
    />
  );
};

interface PushUpModelProps {
  modelPath: string;
  currentFrame: number;
  onLoad?: () => void;
}

const PushUpModel = ({ modelPath, currentFrame, onLoad }: PushUpModelProps) => {
  return (
    <Canvas camera={{ position: [10, 0, 10], fov: 90 }}>
      <Environment preset="sunset" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 5]} intensity={1.5} />
      <Model url={modelPath} currentFrame={currentFrame} onLoad={onLoad} />
    </Canvas>
  );
};

export default PushUpModel;
