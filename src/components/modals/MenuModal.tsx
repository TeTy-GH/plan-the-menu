'use client';

import { INGREDIENT_CATEGORIES } from '@/constants';
import React, { useRef, useEffect } from 'react';

type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

interface Ingredient {
  id: string; 
  name: string;
  category: IngredientCategory;
}

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  
  // モーダル用のステート群
  editingMenuTitle: string;
  setEditingMenuTitle: (value: string) => void;
  editingMenuType: 'main' | 'side';
  setEditingMenuType: (type: 'main' | 'side') => void;
  editingMenuMemo: string;
  setEditingMenuMemo: (value: string) => void;
  editingMenuIngredients: string[]; // 選択された食材IDの配列
  handleToggleMasterIngredientSelection: (id: string) => void;

  // 外部データ（食材一覧と定数）
  ingredients: Ingredient[];

  // AIレシピ作成関連のステートと関数
  isAiLoading: boolean;
  extractedRecipe: any; // null または レシピデータ
  handleAiCreateRecipe: () => void;
  handleOpenConfirmModal: () => void;

  // ローディング・スタイル
  masterLoading: boolean;
  currentStyles: any;
  inputGlobalStyle?: string;
  
  // アクションハンドラー
  onSave: () => void;
  onDelete: () => void;
}

export const MenuModal: React.FC<MenuModalProps> = ({
  isOpen,
  onClose,
  mode,
  editingMenuTitle,
  setEditingMenuTitle,
  editingMenuType,
  setEditingMenuType,
  editingMenuMemo,
  setEditingMenuMemo,
  editingMenuIngredients,
  handleToggleMasterIngredientSelection,
  ingredients,
  isAiLoading,
  extractedRecipe,
  handleAiCreateRecipe,
  handleOpenConfirmModal,
  masterLoading,
  currentStyles,
  inputGlobalStyle,
  onSave,
  onDelete,
}) => {
  if (!isOpen) return null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 🌟 メモの値（editingMenuMemo）が変わるたびに高さを完璧に再計算する
  useEffect(() => {
    // 💡 setTimeoutで囲むことで、Reactのレンダリング（文字の反映）が
    // 完全に終わった「直後の正確な高さ」を確実に取得して適用します。
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // 一旦リセットして
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight * 1.04}px`; // 1.04は高さの認識ズレによるサイズ不足の解消
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [editingMenuMemo]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      {/* 🌟 w-full から w-11/12 md:w-4/5 に変更し、max-w-4xl に広げました */}
      <div className="w-11/12 md:w-4/5 max-w-4xl bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">        
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white flex items-center gap-2`}>
            {mode === 'add' ? '🍽️ メニューの追加' : '✏️ メニューの編集'}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1"
            disabled={masterLoading}
          >
            ✕
          </button>
        </div>

        {/* スクロール可能なフォーム本体 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1 overscroll-contain">
          
          {/* メニュー名入力 */}
          <div className="space-y-1">
            <input
              type="text"
              value={editingMenuTitle}
              onChange={(e) => setEditingMenuTitle(e.target.value)}
              placeholder="例: ハンバーグ"
              className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
              disabled={masterLoading}
            />
          </div>

          {/* メニューのカテゴリ選択 */}
          <div>
            <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>
              メニューのカテゴリ：
            </span>
            <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 text-stone-900 dark:text-white w-fit">
              <button
                type="button"
                onClick={() => setEditingMenuType('main')}
                disabled={masterLoading}
                className={`px-3 py-1 rounded transition ${currentStyles.score} ${
                  editingMenuType === 'main' 
                    ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow font-bold' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                🍗 主菜
              </button>
              <button
                type="button"
                onClick={() => setEditingMenuType('side')}
                disabled={masterLoading}
                className={`px-3 py-1 rounded transition ${currentStyles.score} ${
                  editingMenuType === 'side' 
                    ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow font-bold' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                🥗 副菜
              </button>
            </div>
          </div>

          {/* 使用する食材の選択 */}
          <div>
            <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>
              使用する食材を選択：
            </span>
            <div className="max-h-48 overflow-y-auto overscroll-contain border border-slate-100 dark:border-stone-100/10 p-2 rounded-xl bg-slate-50/50 dark:bg-stone-900 space-y-2">
              {INGREDIENT_CATEGORIES.map(category => {
                const filtered = ingredients.filter(ing => ing.category === category);
                if (filtered.length === 0) return null;
                return (
                  <div key={category} className="space-y-1">
                    <span className={`block font-black text-indigo-600 dark:text-yellow-600 ${currentStyles.score}`}>
                      ー {category} ー
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {filtered.map(ing => {
                        const isTarget = editingMenuIngredients.includes(ing.id);
                        return (
                          <button
                            type="button" 
                            key={ing.id} 
                            onClick={() => handleToggleMasterIngredientSelection(ing.id)}
                            disabled={masterLoading}
                            className={`rounded border font-bold transition ${currentStyles.masterBtn} ${
                              isTarget 
                                ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600' 
                                : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {ing.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* レシピ・メモエリア（AI機能付き） */}
          <div className="relative pt-1">
            <div className="flex justify-between items-center mb-2">
              <span className={`block font-bold text-slate-400 dark:text-white ${currentStyles.score}`}>
                レシピ・メモ：
              </span>
            </div>

            {/* AIレシピボタン群 */}
            {isAiLoading ? (
              <button
                type="button"
                disabled
                className={`${currentStyles.masterBtn} absolute top-0 right-0 leading-none tracking-tighter rounded-lg font-bold border dark:border-zinc-600 bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed flex items-center gap-1 z-10`}
              >
                <span className="animate-spin">🌀</span> レシピ作成中...
              </button>
            ) : extractedRecipe !== null ? (
              <button
                type="button"
                onClick={handleOpenConfirmModal}
                className={`${currentStyles.masterBtn} absolute top-0 right-0 leading-none tracking-tighter rounded-lg font-black border dark:border-zinc-600 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 animate-pulse flex items-center gap-1 z-10 transition-all duration-300`}
              >
                <span>📌</span> メモへ貼付け
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAiCreateRecipe}
                disabled={masterLoading}
                className={`${currentStyles.masterBtn} absolute top-0 right-0 rounded-lg leading-none tracking-tighter font-bold border dark:border-zinc-600 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/80 flex items-center gap-1 z-10 transition-colors`}
              >
                <span>✨</span> AIレシピ作成
              </button>
            )}

            <textarea
              id="modal-menu-memo-textarea"
              ref={textareaRef}
              value={editingMenuMemo}
              disabled={masterLoading}
              onChange={(e) => {
                setEditingMenuMemo(e.target.value);
                //e.target.style.height = 'auto';
                //e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="材料や作り方、コツなどを自由にメモ...（エンターキーの改行がそのまま反映されます）"
              rows={3}
              className={`w-full p-3 border rounded-xl overflow-hidden focus:outline-blue-500 transition resize-none text-base leading-snug ${inputGlobalStyle} ${currentStyles.input}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 shrink-0">
          {/* 編集モードの時だけ削除ボタンを表示 */}
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={masterLoading}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl font-bold px-4 py-2 transition"
            >
              削除
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={masterLoading}
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