import fs from 'fs';
import path from 'path';

const generateAssetsManifest = () => {
  const publicDir = './public';
  const imagesDir = path.join(publicDir, 'images');
  const modelsDir = path.join(publicDir, 'Models');
  
  const manifest = {
    images: [],
    models: []
  };

  // Read images directory
  if (fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir);
    manifest.images = imageFiles
      .filter(file => /\.(png|jpg|jpeg|gif|webp)$/i.test(file))
      .map(file => `/images/${file}`);
  }

  // Read models directory  
  if (fs.existsSync(modelsDir)) {
    const modelFiles = fs.readdirSync(modelsDir);
    manifest.models = modelFiles
      .filter(file => /\.(glb|gltf)$/i.test(file))
      .map(file => `/Models/${file}`);
  }

  // Write manifest file
  fs.writeFileSync(
    path.join(publicDir, 'assets-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('Assets manifest generated:', manifest);
};

generateAssetsManifest();