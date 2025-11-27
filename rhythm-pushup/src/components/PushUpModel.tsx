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
  const materialsProcessedRef = React.useRef(false);

  // マテリアル処理は一度だけ実行（sceneオブジェクトに直接適用）
  React.useEffect(() => {
    if (materialsProcessedRef.current) return;

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

          // すべてのテクスチャタイプのカラースペース設定
          const textureProperties = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];
          textureProperties.forEach((prop) => {
            if (prop in mat && (mat as any)[prop]) {
              const texture = (mat as any)[prop] as THREE.Texture;
              texture.colorSpace = prop === 'map' || prop === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              texture.needsUpdate = true;
            }
          });

          // マテリアルを強制的に更新
          mat.needsUpdate = true;

          // MeshStandardMaterialの場合、追加の設定
          if (mat.type === 'MeshStandardMaterial' || mat.type === 'MeshPhysicalMaterial') {
            const standardMat = mat as THREE.MeshStandardMaterial;
            standardMat.envMapIntensity = 1.0;
            standardMat.needsUpdate = true;
          }
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

    materialsProcessedRef.current = true;
  }, [scene, names]);

  // アニメーション準備
  React.useEffect(() => {
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
  }, [onLoad, actions, names]);

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
      rotation={[-0.1, 0, 0]}
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
    <Canvas
      camera={{ position: [0, 0, 30], fov: 50 }}
      gl={{
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
    >
      <Environment preset="sunset" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 5]} intensity={1.5} />
      <Model url={modelPath} currentFrame={currentFrame} onLoad={onLoad} />
    </Canvas>
  );
};

export default PushUpModel;
