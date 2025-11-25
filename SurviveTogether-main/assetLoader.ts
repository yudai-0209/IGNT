import { useGLTF } from '@react-three/drei';

// Load asset list from manifest file
export const getAssetList = async () => {
  const fallbackAssets = {
    images: [
      '/images/background.png',
      '/images/background2.png',
      '/images/title.png',
      '/images/plank.png',
      '/images/is_published_false.png',
      '/images/is_published_true.png'
    ],
    models: [
      '/Models/RPGBoy1.glb',
      '/Models/RPGGirl.glb',
      '/Models/enemy0.glb'
    ],
    videos: [
      '/Video/TestVideo.mp4'
    ]
  };

  try {
    // Try to load asset manifest file
    const response = await fetch('/assets-manifest.json');
    if (response.ok) {
      const manifest = await response.json();
      return manifest;
    } else {
      console.log('Assets manifest not found, using fallback list');
      return fallbackAssets;
    }
  } catch (error) {
    console.error('Error loading asset manifest:', error);
    return fallbackAssets;
  }
};

// Preload images
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// Preload videos
export const preloadVideo = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve();
    video.onerror = reject;
    video.src = src;
  });
};

// Preload all assets
export const preloadAllAssets = async (): Promise<void> => {
  const assets = await getAssetList();

  // Preload GLB models
  const glbPromises = assets.models
    .filter(path => path.endsWith('.glb') || path.endsWith('.gltf'))
    .map(path => useGLTF.preload(path));

  // Preload images
  const imagePromises = assets.images
    .filter(path => path.match(/\.(png|jpg|jpeg|gif|webp)$/i))
    .map(path => preloadImage(path));

  // Preload videos
  const videoPromises = (assets.videos || [])
    .filter(path => path.match(/\.(mp4|webm|ogg)$/i))
    .map(path => preloadVideo(path));

  // Wait for all assets to load
  await Promise.all([...glbPromises, ...imagePromises, ...videoPromises]);
};