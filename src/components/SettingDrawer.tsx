import { useEffect } from 'react';

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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // コンポーネントが閉じられたり消えたりしたときに元に戻す（クリーンアップ）
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]); // isOpen が変わるたびに実行する

  return (
    <>
      {/* 背景の暗転（オーバーレイ） */}
      <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
                      ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
        
      {/* ドロワー本体 */}
      <div className={`fixed top-0 right-0 h-[20%] md:h-full w-[40%] md:w-80 bg-white dark:bg-zinc-900 z-50 
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

        <div className="flex flex-norap gap-3 pl-4">
          {(['small', 'medium', 'large'] as const).map((size) => {
            const label = size === 'small' ? '小' : size === 'medium' ? '中' : '大';
            
            return (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                // flex-1 を使うことで、横並びのボタンが均等に幅を分け合います
                className={`flex-1 min-w-[30%] py-2 rounded-xl font-bold border transition-all text-center ${currentStyles.masterText} ${
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
