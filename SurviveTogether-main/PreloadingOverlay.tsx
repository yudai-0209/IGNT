import React from 'react';

interface PreloadingOverlayProps {
  isVisible: boolean;
}

const PreloadingOverlay: React.FC<PreloadingOverlayProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <div className="text-lg font-semibold">ゲーム準備中...</div>
        <div className="text-sm mt-2 opacity-75">アセットを読み込んでいます</div>
      </div>
    </div>
  );
};

export default PreloadingOverlay;