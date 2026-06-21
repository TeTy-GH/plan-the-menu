'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Ingredient {
  id: string; 
  name: string;
}

interface Menu {
  id: string;
  title: string;
  score?: number;
  cook_count?: number;
  ingredient_count?: number;
  last_cooked_at?: string | null;
}

export default function Home() {

  // 画面モード切り替え ('app': メイン画面, 'master': マスタ管理画面)
  const [viewMode, setViewMode] = useState<'app' | 'master'>('app');

  // メイン画面用ステート
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [recommendedMenus, setRecommendedMenus] = useState<Menu[]>([]);
  const [keepList, setKeepList] = useState<Menu[]>([]);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; menu: Menu | null }>({ show: false, menu: null });
  const [loading, setLoading] = useState(false);

  // マスタ新規登録用ステート
  const [newMenuTitle, setNewMenuTitle] = useState('');
  const [newMenuIngredients, setNewMenuIngredients] = useState<string[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [masterLoading, setMasterLoading] = useState(false);

  // インライン編集用ステート
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState<string[]>([]); // 【新機能】編集中のメニューが使う材料IDリスト

  // データ再取得用フラグ
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ステート定義の場所に追加
  const [shoppingList, setShoppingList] = useState<string[]>([]);

  // 【新機能】調理候補メニューから材料を自動集計
  useEffect(() => {
  async function aggregateIngredients() {
    if (keepList.length === 0) {
      setShoppingList([]);
      return;
    }

    const menuIds = keepList.map(m => m.id);
    
    // 中間テーブルから、現在キープしているメニューに関連する材料IDを全取得
    const { data } = await supabase
      .from('menu_ingredients')
      .select('ingredient_id')
      .in('menu_id', menuIds);

    if (data) {
      // 重複を除去した材料IDリストを作成
      const uniqueIds = [...new Set(data.map(item => item.ingredient_id))];
      
      // IDから材料名へ変換
      const names = ingredients
        .filter(ing => uniqueIds.includes(ing.id))
        .map(ing => ing.name);
        
      setShoppingList(names);
    }
  }
  aggregateIngredients();
  }, [keepList, ingredients]);
  
  // 1. 材料一覧の取得
  useEffect(() => {
    async function fetchIngredients() {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name')
        .order('name');
      
      if (!error && data) {
        setIngredients(data);
      } else {
        console.error("材料取得エラー:", error);
      }
    }
    fetchIngredients();
  }, [refreshTrigger]);

  // 2. おすすめ・全件メニューの取得
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

      if (error || !data) {
        console.error("メニュー取得エラー:", error);
        setRecommendedMenus([]);
      } else {
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

  const handleMadeClick = (menu: Menu) => {
    setShowConfirm({ show: true, menu });
  };

  // 調理実績の登録
  const handleConfirmMade = async () => {
    if (!showConfirm.menu) return;
    const menuId = showConfirm.menu.id;

    const { data: currentMenu } = await supabase
      .from('menus')
      .select('cook_count, last_cooked_at')
      .eq('id', menuId)
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
      .eq('id', menuId);

    if (!error) {
      alert(`「${showConfirm.menu.title}」の調理記録を更新しました！`);
      handleRemoveFromKeep(menuId);
      setRefreshTrigger(prev => prev + 1);
    } else {
      alert('調理記録の更新に失敗しました。');
    }
    setShowConfirm({ show: false, menu: null });
  };

  // 直近の調理実績を取り消す
  const handleCancelLastCooked = async (menuId: string, title: string) => {
    if (!confirm(`「${title}」の直近の調理実績（1回分）を取り消しますか？`)) return;

    const { data, error } = await supabase.rpc('cancel_last_cooked', { target_menu_id: menuId });

    if (error) {
      alert('実績の取り消しに失敗しました。');
    } else {
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      alert(result.message);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  // マスタ：新しい単体材料の登録
  const handleRegisterIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientName.trim()) return;

    setMasterLoading(true);
    const { error } = await supabase
      .from('ingredients')
      .insert([{ name: newIngredientName.trim() }]);

    if (!error) {
      alert(`材料「${newIngredientName}」を登録しました。`);
      setNewIngredientName('');
      setRefreshTrigger(prev => prev + 1);
    } else {
      alert('材料の登録に失敗しました。');
    }
    setMasterLoading(false);
  };

  // マスタ：新しいメニュー（および紐づく材料）の登録
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
      alert('メニューの登録に失敗しました。');
      setMasterLoading(false);
      return;
    }

    if (newMenuIngredients.length > 0) {
      const relationData = newMenuIngredients.map(ingId => ({
        menu_id: menuData.id,
        ingredient_id: ingId
      }));

      const { error: relationError } = await supabase
        .from('menu_ingredients')
        .insert(relationData);

      if (relationError) {
        alert('メニューは登録されましたが、材料の紐付けに失敗しました。');
      }
    }

    alert(`メニュー「${newMenuTitle}」のマスタ登録が完了しました！`);
    setNewMenuTitle('');
    setNewMenuIngredients([]);
    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

  // マスタ：材料の編集保存
  const handleUpdateIngredient = async (id: string) => {
    if (!editingText.trim()) return;
    const { error } = await supabase
      .from('ingredients')
      .update({ name: editingText.trim() })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      setRefreshTrigger(prev => prev + 1);
    } else {
      alert('材料名の更新に失敗しました。');
    }
  };

  // 【機能拡張】既存のメニューボタンが押されたとき、現在の紐付け材料を先読みする
  const handleStartEditMenu = async (menu: Menu) => {
    setEditingId(menu.id);
    setEditingText(menu.title);
    
    // 現在このメニューに紐づいている材料のIDリストをSupabaseから取得
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

  // 【機能拡張】編集中のメニューに対する材料チェックボックスのON/OFF切り替え
  const handleToggleEditingMenuIngredient = (id: string) => {
    setEditingMenuIngredients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 【機能拡張】マスタ：メニュー名 ＆ 使用材料 の同時アップデート保存
  const handleUpdateMenuAndIngredients = async (menuId: string) => {
    if (!editingText.trim()) return;
    setMasterLoading(true);

    // 1. メニュータイトルの更新
    const { error: menuError } = await supabase
      .from('menus')
      .update({ title: editingText.trim() })
      .eq('id', menuId);

    if (menuError) {
      alert('メニュー名の更新に失敗しました。');
      setMasterLoading(false);
      return;
    }

    // 2. 使用材料（中間テーブル）の更新。一度これまでの紐付けを全削除して、新しいリストでインサートし直す（リフレッシュ方式）
    await supabase.from('menu_ingredients').delete().eq('menu_id', menuId);

    if (editingMenuIngredients.length > 0) {
      const relationData = editingMenuIngredients.map(ingId => ({
        menu_id: menuId,
        ingredient_id: ingId
      }));

      const { error: relationError } = await supabase
        .from('menu_ingredients')
        .insert(relationData);

      if (relationError) {
        alert('メニュー名は更新されましたが、使用材料の再紐付けに失敗しました。');
        setMasterLoading(false);
        return;
      }
    }

    setEditingId(null);
    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

// 材料の削除（紐づく使用材料データも巻き込んで削除）
  const handleDeleteIngredient = async (id: string, name: string) => {
    const { data: connectedMenus, error: fetchError } = await supabase
      .from('menu_ingredients')
      .select(`
        menu_id,
        menus ( title )
      `)
      .eq('ingredient_id', id);

    if (fetchError) {
      alert('使用状況の確認に失敗しました。');
      return;
    }

    const menuTitles = connectedMenus
      ? connectedMenus.map((item: any) => item.menus?.title).filter(Boolean)
      : [];

    let confirmMessage = `材料「${name}」をマスタから完全に削除しますか？`;

    if (menuTitles.length > 0) {
      const firstMenu = menuTitles[0];
      const otherCount = menuTitles.length - 1;
      const countSuffix = otherCount > 0 ? `（他に${otherCount}つのメニュー）` : '';
      
      confirmMessage = `材料「${name}」は、メニュー「${firstMenu}」${countSuffix}で使用されています。\n\nすべてのメニューからこの材料を削除し、マスタからも完全に削除してもよろしいですか？\n※材料が未登録状態になるメニューが発生する場合があります。`;
    }

    if (!confirm(confirmMessage)) return;

    setMasterLoading(true);

    // 【修正箇所】eqの対象を 'id' から 'ingredient_id' に変更
    const { error: relError } = await supabase
      .from('menu_ingredients')
      .delete()
      .eq('ingredient_id', id);

    if (relError) {
      alert('使用材料データのクレンジングに失敗しました。');
      setMasterLoading(false);
      return;
    }

    const { error: ingError } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id);

    if (!ingError) {
      alert(`材料「${name}」の削除が完了しました。`);
      setSelectedIngredients(prev => prev.filter(item => item !== id));
      setRefreshTrigger(prev => prev + 1);
    } else {
      alert('材料マスタの削除に失敗しました。');
    }
    
    setMasterLoading(false);
  };

  // マスタ：メニューの削除
  const handleDeleteMenu = async (id: string, title: string) => {
    if (!confirm(`メニュー「${title}」を削除しますか？\n※このメニューの使用材料マスタデータも同時に削除されます。`)) return;

    await supabase.from('menu_ingredients').delete().eq('menu_id', id);
    const { error } = await supabase.from('menus').delete().eq('id', id);

    if (!error) {
      alert('メニューを削除しました。');
      handleRemoveFromKeep(id);
      setRefreshTrigger(prev => prev + 1);
    } else {
      alert('メニューの削除に失敗しました。');
    }
  };

  const handleToggleMasterIngredientSelection = (id: string) => {
    setNewMenuIngredients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ヘッダー & 画面切り替えタブ */}
        <div className="text-center py-2 space-y-4">
          <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight flex items-center justify-center gap-2">
            🍳 今日の晩ごはん
          </h1>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setViewMode('app')}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                viewMode === 'app' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              📱 メニュー選び
            </button>
            <button
              onClick={() => { setViewMode('master'); setEditingId(null); }}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                viewMode === 'master' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              ⚙️ 設定
            </button>
          </div>
        </div>

        {/* ----------------- 画面1: メインアプリ ----------------- */}
        {viewMode === 'app' && (
          <>
            {/* 材料選択エリア */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">🛒 使いたい材料</h2>
                {selectedIngredients.length > 0 && (
                  <button onClick={() => setSelectedIngredients([])} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline">
                    選択取消
                  </button>
                )}
              </div>
              
              {ingredients.length > 0 ? (
                <div className="max-h-40 overflow-y-auto pr-2 border border-dashed border-slate-100 p-2 rounded-xl bg-slate-50/50">
                  <div className="flex flex-wrap gap-2">
                    {ingredients.map(ing => {
                      const isSelected = selectedIngredients.includes(ing.id);
                      return (
                        <button
                          key={ing.id}
                          onClick={() => handleToggleIngredient(ing.id)}
                          className={`px-4 py-2 rounded-xl border text-xs md:text-sm font-medium transition-all duration-200 ${
                            isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-95' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ing.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">材料がありません。「設定」から登録してください。</p>
              )}
            </div>

            {/* メインカラム */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* おすすめリスト */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-700">
                    {selectedIngredients.length === 0 ? '📋 おすすめメニュー' : '💡 マッチしたおすすめ'}
                  </h2>
                  <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">{recommendedMenus.length}件</span>
                </div>

                <div className="max-h-[450px] overflow-y-auto pr-2 space-y-2 flex-1">
                  {loading ? (
                    <div className="text-center py-8 text-slate-400 text-sm animate-pulse">メニューを取得中...</div>
                  ) : recommendedMenus.length > 0 ? (
                    recommendedMenus.map(menu => (
                      <div key={menu.id} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50/30 rounded-xl border border-slate-100 transition">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm md:text-base">{menu.title}</span>
                            {menu.ingredient_count === 0 && (
                              <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                ⚠️材料未登録
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">おすすめスコア: {Math.round(menu.score || 0)}点</span>
                            {menu.cook_count && menu.cook_count > 0 ? (
                              <button onClick={() => handleCancelLastCooked(menu.id, menu.title)} className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline">
                                ↩ 調理取消({menu.last_cooked_at ? menu.last_cooked_at.split('T')[0] : '未設定'})
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <button onClick={() => handleAddToKeep(menu)} className="text-xs bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-lg font-bold transition-all shadow-sm">
                          🌟 候補に追加
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm text-center py-8">メニューが見つかりませんでした。</p>
                  )}
                </div>
              </div>

              {/* キープ中 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-700">📌 調理候補</h2>
                  <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">{keepList.length}件</span>
                </div>
                <div className="max-h-[450px] overflow-y-auto pr-2 space-y-2 flex-1">
                  {keepList.length > 0 ? (
                    keepList.map(menu => (
                      <div key={menu.id} className="flex items-center justify-between p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100/70">
                        <span className="font-semibold text-slate-800 text-sm md:text-base">{menu.title}</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleMadeClick(menu)} className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 rounded-lg font-bold shadow-sm transition">✅ 作った！</button>
                          <button onClick={() => handleRemoveFromKeep(menu.id)} className="text-xs bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 px-2.5 py-2 rounded-lg transition">取消</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                      <p className="text-slate-400 text-xs md:text-sm">作りたいメニューを追加してみましょう</p>
                    </div>
                  )}
                  {keepList.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-indigo-100">
                      <h3 className="text-sm font-bold text-indigo-700 mb-2">🛒 必要な材料</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {shoppingList.length > 0 ? (
                          shoppingList.map((name, index) => (
                            <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-[11px] font-bold">
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">材料情報が未登録のメニューが含まれています</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ----------------- 画面2: マスタ管理画面（登録・編集・削除） ----------------- */}
        {viewMode === 'master' && (
          <div className="space-y-8">
            {/* 上段：登録フォームエリア */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 材料単体のマスタ登録 */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
                <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">🥦 材料の追加</h2>
                <form onSubmit={handleRegisterIngredient} className="space-y-3">
                  <input
                    type="text"
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    placeholder="例: キャベツ、ひき肉"
                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:outline-indigo-600"
                    disabled={masterLoading}
                  />
                  <button type="submit" disabled={masterLoading || !newIngredientName.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold rounded-xl text-sm transition">
                    新しい材料を登録
                  </button>
                </form>
              </div>

              {/* メニューマスタ登録 */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 md:col-span-2">
                <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">🍽️ メニューの追加</h2>
                <form onSubmit={handleRegisterMenu} className="space-y-3">
                  <input
                    type="text"
                    value={newMenuTitle}
                    onChange={(e) => setNewMenuTitle(e.target.value)}
                    placeholder="例: ハンバーグ"
                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:outline-indigo-600"
                    disabled={masterLoading}
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-400 mb-1">使用する材料を選択:</span>
                    <div className="max-h-24 overflow-y-auto border border-slate-100 p-2 rounded-xl bg-slate-50/50 flex flex-wrap gap-1.5">
                      {ingredients.map(ing => {
                        const isTarget = newMenuIngredients.includes(ing.id);
                        return (
                          <button
                            type="button" key={ing.id} onClick={() => handleToggleMasterIngredientSelection(ing.id)}
                            className={`px-2 py-1 rounded border text-xs font-medium transition ${isTarget ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}
                          >
                            {ing.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button type="submit" disabled={masterLoading || !newMenuTitle.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold rounded-xl text-sm transition">
                    新しいメニューを登録
                  </button>
                </form>
              </div>
            </div>

            {/* 下段：既存データの編集・削除リストエリア */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 材料の一覧・編集・削除 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col">
                <h2 className="text-base font-bold text-slate-700 mb-3 border-b pb-2">📋 材料の編集・削除</h2>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-1.5">
                  {ingredients.map(ing => (
                    <div key={ing.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                      {editingId === ing.id ? (
                        <div className="flex gap-1.5 w-full">
                          <input
                            type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                            className="p-1 border rounded flex-1 text-sm focus:outline-indigo-600"
                          />
                          <button onClick={() => handleUpdateIngredient(ing.id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded font-bold">保存</button>
                          <button onClick={() => setEditingId(null)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">取消</button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-slate-700">{ing.name}</span>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingId(ing.id); setEditingText(ing.name); }} className="text-xs text-indigo-600 hover:underline px-1.5 py-1">編集</button>
                            <button onClick={() => handleDeleteIngredient(ing.id, ing.name)} className="text-xs text-rose-500 hover:underline px-1.5 py-1">削除</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* メニューの一覧・編集（名前＋使用材料）・削除 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col">
                <h2 className="text-base font-bold text-slate-700 mb-3 border-b pb-2">📋 メニューの編集・削除</h2>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                  {recommendedMenus.map(menu => (
                    <div key={menu.id} className="p-2.5 bg-slate-50 rounded-xl text-sm border border-slate-100">
                      {editingId === menu.id ? (
                        // 【新機能】メニュー編集モード：名前ボックスに加え、材料チェックリストが展開
                        <div className="space-y-3">
                          <div className="flex gap-1.5">
                            <input
                              type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                              className="p-1.5 border rounded-xl flex-1 text-sm focus:outline-indigo-600 bg-white font-semibold"
                            />
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold text-slate-400 mb-1">使用する材料:</span>
                            <div className="max-h-28 overflow-y-auto border border-slate-200/60 p-2 rounded-xl bg-white flex flex-wrap gap-1">
                              {ingredients.map(ing => {
                                const isChecked = editingMenuIngredients.includes(ing.id);
                                return (
                                  <button
                                    type="button" key={ing.id} onClick={() => handleToggleEditingMenuIngredient(ing.id)}
                                    className={`px-2 py-0.5 rounded text-xs font-medium border transition ${
                                      isChecked 
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {ing.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1 border-t border-dashed border-slate-200">
                            <button onClick={() => setEditingId(null)} className="text-xs bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg">キャンセル</button>
                            <button onClick={() => handleUpdateMenuAndIngredients(menu.id)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm">変更を保存</button>
                          </div>
                        </div>
                      ) : (
                        // 通常表示モード
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">{menu.title}</span>
                            {menu.ingredient_count === 0 && (
                              <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded font-bold">
                                ⚠️材料未登録
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => handleStartEditMenu(menu)} className="text-xs text-indigo-600 hover:underline px-1.5 py-1">編集</button>
                            <button onClick={() => handleDeleteMenu(menu.id, menu.title)} className="text-xs text-rose-500 hover:underline px-1.5 py-1">削除</button>
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

      {/* 調理確定モーダル */}
      {showConfirm.show && showConfirm.menu && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">調理の確定</h3>
            <p className="text-sm text-slate-600 leading-relaxed">「<span className="font-bold text-indigo-600">{showConfirm.menu.title}</span>」を作りましたか？</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowConfirm({ show: false, menu: null })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600">キャンセル</button>
              <button onClick={handleConfirmMade} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm">はい、作りました！</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}