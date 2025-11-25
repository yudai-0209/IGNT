
import React, { useState, useEffect, useRef } from 'react';
import ActionButton from './ActionButton';
import PreloadingOverlay from './PreloadingOverlay';
import { preloadAllAssets } from './assetLoader';

interface StartScreenProps {
  onNavigateToTutorial: () => void;
  onNavigateToGamePlay?: () => void;
}

const StartScreen = ({ onNavigateToTutorial, onNavigateToGamePlay }: StartScreenProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedSuccessfullyRef = useRef(false);

  // Wake Lock API for preventing screen sleep
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock activated');
      }
    } catch (err) {
      console.log('Wake Lock not supported or failed:', err);
    }
  };

  // Release wake lock
  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Wake Lock released');
    }
  };

  // Handle page visibility changes
  const handleVisibilityChange = () => {
    const isVisible = !document.hidden;

    if (isVisible && !hasLoadedSuccessfullyRef.current && !isLoadingRef.current) {
      // Page became visible and assets haven't loaded successfully yet
      console.log('Page visible again, restarting asset loading');
      loadAssets();
    }
  };

  // Preload all assets
  const loadAssets = async () => {
    // Prevent multiple simultaneous loading attempts
    if (isLoadingRef.current || hasLoadedSuccessfullyRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);

      // Request wake lock to prevent screen sleep
      await requestWakeLock();

      console.log('Starting asset loading...');

      // Use the dynamic asset loader
      await preloadAllAssets();

      // Check if page is still visible
      if (document.hidden) {
        console.log('Page hidden during loading, will retry when visible');
        return;
      }

      console.log('Assets loaded successfully');
      hasLoadedSuccessfullyRef.current = true;

      // Small delay to show the loading screen briefly
      setTimeout(() => {
        if (!document.hidden) {
          setIsLoading(false);
          releaseWakeLock();
        }
      }, 500);
    } catch (error) {
      console.error('Error preloading assets:', error);
      // Don't set loading to false on error, allow retry
      if (!document.hidden) {
        // Retry after a short delay if page is visible
        setTimeout(() => {
          if (!document.hidden && !hasLoadedSuccessfullyRef.current) {
            loadAssets();
          }
        }, 2000);
      }
    } finally {
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start initial loading
    loadAssets();

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  return (
    <>
      <PreloadingOverlay isVisible={isLoading} />
    <main className="relative min-h-screen bg-cover bg-center text-white font-sans bg-[url('/images/background.png')] overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 p-4 sm:p-8 md:p-12 min-h-screen flex flex-col landscape:min-h-0 landscape:h-auto landscape:flex-row">
        <header className="flex justify-center items-start landscape:flex-1 landscape:justify-start landscape:items-center">
          <div className="pt-4 landscape:pt-0">
            <img src="/images/title.png" alt="Survive Together" className="w-64 sm:w-80 md:w-96 landscape:w-48" />
          </div>
        </header>

        <section className="flex-grow flex items-center justify-end landscape:flex-1 landscape:justify-center">
          <div className="flex flex-col items-end space-y-6 mr-0 sm:mr-4 md:mr-8 landscape:items-center landscape:mr-0 landscape:space-y-4">
            <div className="text-right mb-4 landscape:text-center landscape:mb-2">
              <h2 className="text-3xl sm:text-5xl md:text-6xl landscape:text-2xl font-bold text-white drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)]">
                ゾンビの大群が
              </h2>
              <h2 className="text-3xl sm:text-5xl md:text-6xl landscape:text-2xl font-bold text-white drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)]">
                襲ってきました!!
              </h2>
            </div>
            <ActionButton
              text="協力して逃げる"
              variant="primary"
              onClick={onNavigateToTutorial}
              disabled={isLoading}
            />
            {/* {onNavigateToGamePlay && (
              <ActionButton
                text="テストプレイ（直接ゲーム画面へ）"
                variant="secondary"
                onClick={onNavigateToGamePlay}
                disabled={isLoading}
              />
            )} */}
            <ActionButton
              text="今はあきらめてゾンビになる"
              variant="secondary"
              onClick={() => alert('Give up and become a zombie!')}
              disabled={isLoading}
            />
          </div>
        </section>
      </div>
    </main>
    </>
  );
};

export default StartScreen;
