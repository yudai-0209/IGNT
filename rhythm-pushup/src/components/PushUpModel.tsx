/// <reference types="@react-three/fiber" />
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useAnimations, Environment } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// プリロードされたGLTFを使用、なければ自前でロード
const usePreloadedGLTF = (url: string): GLTF | null => {
  const [gltf, setGltf] = React.useState<GLTF | null>(() => {
    // 初期値としてプリロードされたGLTFをチェック
    const preloaded = (window as any).__preloadedGLTF;
    return preloaded || null;
  });

  React.useEffect(() => {
    // プリロードされたものがあればそれを使用
    const preloaded = (window as any).__preloadedGLTF;
    if (preloaded) {
      setGltf(preloaded);
      return;
    }

    // なければ自前でロード
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(url, (loadedGltf) => {
      setGltf(loadedGltf);
    });

    return () => {
      dracoLoader.dispose();
    };
  }, [url]);

  return gltf;
};

const Model = ({ url, currentFrame, onLoad }: { url: string; currentFrame: number; onLoad?: () => void }) => {
  const modelRef = React.useRef<Group>(null!);
  const [isModelReady, setIsModelReady] = React.useState(false);
  const gltf = usePreloadedGLTF(url);
  const scene = gltf?.scene;
  const animations = gltf?.animations || [];
  const { actions, names } = useAnimations(animations, modelRef);
  const materialsProcessedRef = React.useRef(false);
  const onLoadCalledRef = React.useRef(false);
  const onLoadRef = React.useRef(onLoad);
  const [textureLoaded, setTextureLoaded] = React.useState(false);

  // onLoadの参照を更新
  React.useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  // マテリアル処理は一度だけ実行（sceneオブジェクトに直接適用）
  React.useEffect(() => {
    if (!gltf || !scene) return;
    if (materialsProcessedRef.current) return;

    console.log('Scene children:', scene.children);
    console.log('Scene children count:', scene.children.length);
    console.log('Available animations:', names);
    console.log('Animation count:', names?.length || 0);

    // Ch38_bodyテクスチャを外部ファイルから読み込む
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('/textures/Ch38_body.png', (bodyTexture) => {
      console.log('Ch38_body texture loaded successfully');
      bodyTexture.colorSpace = THREE.SRGBColorSpace;
      bodyTexture.flipY = false; // GLTFはflipY=falseが標準
      bodyTexture.needsUpdate = true;

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

            // MeshStandardMaterial/MeshPhysicalMaterialの場合
            if (mat.type === 'MeshStandardMaterial' || mat.type === 'MeshPhysicalMaterial') {
              const standardMat = mat as THREE.MeshStandardMaterial;

              // Ch38_bodyマテリアルにテクスチャを手動で適用
              if (mat.name === 'Ch38_body') {
                console.log('Applying external texture to Ch38_body');
                standardMat.map = bodyTexture;
                standardMat.color = new THREE.Color(0xffffff); // テクスチャの色をそのまま使う
                standardMat.needsUpdate = true;
              }

              // すべてのテクスチャタイプのカラースペース設定
              const textureProperties = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];
              textureProperties.forEach((prop) => {
                if ((standardMat as any)[prop]) {
                  const texture = (standardMat as any)[prop] as THREE.Texture;
                  texture.colorSpace = prop === 'map' || prop === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                  texture.needsUpdate = true;
                }
              });

              standardMat.envMapIntensity = 1.0;
              standardMat.needsUpdate = true;
            }

            // マテリアルを強制的に更新
            mat.needsUpdate = true;
          };

          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(processMaterial);
          } else {
            processMaterial(mesh.material);
          }
        }
      });

      // テクスチャ読み込み完了
      setTextureLoaded(true);
      console.log('Texture applied, model ready');
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
  }, [gltf, scene, names]);

  // アニメーション準備（テクスチャ読み込み完了後）
  React.useEffect(() => {
    if (!gltf || !scene) return;
    if (!textureLoaded) return; // テクスチャ読み込み完了を待つ
    if (onLoadCalledRef.current) return;

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

    // onLoadは一度だけ呼ぶ（テクスチャ適用後）
    if (onLoadRef.current && !onLoadCalledRef.current) {
      onLoadCalledRef.current = true;
      console.log('onLoad callback called (texture loaded)');
      onLoadRef.current();
    }
  }, [gltf, scene, actions, names, textureLoaded]);

  // フレーム番号に基づいてアニメーション時間を制御
  React.useEffect(() => {
    if (!gltf || !scene) return;
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
  }, [gltf, scene, currentFrame, actions, names]);

  // GLTFがまだロードされていない場合は何も表示しない
  if (!gltf || !scene) {
    return null;
  }

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
