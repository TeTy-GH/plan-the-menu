'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

interface Menu {
  id: string;
  title: string;
}

interface AiMenuSuggesterProps {
  selectedIngredients: string[];
  aiMenuTitle: string | null;
  onSuggestionReceived: (menu: Menu) => void;
  currentStyles: any;
  onLoadingChange?: (loading: boolean) => void; // 🟢 親にローディング状態を伝えるためのプロップス
}

// forwardRefを使い、親から内部のhandleAiSuggestを実行できるようにする
const AiMenuSuggester = forwardRef<{ handleAiSuggest: () => void }, AiMenuSuggesterProps>(function AiMenuSuggester({ 
  selectedIngredients, 
  aiMenuTitle,
  onSuggestionReceived,
  currentStyles,
  onLoadingChange
}, ref) {
  const [loading, setLoading] = useState(false);

  // ローディング状態が変わったら親コンポーネントにも通知する
  useEffect(() => {
    if (onLoadingChange) onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  const fetchMenu = async (mode: 'init' | 'force', ingredients: string[]) => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await fetch(`${baseUrl}/functions/v1/suggest-menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ingredient_ids: ingredients })
    });
    return response;
  };

  useEffect(() => {
    const initMenu = async () => {
      setLoading(true);
      try {
        const res = await fetchMenu('init', []);
        const data = await res.json();
        if (data.suggestedMenu) {
          onSuggestionReceived({ id: 'init', title: data.suggestedMenu });
        }
      } catch (err) {
        console.error("初期データの取得に失敗しました:", err);
      } finally {
        setLoading(false);
      }
    };
    initMenu();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAiSuggest = async () => {
    if (loading) return; // 連打防止
    setLoading(true);
    try {
      const res = await fetchMenu('force', selectedIngredients);
      const data = await res.json();
      if (res.ok && data.suggestedMenu) {
        onSuggestionReceived({ id: Date.now().toString(), title: data.suggestedMenu });
      } else {
        alert(data.error || "提案の取得に失敗しました");
      }
    } catch (err) {
      console.error("提案の取得中にエラーが発生しました:", err);
    } finally {
      setLoading(false);
    }
  };

  // 親コンポーネントに命令（関数）を露出させる
  useImperativeHandle(ref, () => ({
    handleAiSuggest
  }));

  // 料理名と紹介文の分割ロジック（古い形式のデータが残っていても壊れないセーフティ付き）
  const hasSlash = aiMenuTitle && aiMenuTitle.includes(' / ');
  const dishName = hasSlash ? aiMenuTitle.split(' / ')[0].trim() : aiMenuTitle || '';
  const description = hasSlash ? aiMenuTitle.split(' / ')[1].trim() : '';

  return (
    <div className="mb-2 w-full p-5 bg-white dark:bg-stone-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
      
      {/* 1. 見出し */}
      <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-zinc-800">
        <span className={`${currentStyles.title}`}>✨</span>
        <div>
          <h3 className={`font-black text-slate-800 dark:text-zinc-100 ${currentStyles.title}`}>
            AI Gemini のおすすめ
          </h3>
        </div>
      </div>
      {aiMenuTitle !== null && (
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={loading}
          className={`${currentStyles.masterText} py-1.5 px-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-transparent dark:border-zinc-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-xs sm:text-sm`}
        >
          {loading ? '🔄 考案中...' : '🔄 再提案'}
        </button>
      )}

      {/* 2. 提案内容（AI解答欄） */}
      <div className="p-4 bg-slate-50 dark:bg-stone-950 rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 min-h-[90px] flex items-center justify-center transition-all">
        {loading ? (
          <div className={`flex items-center gap-2 text-indigo-600 dark:text-indigo-400 ${currentStyles.score} font-medium animate-pulse`}>
            <span className="animate-spin">✨</span>
            <span>
              {selectedIngredients.length > 0 
                ? "Geminiが冷蔵庫の食材から考えています..." 
                : "Geminiが今日の献立を準備しています..."}
            </span>
          </div>
        ) : aiMenuTitle !== null ? (
          <div className="text-center w-full space-y-2">
            <span className={`${currentStyles.score} text-indigo-500 font-bold uppercase tracking-wider block`}>Today's Menu</span>
            
            {/* メニュー名のセンタリング表示 */}
            <p className={`${currentStyles.title} font-black text-slate-800 dark:text-zinc-100 text-center`}>
              {dishName}
            </p>
            
            {/* 🟢 中央寄せの区切り罫線（紹介文がある場合のみ表示） */}
            {description && (
              <hr className="border-slate-300 dark:border-zinc-500 my-3 w-full" />
            )}
            
            {/* 🟢 紹介文の表示（一瞬で読めるスマートなスタイル） */}
            {description && (
              <p className={`${currentStyles.score} text-slate-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto text-center font-medium`}>
                {description}
              </p>
            )}
          </div>
        ) : (
          <p className={`${currentStyles.score} text-slate-400 text-center`}>
            ＜おすすめをタップしてGeminiにきいてみよう＞
          </p>
        )}
      </div>

      {/* 3. 🟢 解答欄の次（下）に「レシピを探す」ボタンを配置 */}
      {aiMenuTitle !== null && !loading && (
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(dishName + ' レシピ (クックパッド OR クラシル)')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${currentStyles.score} flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900/60 transition shadow-sm`}
        >
          🍳 「{dishName}」のレシピを探す
        </a>
      )}
    </div>
  );
});

export default AiMenuSuggester;