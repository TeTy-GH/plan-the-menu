'use client';

import { useEffect, useRef } from 'react';
import { INGREDIENT_CATEGORIES } from '@/constants';

interface IngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  editingText: string;
  setEditingText: (val: string) => void;
  editingCategory: string;
  setEditingCategory: (val: any) => void; // any -> string
  currentStyles: any;
  inputGlobalStyle: string;
  onSave: () => void;
  onDelete?: () => void; // 必須ではなく任意に変更
}

export const IngredientModal = ({
  isOpen,
  onClose,
  mode,
  editingText,
  setEditingText,
  editingCategory,
  setEditingCategory,
  currentStyles,
  inputGlobalStyle,
  onSave,
  onDelete
}: IngredientModalProps) => {
  
  const onCloseRef = useRef(onClose);
  
useEffect(() => {
  onCloseRef.current = onClose;
}, [onClose]);

  // フォーカス制御用のRef
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!isOpen) return; // 閉じている時は何も動かさない

    // === 💡 ここからは「開いた瞬間」に1回だけ実行される ===
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    
    const timer = setTimeout(() => {
      inputRef.current?.focus(); 
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      // 常に最新の onClose をRef経由で安全に呼び出す
      if (e.key === 'Escape') onCloseRef.current(); 
    };

    window.addEventListener('keydown', handleKeyDown);

    // === 💡 クリーンアップ（モーダルが閉じた瞬間に1回だけ実行される） ===
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('height');
      document.documentElement.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('height');
    };
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* 背景クリックで閉じる */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* モーダル本体 */}
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          {mode === 'edit' ? '🥦 食材の編集' : '✨ 食材の登録'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">
              食材名
            </label>
            <input
              ref={inputRef} // ref を追加
              type="text"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              placeholder="例: じゃがいも"
              className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles?.input || ''}`}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">
              カテゴリ
            </label>
            <select
              value={editingCategory}
              onChange={(e) => setEditingCategory(e.target.value)}
              className={`w-full border rounded-xl focus:outline-blue-500 transition cursor-pointer font-black ${inputGlobalStyle} ${currentStyles?.input || ''}`}
            >
              {INGREDIENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat} className="font-black">{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 gap-2">
          {mode === 'edit' && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl font-bold px-4 py-2 transition"
            >
              削除
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300 rounded-xl font-bold px-4 py-2 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onSave}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black px-5 py-2 shadow-sm transition"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};