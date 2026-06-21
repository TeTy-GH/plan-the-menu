'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CATEGORIES = ['肉・魚・卵', '野菜', 'その他'] as const;
type Category = typeof CATEGORIES[number];

type FontSizeMode = 'small' | 'medium' | 'large';

const FONT_SIZES = {
  small: {
    title: 'text-sm md:text-base',
    btn: 'text-xs md:text-sm px-4 py-2',
    score: 'text-[11px]',
    category: 'text-xs',
    sectionTitle: 'text-lg',
    badge: 'text-[9px]',
    input: 'text-sm p-2',
    masterText: 'text-sm',
    masterBtn: 'text-xs px-2 py-1',
  },
  medium: {
    title: 'text-lg md:text-xl font-black',
    btn: 'text-base md:text-lg px-5 py-3',
    score: 'text-sm md:text-base',
    category: 'text-base md:text-lg',
    sectionTitle: 'text-2xl',
    badge: 'text-xs',
    input: 'text-base p-3',
    masterText: 'text-base md:text-lg font-bold',
    masterBtn: 'text-sm px-3 py-2',
  },
  large: {
    title: 'text-2xl md:text-3xl font-black',
    btn: 'text-xl md:text-2xl px-6 py-4',
    score: 'text-lg md:text-xl',
    category: 'text-xl md:text-2xl',
    sectionTitle: 'text-3xl',
    badge: 'text-sm',
    input: 'text-xl p-4',
    masterText: 'text-xl md:text-2xl font-black',
    masterBtn: 'text-base px-4 py-2.5',
  }
};

interface Ingredient {
  id: string; 
  name: string;
  category: Category;
}

interface Menu {
  id: string;
  title: string;
  score?: number;
  cook_count?: number;
  ingredient_count?: number;
  last_cooked_at?: string | null;
}

// 独自モーダル用の状態型定義
interface ModalConfig {
  show: boolean;
  type: 'made' | 'cancel_cook' | 'delete_ingredient' | 'delete_menu' | null;
  title: string;
  message: string;
  data: any;
}

export default function Home() {
  const [viewMode, setViewMode] = useState<'app' | 'master'>('app');
  const [fontSize, setFontSize] = useState<FontSizeMode>('small');

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [recommendedMenus, setRecommendedMenus] = useState<Menu[]>([]);
  const [keepList, setKeepList] = useState<Menu[]>([]);
  
  // 統合された確認モーダル管理（システムalert/confirmの代わり）
  const [modal, setModal] = useState<ModalConfig>({
    show: false,
    type: null,
    title: '',
    message: '',
    data: null
  });

  const [loading, setLoading] = useState(false);

  const [newMenuTitle, setNewMenuTitle] = useState('');
  const [newMenuIngredients, setNewMenuIngredients] = useState<string[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientCategory, setNewIngredientCategory] = useState<Category>('その他');
  const [masterLoading, setMasterLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category>('その他');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState<string[]>([]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);

  useEffect(() => {
    const savedSize = localStorage.getItem('dinner_app_font_size') as FontSizeMode;
    if (savedSize && ['small', 'medium', 'large'].includes(savedSize)) {
      setFontSize(savedSize);
    }
  }, []);

  const handleFontSizeChange = (size: FontSizeMode) => {
    setFontSize(size);
    localStorage.setItem('dinner_app_font_size', size);
  };

  useEffect(() => {
    async function aggregateIngredients() {
      if (keepList.length === 0) {
        setShoppingList([]);
        return;
      }
      const menuIds = keepList.map(m => m.id);
      const { data } = await supabase
        .from('menu_ingredients')
        .select('ingredient_id')
        .in('menu_id', menuIds);

      if (data) {
        const uniqueIds = [...new Set(data.map(item => item.ingredient_id))];
        const targetIngredients = ingredients.filter(ing => uniqueIds.includes(ing.id));
        setShoppingList(targetIngredients);
      }
    }
    aggregateIngredients();
  }, [keepList, ingredients]);
  
  useEffect(() => {
    async function fetchIngredients() {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, category')
        .order('name');
      
      if (!error && data) {
        const formattedData = data.map(item => ({
          ...item,
          category: (CATEGORIES.includes(item.category as any) ? item.category : 'その他') as Category
        }));
        setIngredients(formattedData);
      }
    }
    fetchIngredients();
  }, [refreshTrigger]);

  useEffect(() => {
    async function fetchMenus() {
      setLoading(true);
      const { data: countData } = await supabase
        .from('menu_ingredients')
        .select('menu_id');
      
      const counts: Record<string, number> = {};
      countData?.forEach(item => {
        counts[item.menu_id] = (counts[item.menu_id] || 0) + 1;
      });

      const targetIds = selectedIngredients.length === 0 ? [] : selectedIngredients;
      const { data, error } = await supabase.rpc('get_recommended_menus', { selected_ingredient_ids: targetIds });

      if (!error && data) {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (Array.isArray(parsedData)) {
          const enrichedMenus = parsedData.map((m: Menu) => ({
            ...m,
            cook_count: m.cook_count ? Number(m.cook_count) : 0,
            last_cooked_at: m.last_cooked_at || null,
            ingredient_count: counts[m.id] || 0
          }));
          setRecommendedMenus(enrichedMenus);
        } else {
          setRecommendedMenus([]);
        }
      } else {
        setRecommendedMenus([]);
      }
      setLoading(false);
    }
    fetchMenus();
  }, [selectedIngredients, refreshTrigger]);

  const handleToggleIngredient = (id: string) => {
    setSelectedIngredients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleAddToKeep = (menu: Menu) => {
    if (keepList.some(item => item.id === menu.id)) return;
    setKeepList([...keepList, menu]);
  };

  const handleRemoveFromKeep = (id: string) => {
    setKeepList(keepList.filter(item => item.id !== id));
  };

  // 各種確認画面の呼び出し（モーダル化）
  const triggerMadeModal = (menu: Menu) => {
    setModal({
      show: true,
      type: 'made',
      title: '調理の確認',
      message: `「${menu.title}」を作りましたか？`,
      data: menu
    });
  };

  const triggerCancelCookModal = (menuId: string, title: string) => {
    setModal({
      show: true,
      type: 'cancel_cook',
      title: '調理取消の確認',
      message: `「${title}」の直近の調理実績を取り消しますか？`,
      data: { menuId }
    });
  };

  const triggerDeleteIngredientModal = async (id: string, name: string) => {
    const { data: connectedMenus } = await supabase
      .from('menu_ingredients')
      .select('menu_id, menus(title)')
      .eq('ingredient_id', id);

    const menuTitles = connectedMenus
      ? connectedMenus.map((item: any) => item.menus?.title).filter(Boolean)
      : [];

    let msg = `食材「${name}」をマスタから完全に削除しますか？`;
    if (menuTitles.length > 0) {
      const firstMenu = menuTitles[0];
      const otherCount = menuTitles.length - 1;
      const suffix = otherCount > 0 ? `（他に${otherCount}つのメニュー）` : '';
      msg = `食材「${name}」は、メニュー「${firstMenu}」${suffix}で使用されています。\n\nすべてのメニューからこの食材を削除し、マスタからも完全に削除してもよろしいですか？\n\n※食材が未登録状態になるメニューが発生する場合があります。`;
    }

    setModal({
      show: true,
      type: 'delete_ingredient',
      title: '削除の確認',
      message: msg,
      data: { id, name }
    });
  };

  const triggerDeleteMenuModal = (id: string, title: string) => {
    setModal({
      show: true,
      type: 'delete_menu',
      title: '削除の確認',
      message: `メニュー「${title}」を削除しますか？\n\n※このメニューの使用食材マスタデータも同時に削除されます。`,
      data: { id, title }
    });
  };

  // モーダルで「はい」を押した時の統合実行ルーチン
  const handleModalConfirm = async () => {
    if (!modal.type || !modal.data) return;

    if (modal.type === 'made') {
      const menu = modal.data as Menu;
      const { data: currentMenu } = await supabase
        .from('menus')
        .select('cook_count, last_cooked_at')
        .eq('id', menu.id)
        .single();

      const currentCount = currentMenu?.cook_count || 0;
      const currentLast = currentMenu?.last_cooked_at || null;

      const { error } = await supabase
        .from('menus')
        .update({ 
          cook_count: currentCount + 1,
          prev_cooked_at: currentLast,
          last_cooked_at: new Date().toISOString().split('T')[0]
        })
        .eq('id', menu.id);

      if (!error) {
        handleRemoveFromKeep(menu.id);
        setRefreshTrigger(prev => prev + 1);
      }
    } 
    
    else if (modal.type === 'cancel_cook') {
      const { menuId } = modal.data;
      const { error } = await supabase.rpc('cancel_last_cooked', { target_menu_id: menuId });
      if (!error) {
        setRefreshTrigger(prev => prev + 1);
      }
    } 
    
    else if (modal.type === 'delete_ingredient') {
      const { id } = modal.data;
      setMasterLoading(true);
      await supabase.from('menu_ingredients').delete().eq('ingredient_id', id);
      const { error: ingError } = await supabase.from('ingredients').delete().eq('id', id);
      if (!ingError) {
        setSelectedIngredients(prev => prev.filter(item => item !== id));
        setRefreshTrigger(prev => prev + 1);
      }
      setMasterLoading(false);
    } 
    
    else if (modal.type === 'delete_menu') {
      const { id } = modal.data;
      await supabase.from('menu_ingredients').delete().eq('menu_id', id);
      const { error } = await supabase.from('menus').delete().eq('id', id);
      if (!error) {
        handleRemoveFromKeep(id);
        setRefreshTrigger(prev => prev + 1);
      }
    }

    setModal({ show: false, type: null, title: '', message: '', data: null });
  };

  const handleRegisterIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientName.trim()) return;

    setMasterLoading(true);
    const { error } = await supabase
      .from('ingredients')
      .insert([{ name: newIngredientName.trim(), category: newIngredientCategory }]);

    if (!error) {
      setNewIngredientName('');
      setNewIngredientCategory('その他');
      setRefreshTrigger(prev => prev + 1);
    }
    setMasterLoading(false);
  };

  const handleRegisterMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuTitle.trim()) return;

    setMasterLoading(true);
    const { data: menuData, error: menuError } = await supabase
      .from('menus')
      .insert([{ title: newMenuTitle.trim(), cook_count: 0 }])
      .select('id')
      .single();

    if (menuError || !menuData) {
      setMasterLoading(false);
      return;
    }

    if (newMenuIngredients.length > 0) {
      const relationData = newMenuIngredients.map(ingId => ({
        menu_id: menuData.id,
        ingredient_id: ingId
      }));
      await supabase.from('menu_ingredients').insert(relationData);
    }

    setNewMenuTitle('');
    setNewMenuIngredients([]);
    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

  const handleUpdateIngredient = async (id: string) => {
    if (!editingText.trim()) return;
    const { error } = await supabase
      .from('ingredients')
      .update({ name: editingText.trim(), category: editingCategory })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleStartEditMenu = async (menu: Menu) => {
    setEditingId(menu.id);
    setEditingText(menu.title);
    
    const { data, error } = await supabase
      .from('menu_ingredients')
      .select('ingredient_id')
      .eq('menu_id', menu.id);
    
    if (!error && data) {
      setEditingMenuIngredients(data.map(item => item.ingredient_id));
    } else {
      setEditingMenuIngredients([]);
    }
  };

  const handleToggleEditingMenuIngredient = (id: string) => {
    setEditingMenuIngredients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleUpdateMenuAndIngredients = async (menuId: string) => {
    if (!editingText.trim()) return;
    setMasterLoading(true);

    const { error: menuError } = await supabase
      .from('menus')
      .update({ title: editingText.trim() })
      .eq('id', menuId);

    if (menuError) {
      setMasterLoading(false);
      return;
    }

    await supabase.from('menu_ingredients').delete().eq('menu_id', menuId);

    if (editingMenuIngredients.length > 0) {
      const relationData = editingMenuIngredients.map(ingId => ({
        menu_id: menuId,
        ingredient_id: ingId
      }));
      await supabase.from('menu_ingredients').insert(relationData);
    }

    setEditingId(null);
    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

  const handleToggleMasterIngredientSelection = (id: string) => {
    setNewMenuIngredients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const currentStyles = FONT_SIZES[fontSize];
  const inputGlobalStyle = "bg-gray-300 text-black font-black placeholder-zinc-500 border-slate-300";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-8 text-slate-800 dark:text-white transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ヘッダー & 画面切り替えタブ */}
        <div className="text-center py-2 space-y-4">
          <h1 className="text-3xl font-extrabold text-indigo-600 dark:text-white tracking-tight flex items-center justify-center gap-2">
            🍳 今日の晩ごはん
          </h1>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setViewMode('app')}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all ${currentStyles.masterText} ${
                viewMode === 'app' 
                  ? 'bg-indigo-600 text-white shadow-md dark:bg-zinc-100 dark:text-black' 
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-white border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              📱 メニュー選び
            </button>
            <button
              onClick={() => { setViewMode('master'); setEditingId(null); }}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all ${currentStyles.masterText} ${
                viewMode === 'master' 
                  ? 'bg-indigo-600 text-white shadow-md dark:bg-zinc-100 dark:text-black' 
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-white border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              ⚙️ 設定
            </button>
          </div>
        </div>

        {/* ----------------- 画面1: メインアプリ ----------------- */}
        {viewMode === 'app' && (
          <>
            {/* 食材選択エリア */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white flex items-center gap-2`}>🧊 使いたい食材</h2>
                {selectedIngredients.length > 0 && (
                  <button onClick={() => setSelectedIngredients([])} className={`text-indigo-600 dark:text-white hover:text-indigo-800 dark:hover:underline font-bold underline ${currentStyles.score}`}>
                    選択取消
                  </button>
                )}
              </div>
              
              {ingredients.length > 0 ? (
                <div className="max-h-72 overflow-y-auto pr-2 border border-dashed border-slate-100 dark:border-zinc-800 p-3 rounded-xl bg-slate-50/50 dark:bg-zinc-950 space-y-4">
                  {CATEGORIES.map(category => {
                    const filteredIngredients = ingredients.filter(ing => ing.category === category);
                    if (filteredIngredients.length === 0) return null;
                    
                    return (
                      <div key={category} className="space-y-1.5">
                        <span className={`block font-black text-indigo-600 dark:text-zinc-400 tracking-wider ${currentStyles.category}`}>
                          【{category}】
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {filteredIngredients.map(ing => {
                            const isSelected = selectedIngredients.includes(ing.id);
                            return (
                              <button
                                key={ing.id}
                                onClick={() => handleToggleIngredient(ing.id)}
                                className={`rounded-xl border font-bold transition-all duration-200 ${currentStyles.btn} ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-95 dark:bg-white dark:text-black dark:border-white' 
                                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
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
              ) : (
                <p className={`text-slate-400 dark:text-white ${currentStyles.masterText}`}>食材がありません。「設定」から登録してください。</p>
              )}
            </div>

            {/* メインカラム */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* おすすめリスト */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white`}>
                    {selectedIngredients.length === 0 ? '📋 おすすめメニュー' : '💡 マッチしたおすすめ'}
                  </h2>
                  <span className={`bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-white font-bold px-2 py-0.5 rounded-full ${currentStyles.badge}`}>{recommendedMenus.length}件</span>
                </div>

                <div className="max-h-[550px] overflow-y-auto pr-2 space-y-2 flex-1">
                  {loading ? (
                    <div className={`text-center py-8 text-slate-400 dark:text-white animate-pulse ${currentStyles.masterText}`}>メニューを取得中...</div>
                  ) : recommendedMenus.length > 0 ? (
                    recommendedMenus.map(menu => (
                      <div key={menu.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-950 hover:bg-indigo-50/30 dark:hover:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-800 transition">
                        <div className="flex flex-col gap-1 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-bold text-slate-800 dark:text-white ${currentStyles.title}`}>{menu.title}</span>
                            {menu.ingredient_count === 0 && (
                              <span className={`bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-white border border-rose-200 dark:border-rose-500 px-1.5 py-0.5 rounded font-bold animate-pulse ${currentStyles.badge}`}>
                                ⚠️食材未登録
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-slate-500 dark:text-zinc-400 font-bold ${currentStyles.score}`}>　おすすめスコア: {Math.round(menu.score || 0)}点</span>
                            {menu.cook_count && menu.cook_count > 0 ? (
                              <button onClick={() => triggerCancelCookModal(menu.id, menu.title)} className={`text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:underline font-black ${currentStyles.score}`}>
                               　↩ 調理取消
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <button onClick={() => handleAddToKeep(menu)} className={`bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white border border-slate-200 dark:border-zinc-700 hover:bg-indigo-600 dark:hover:bg-white dark:hover:text-black rounded-lg font-bold transition-all shadow-sm shrink-0 ${currentStyles.masterBtn}`}>
                          📌 追加
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className={`text-slate-400 dark:text-white text-center py-8 ${currentStyles.masterText}`}>メニューが見つかりませんでした。</p>
                  )}
                </div>
              </div>

              {/* キープ中 */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white`}>📌 調理候補</h2>
                  <span className={`bg-indigo-100 dark:bg-zinc-800 text-indigo-700 dark:text-white font-bold px-2 py-0.5 rounded-full ${currentStyles.badge}`}>{keepList.length}件</span>
                </div>
                <div className="max-h-[550px] overflow-y-auto pr-2 space-y-2 flex-1">
                  {keepList.length > 0 ? (
                    keepList.map(menu => (
                      <div key={menu.id} className="flex items-center justify-between p-3.5 bg-indigo-50/40 dark:bg-zinc-950 rounded-xl border border-indigo-100/70 dark:border-zinc-800">
                        <span className={`font-bold text-slate-800 dark:text-white flex-1 pr-2 ${currentStyles.title}`}>{menu.title}</span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => triggerMadeModal(menu)} className={`bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg font-bold shadow-sm transition ${currentStyles.masterBtn}`}>✅ 作った！</button>
                          <button onClick={() => handleRemoveFromKeep(menu.id)} className={`bg-white dark:bg-zinc-900 text-slate-500 dark:text-white border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition ${currentStyles.masterBtn}`}>取消</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-xl bg-slate-50/30 dark:bg-zinc-950">
                      <p className={`text-slate-400 dark:text-white ${currentStyles.masterText}`}>作りたいメニューを追加してみましょう</p>
                    </div>
                  )}
                  {keepList.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-indigo-100 dark:border-zinc-800 space-y-3">
                      <h3 className={`font-bold text-indigo-700 dark:text-white ${currentStyles.masterText}`}>🛒 必要な食材</h3>
                      
                      {shoppingList.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {CATEGORIES.map(category => {
                            const filteredList = shoppingList.filter(ing => ing.category === category);
                            if (filteredList.length === 0) return null;

                            return (
                              <div key={category} className="space-y-1">
                                <span className={`block font-black text-indigo-600 dark:text-zinc-400 ${currentStyles.category}`}>
                                  【{category}】
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {filteredList.map(ing => (
                                    <span key={ing.id} className={`bg-indigo-100 dark:bg-zinc-800 text-indigo-800 dark:text-white rounded-lg font-bold ${currentStyles.btn}`}>
                                      {ing.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className={`text-slate-400 dark:text-white ${currentStyles.score}`}>食材情報が未登録のメニューが含まれています</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ----------------- 画面2: マスタ管理・設定画面 ----------------- */}
        {viewMode === 'master' && (
          <div className="space-y-8">
            
            {/* 文字サイズ変更 設定カード */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
              <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2`}>🔎 画面の文字サイズ設定</h2>
              <div className="flex flex-wrap gap-2 max-w-xl">
                {(['small', 'medium', 'large'] as const).map((size) => {
                  const label = size === 'small' ? '小（標準）' : size === 'medium' ? '中（1.5倍）' : '大（2倍）';
                  return (
                    <button
                      key={size}
                      onClick={() => handleFontSizeChange(size)}
                      className={`flex-1 py-3 px-2 rounded-xl font-bold border transition-all ${currentStyles.masterText} ${
                        fontSize === size
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md dark:bg-white dark:text-black dark:border-white'
                          : 'bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-800 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 登録フォームエリア */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 食材単体のマスタ登録 */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2`}>🥦 食材の追加</h2>
                <form onSubmit={handleRegisterIngredient} className="space-y-3">
                  <input
                    type="text"
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    placeholder="例: キャベツ、ひき肉"
                    className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                    disabled={masterLoading}
                  />
                  <div>
                    <label className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>分類：</label>
                    <select
                      value={newIngredientCategory}
                      onChange={(e) => setNewIngredientCategory(e.target.value as Category)}
                      className={`w-full border rounded-xl focus:outline-blue-500 transition cursor-pointer font-black ${inputGlobalStyle} ${currentStyles.input}`}
                      disabled={masterLoading}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="font-black">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    disabled={masterLoading || !newIngredientName.trim()} 
                    className={`w-full text-white font-black rounded-xl transition shadow-sm ${currentStyles.input} ${
                      !newIngredientName.trim() 
                        ? 'bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    新しい食材を登録
                  </button>
                </form>
              </div>

              {/* メメニューマスタ登録 */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 md:col-span-2">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2`}>🍽️ メニューの追加</h2>
                <form onSubmit={handleRegisterMenu} className="space-y-3">
                  <input
                    type="text"
                    value={newMenuTitle}
                    onChange={(e) => setNewMenuTitle(e.target.value)}
                    placeholder="例: ハンバーグ"
                    className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                    disabled={masterLoading}
                  />
                  <div>
                    <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>使用する食材を選択:</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-zinc-800 p-2 rounded-xl bg-slate-50/50 dark:bg-zinc-950 space-y-3">
                      {CATEGORIES.map(category => {
                        const filtered = ingredients.filter(ing => ing.category === category);
                        if (filtered.length === 0) return null;
                        return (
                          <div key={category} className="space-y-1">
                            <span className={`block font-black text-indigo-600 dark:text-zinc-400 ${currentStyles.score}`}>【{category}】</span>
                            <div className="flex flex-wrap gap-1.5">
                              {filtered.map(ing => {
                                const isTarget = newMenuIngredients.includes(ing.id);
                                return (
                                  <button
                                    type="button" key={ing.id} onClick={() => handleToggleMasterIngredientSelection(ing.id)}
                                    className={`rounded border font-bold transition ${currentStyles.masterBtn} ${isTarget ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600' : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-700'}`}
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
                  <button 
                    type="submit" 
                    disabled={masterLoading || !newMenuTitle.trim()} 
                    className={`w-full text-white font-black rounded-xl transition shadow-sm ${currentStyles.input} ${
                      !newMenuTitle.trim() 
                        ? 'bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    新しいメニューを登録
                  </button>
                </form>
              </div>
            </div>

            {/* 下段：既存データの編集・削除リストエリア */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 食材の一覧・編集・削除 */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 flex flex-col">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 border-b dark:border-zinc-800 pb-2`}>🧊 食材の編集・削除</h2>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                  {CATEGORIES.map(category => {
                    const filtered = ingredients.filter(ing => ing.category === category);
                    if (filtered.length === 0) return null;
                    return (
                      <div key={category} className="space-y-1">
                        <span className={`block font-black text-indigo-600 dark:text-zinc-400 ${currentStyles.category}`}>【{category}】</span>
                        <div className="space-y-1">
                          {filtered.map(ing => (
                            <div key={ing.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                              {editingId === ing.id ? (
                                <div className="flex flex-col gap-2 w-full bg-white dark:bg-zinc-900 p-2 rounded-lg border dark:border-zinc-800">
                                  <input
                                    type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                                    className={`w-full border rounded focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                                  />
                                  <div className="flex items-center justify-between gap-2">
                                    <select
                                      value={editingCategory}
                                      onChange={(e) => setEditingCategory(e.target.value as Category)}
                                      className={`border rounded focus:outline-blue-500 transition cursor-pointer font-black ${inputGlobalStyle} ${currentStyles.input}`}
                                    >
                                      {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} className="font-black">
                                          {cat}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex gap-2">
                                      <button onClick={() => setEditingId(null)} className={`bg-slate-200 text-slate-600 rounded font-bold ${currentStyles.masterBtn}`}>取消</button>
                                      <button onClick={() => handleUpdateIngredient(ing.id)} className={`bg-blue-600 hover:bg-blue-700 text-white rounded font-black ${currentStyles.masterBtn}`}>保存</button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className={`font-bold text-slate-700 dark:text-white ${currentStyles.masterText}`}>{ing.name}</span>
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingId(ing.id); setEditingText(ing.name); setEditingCategory(ing.category); }} className={`text-indigo-600 dark:text-white hover:underline font-bold dark:bg-zinc-800 dark:rounded ${currentStyles.masterBtn}`}>編集</button>
                                    <button onClick={() => triggerDeleteIngredientModal(ing.id, ing.name)} className={`text-rose-500 dark:text-rose-400 hover:underline font-bold dark:bg-zinc-800 dark:rounded ${currentStyles.masterBtn}`}>削除</button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* メメニューの一覧・編集・削除 */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 flex flex-col">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 border-b dark:border-zinc-800 pb-2`}>📋 メニューの編集・削除</h2>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                  {recommendedMenus.map(menu => (
                    <div key={menu.id} className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                      {editingId === menu.id ? (
                        <div className="space-y-3">
                          <div className="flex gap-1.5">
                            <input
                              type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                              className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                            />
                          </div>
                          <div>
                            <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>使用する食材:</span>
                            <div className="max-h-48 overflow-y-auto border border-slate-200/60 dark:border-zinc-800 p-2 rounded-xl bg-white dark:bg-zinc-950 space-y-2">
                              {CATEGORIES.map(category => {
                                const filtered = ingredients.filter(ing => ing.category === category);
                                if (filtered.length === 0) return null;
                                return (
                                  <div key={category} className="space-y-0.5">
                                    <span className={`block font-black text-indigo-600 dark:text-zinc-400 ${currentStyles.score}`}>【{category}】</span>
                                    <div className="flex flex-wrap gap-1">
                                      {filtered.map(ing => {
                                        const isChecked = editingMenuIngredients.includes(ing.id);
                                        return (
                                          <button
                                            type="button" key={ing.id} onClick={() => handleToggleEditingMenuIngredient(ing.id)}
                                            className={`rounded font-bold border transition ${currentStyles.masterBtn} ${
                                              isChecked 
                                                ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600 shadow-sm' 
                                                : 'bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
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
                          <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-zinc-800">
                            <button onClick={() => setEditingId(null)} className={`bg-slate-200 text-slate-600 rounded font-bold ${currentStyles.masterBtn}`}>取消</button>
                            <button onClick={() => handleUpdateMenuAndIngredients(menu.id)} className={`bg-blue-600 hover:bg-blue-700 text-white rounded font-black shadow-sm ${currentStyles.masterBtn}`}>保存</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className={`font-bold text-slate-700 dark:text-white ${currentStyles.masterText}`}>{menu.title}</span>
                            {menu.ingredient_count === 0 && (
                              <span className={`bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-white border border-rose-200 dark:border-rose-500 px-1.5 py-0.5 rounded font-bold ${currentStyles.badge}`}>
                                ⚠️食材未登録
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handleStartEditMenu(menu)} className={`text-indigo-600 dark:text-white hover:underline font-bold dark:bg-zinc-800 dark:rounded ${currentStyles.masterBtn}`}>編集</button>
                            <button onClick={() => triggerDeleteMenuModal(menu.id, menu.title)} className={`text-rose-500 dark:text-rose-400 hover:underline font-bold dark:bg-zinc-800 dark:rounded ${currentStyles.masterBtn}`}>削除</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 統合型アプリ内確認モーダル */}
      {modal.show && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl max-w-sm w-full shadow-xl border border-slate-100 dark:border-zinc-800 space-y-4">
            <h3 className={`${currentStyles.sectionTitle} font-bold text-slate-900 dark:text-white`}>
              {modal.title}
            </h3>
            <p className={`text-slate-600 dark:text-white leading-relaxed whitespace-pre-line ${currentStyles.masterText}`}>
              {modal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setModal({ show: false, type: null, title: '', message: '', data: null })} 
                className={`bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-slate-600 dark:text-white ${currentStyles.masterBtn}`}
              >
                取消
              </button>
              <button 
                onClick={handleModalConfirm} 
                className={`text-white rounded-xl font-black shadow-sm ${currentStyles.masterBtn} ${
                  modal.type?.startsWith('delete') ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700'
                }`}
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}