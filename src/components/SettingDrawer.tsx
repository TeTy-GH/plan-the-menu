import { useEffect, useRef } from 'react';

interface SettingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fontSize: 'small' | 'medium' | 'large';
  handleFontSizeChange: (size: 'small' | 'medium' | 'large') => void;
  currentStyles: any;
}

export const SettingDrawer = ({ 
  isOpen, 
  onClose, 
  fontSize, 
  handleFontSizeChange, 
  currentStyles 
}: SettingDrawerProps) => {

  // 1️⃣ 最新の onClose を常にキープするRef（モーダルと同じ安全対策）
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 2️⃣ スクロールロックとESCキー制御を1本に統合
  useEffect(() => {
    if (!isOpen) return; // 💡 閉じている時は完全にスルーする

    // === 開いた瞬間に1回だけ実行 ===
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown); // 💡 漏れていた登録を追加

    // === 閉じた瞬間に1回だけ実行（クリーンアップ） ===
    return () => {
      window.removeEventListener('keydown', handleKeyDown); // 💡 解除もセット
      document.body.style.removeProperty('overflow'); // 💡 removeProperty が正解
    };
  }, [isOpen]); // 💡 依存配列は isOpen のみに絞る

  // ※ もし `if (!isOpen) return null;` などの制御があればここに挟む

  return (
    <>
      {/* 背景の暗転（オーバーレイ） */}
      <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
                      ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
        
      {/* ドロワー本体 */}
      <div className={`fixed top-0 right-0 h-[25%] md:h-full w-[50%] md:w-80 bg-white dark:bg-zinc-900 z-50 
                      shadow-2xl p-2 md:p-4 transition-transform duration-300 ease-in-out md:top-0 md:right-0 md:h-full md:w-96 md:rounded-none
                      ${isOpen ? 'translate-y-0 md:translate-x-0 md:translate-y-0' : 'translate-y-[-100%] md:translate-x-full md:translate-y-0'}`}>
        <div className='flex justify-end'>
          <button onClick={onClose} className={`mb-4 text-slate-500 dark:text-white ${currentStyles.masterText}`}>
            ✕ 閉じる
          </button>
        </div>
        <h2 className={`font-bold mb-4 ${currentStyles.masterText}`}>
          🔎 文字サイズ
        </h2>

        <div className="flex flex-norap gap-2 lg:gap-3 pl-4">
          {(['small', 'medium', 'large'] as const).map((size) => {
            const label = size === 'small' ? '小' : size === 'medium' ? '中' : '大';
            
            return (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                // flex-1 を使うことで、横並びのボタンが均等に幅を分け合います
                className={`flex-1 min-w-[30%] py-1 lg:py-2 rounded-xl font-bold border transition-all text-center ${currentStyles.masterText} ${
                  fontSize === size
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md dark:bg-white dark:text-black dark:border-white'
                    : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
