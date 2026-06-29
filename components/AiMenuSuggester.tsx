'use client';

import { useState, useEffect } from 'react';

interface Menu {
  id: string;
  title: string;
}

interface AiMenuSuggesterProps {
  selectedIngredients: string[];
  aiMenuTitle: string | null; // 親から現在の提案を受け取る
  onSuggestionReceived: (menu: Menu) => void;
  currentStyles: any;
}

export default function AiMenuSuggester({ 
  selectedIngredients, 
  aiMenuTitle,
  onSuggestionReceived,
  currentStyles
}: AiMenuSuggesterProps) {
  const [loading, setLoading] = useState(false);

  // 共通のfetch関数（最新の環境変数ベースのURL）
  const fetchMenu = async (mode: 'init' | 'force', ingredients: string[]) => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await fetch(`${baseUrl}/functions/v1/suggest-menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ingredient_ids: ingredients })
    });
    return response;
  };

  // 初期表示用
  useEffect(() => {
    const initMenu = async () => {
      setLoading(true); // 🟢 1. 初期ロード開始時にローディングをtrueにする
      try {
        const res = await fetchMenu('init', []);
        const data = await res.json();

        if (data.suggestedMenu) {
          onSuggestionReceived({ id: 'init', title: data.suggestedMenu });
        }
      } catch (err) {
        console.error("初期データの取得に失敗しました:", err);
      } finally {
        setLoading(false); // 🟢 2. 完了（またはエラー）したらローディングを解除する
      }
    };
    initMenu();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ボタン押下用
  const handleAiSuggest = async () => {
    setLoading(true);
    try {
      const res = await fetchMenu('force', selectedIngredients);
      const data = await res.json();
      if (res.ok && data.suggestedMenu) {
        onSuggestionReceived({ id: Date.now().toString(), title: data.suggestedMenu });
      } else {
        alert(data.error || "提案の取得に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-5 bg-white dark:bg-stone-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
      
      {/* 1. AI提案欄であることがわかる見出し */}
      <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-zinc-800">
        <span className="text-xl">✨</span>
        <div>
          <h3 className="font-black text-slate-800 dark:text-zinc-100 text-sm md:text-base">
            AI Gemini のおすすめ
          </h3>
        </div>
      </div>

      {/* 2. 提案の内容（親の aiMenuTitle を使用） */}
      <div className="p-4 bg-slate-50 bg-stone-950 rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 min-h-[70px] flex items-center justify-center transition-all">
        {loading ? (
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs md:text-sm font-medium animate-pulse">
            <span className="animate-spin">✨</span>
            {/* 🟢 3. 食材選択の有無でローディング中の文言を出し分けます */}
            <span>
              {selectedIngredients.length > 0 
                ? "Geminiが冷蔵庫の食材から考えています..." 
                : "Geminiが今日の献立を準備しています..."}
            </span>
          </div>
        ) : aiMenuTitle !== null ? (
          <div className="text-center space-y-1">
            <span className="text-[16px] text-indigo-500 font-bold uppercase tracking-wider block">Today's Menu</span>
            <p className="text-base md:text-lg font-black text-slate-800 dark:text-zinc-100">
              {aiMenuTitle}
            </p>
          </div>
        ) : (
          <p className="text-xs md:text-sm text-slate-400 text-center">
            ＜おすすめをタップしてGeminiにきいてみよう＞
          </p>
        )}
      </div>

      {/* 3. AIリクエストボタン */}
      <button
        onClick={handleAiSuggest}
        disabled={loading}
        className={`${currentStyles.masterBtn} w-full py-2.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-stone-900 dark:hover:bg-stone-700 border border-transparent dark:border-zinc-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? '✨ AI Gemini が考案中...' : aiMenuTitle !== null ? '🔄 再提案' : '✨ AI Gemini のおすすめ'}
      </button>
    </div>
  );
}