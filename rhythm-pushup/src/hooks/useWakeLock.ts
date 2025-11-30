import { useEffect, useCallback } from 'react';
import NoSleep from 'nosleep.js';

/**
 * 画面スリープを防止するカスタムフック
 * グローバルな NoSleep インスタンスを使用
 * @param enabled - true の場合、スリープ防止を維持。false の場合、無効化
 */
export const useWakeLock = (enabled: boolean) => {
  const getNoSleep = useCallback((): NoSleep | null => {
    return (window as any).__noSleep || null;
  }, []);

  const disableNoSleep = useCallback(() => {
    const noSleep = getNoSleep();
    if (noSleep) {
      noSleep.disable();
      console.log('NoSleep 無効化 - 画面スリープ防止を解除');
    }
  }, [getNoSleep]);

  const enableNoSleep = useCallback(() => {
    const noSleep = getNoSleep();
    if (noSleep) {
      noSleep.enable();
      console.log('NoSleep 再有効化');
    }
  }, [getNoSleep]);

  useEffect(() => {
    // enabledがtrueの間は何もしない（ModeSelectScreenで有効化済み）
    // アプリを使用中は常にNoSleepを維持する
  }, [enabled]);

  // タブが再表示された時に再有効化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (enabled && document.visibilityState === 'visible') {
        enableNoSleep();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, enableNoSleep]);

  return { enableNoSleep, disableNoSleep };
};

export default useWakeLock;
