
import React, { useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { ref, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, database } from './firebase';
import ActionButton from './ActionButton';

interface CooperationScreenProps {
  onNavigateToMatching: () => void;
}

const CooperationScreen = ({ onNavigateToMatching }: CooperationScreenProps) => {
  // 画面表示時にスクロール位置を一番上に戻す（iPhone Chrome強力対応）
  useEffect(() => {
    const forceScrollToTop = () => {
      // 方法1: window.scroll (scrollToより効果的な場合がある)
      if (window.scroll) {
        window.scroll(0, 0);
      }

      // 方法2: 標準的なscrollTo
      window.scrollTo(0, 0);

      // 方法3: documentのスクロール
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // 方法4: iPhone/iPad/iPod Chrome専用の超強力処理
      if (/(iPhone|iPad|iPod)/i.test(navigator.userAgent)) {
        // pageYOffsetを使用
        if (window.pageYOffset !== 0) {
          window.scrollTo(0, 0);
        }

        // 少し待ってから再実行
        setTimeout(() => {
          window.scroll(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;

          // さらに強制的に
          if (window.scrollY > 0) {
            window.scrollTo({ top: 0, behavior: 'instant' });
          }
        }, 10);

        // さらに確実にするため複数回実行
        setTimeout(() => {
          window.scroll(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }, 50);

        setTimeout(() => {
          window.scroll(0, 0);
        }, 100);

        // 最終手段：requestAnimationFrameを使用
        requestAnimationFrame(() => {
          window.scroll(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        });
      }
    };

    // 即座に実行
    forceScrollToTop();

    // コンポーネントマウント後にも実行
    setTimeout(forceScrollToTop, 0);
  }, []);

  // Firebase認証とuserStatus設定
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const savedNickname = localStorage.getItem(`nickname_${user.uid}`) || `ゲスト${Math.floor(Math.random() * 100)}`;
        const userStatusRef = ref(database, `userStatus/${user.uid}`);

        set(userStatusRef, {
          userId: user.uid,
          displayName: savedNickname,
          status: 'preparing',
          currentScreen: 'cooperation',
          lastUpdated: serverTimestamp()
        });

        onDisconnect(userStatusRef).remove();
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <main className="relative min-h-screen bg-cover bg-center text-white font-sans bg-[url('/images/background2.png')] overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 p-4 sm:p-8 md:p-12 min-h-screen flex flex-col landscape:min-h-0 landscape:h-auto">
        <div className="flex-grow flex flex-col justify-center items-center space-y-12 landscape:space-y-6">
          <h2 className="text-4xl sm:text-5xl md:text-6xl landscape:text-3xl font-bold text-white drop-shadow-[0_3px_3px_rgba(0,0,0,0.7)]">
            誰と協力する？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 landscape:grid-cols-2 gap-8 landscape:gap-4 w-full max-w-4xl px-4">
            <div className="aspect-video">
              <ActionButton
                text="チーム内"
                variant="selection"
                onClick={onNavigateToMatching}
              />
            </div>
            <div className="aspect-video">
              <ActionButton
                text="他部署"
                variant="selection"
                onClick={onNavigateToMatching}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CooperationScreen;
