import React, { useState, useEffect } from 'react';
import CharacterModel from './CharacterModel';

interface GameStartScreenProps {
  onStartGame: () => void;
  matchedUser?: {id: string, name: string} | null;
}

const GameStartScreen: React.FC<GameStartScreenProps> = ({ onStartGame, matchedUser }) => {
  const [isReady, setIsReady] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // 画面表示時にスクロール位置を一番上に戻す
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // 画面ロード後、少し遅れてボタンを有効化（演出のため）
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleVideoEnd = () => {
    setVideoEnded(true);
    // 動画終了後、少し遅れてコンテンツをフェードイン
    setTimeout(() => {
      setShowContent(true);
    }, 300);
  };

  const handleSkipVideo = () => {
    // 動画を強制終了してコンテンツをフェードイン
    setVideoEnded(true);
    setTimeout(() => {
      setShowContent(true);
    }, 100);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans text-white bg-black">
      {/* Main Video - Full Screen */}
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          autoPlay
          muted
          onEnded={handleVideoEnd}
          className="w-full h-full object-contain"
          preload="auto"
          playsInline
        >
          <source src="/Video/TestVideo.mp4" type="video/mp4" />
          <source src="/Video/TestVideo.webm" type="video/webm" />
          <source src="/Video/TestVideo.ogv" type="video/ogg" />
          お使いのブラウザは動画再生に対応していません。
        </video>
      </div>

      {/* Skip Button - only visible during video playback */}
      {!videoEnded && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleSkipVideo}
            className="bg-black/60 hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 border border-white/20"
          >
            スキップ
          </button>
        </div>
      )}

      {/* Content that appears after video ends */}
      {videoEnded && (
        <div className={`absolute inset-0 bg-black flex items-center justify-center transition-opacity duration-1000 ${
          showContent ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="text-center space-y-6 px-4 max-w-md">
            {/* Teammate Info */}
            {matchedUser && (
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                <p className="text-sm font-bold text-yellow-300 mb-1">チームメイト</p>
                <p className="text-xl font-bold text-white">{matchedUser.name}</p>
                <p className="text-xs text-gray-300 mt-1">
                  協力してゲームをクリアしよう！
                </p>
              </div>
            )}

            {/* Game Instructions */}
            <div className="bg-white/10 backdrop-blur-sm p-5 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-bold text-white mb-2">
                  スクワットをして敵の攻撃をよけろ！
                </p>
                <p className="text-xl font-bold text-purple-300">
                  チームワークが重要です
                </p>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={onStartGame}
              disabled={!isReady}
              className={`relative px-8 py-4 rounded-lg font-bold text-xl transition-all duration-300 transform ${
                isReady
                  ? 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 hover:scale-105 shadow-xl shadow-red-700/30 text-white'
                  : 'bg-gray-500 opacity-50 cursor-not-allowed text-gray-300'
              }`}
            >
              {isReady ? (
                <>
                  <span className="relative z-10">ゲームスタート</span>
                  <div className="absolute inset-0 rounded-lg bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300" />
                </>
              ) : (
                '準備中...'
              )}
            </button>

            {/* Loading animation when not ready */}
            {!isReady && (
              <div className="mt-4">
                <div className="flex items-center justify-center gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameStartScreen;