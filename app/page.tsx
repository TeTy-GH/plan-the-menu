'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import AiMenuSuggester from '@/components/AiMenuSuggester';

console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Supabase Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)

const INGREDIENT_CATEGORIES = ['肉・魚・卵', '野菜', 'その他'] as const;
type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

type FontSizeMode = 'small' | 'medium' | 'large';

type MenuType = 'main' | 'side';

const FONT_SIZES = {
  small: {
    title: 'text-sm md:text-base',
    btn: 'text-xs md:text-sm px-3 py-1.5',
    score: 'text-[11px]',
    category: 'text-xs',
    sectionTitle: 'text-lg',
    badge: 'text-[9px]',
    input: 'text-sm p-1.5',
    masterText: 'text-sm',
    masterBtn: 'text-xs px-1.5 py-0.5',
  },
  medium: {
    title: 'text-lg md:text-xl font-black',
    btn: 'text-base md:text-lg px-4 py-2',
    score: 'text-sm md:text-base',
    category: 'text-base md:text-lg',
    sectionTitle: 'text-2xl',
    badge: 'text-xs',
    input: 'text-base p-2.5',
    masterText: 'text-base md:text-lg font-bold',
    masterBtn: 'text-sm px-2.5 py-1.5',
  },
  large: {
    title: 'text-2xl md:text-3xl font-black',
    btn: 'text-xl md:text-2xl px-5 py-3',
    score: 'text-lg md:text-xl',
    category: 'text-xl md:text-2xl',
    sectionTitle: 'text-3xl',
    badge: 'text-sm',
    input: 'text-xl p-3.5',
    masterText: 'text-xl md:text-2xl font-black',
    masterBtn: 'text-base px-3.5 py-2',
  }
};

interface Ingredient {
  id: string; 
  name: string;
  category: IngredientCategory;
}

interface Menu {
  id: string;
  title: string;
  menu_type: MenuType;
  suggestedMenu?: string;
  score?: number;
  cook_count?: number;
  ingredient_count?: number;
  last_cooked_at?: string | null;
  prev_cooked_at?: string | null;
  is_cancelled?: boolean;
}

interface ModalConfig {
  show: boolean;
  // 🟢 info（情報表示用）を追加
  type: 'made' | 'cancel_cook' | 'delete_ingredient' | 'delete_menu' | 'info' | null;
  title: string;
  message: string;
  data: any;
}

interface MenuListItemProps { 
  menu: any; 
  isEditing: boolean;
} 

const MENU_TYPES: { id: MenuType; label: string }[] = [
  { id: 'main', label: '主菜' },
  { id: 'side', label: '副菜' }
];

function BoundaryPin({ isEditing }: { isEditing: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  return <div ref={ref} className="h-0 w-full" />;
}



export default function Home() {
  const [viewMode, setViewMode] = useState<'main' | 'master' | 'setting'>('main');
  const [fontSize, setFontSize] = useState<FontSizeMode>('small');
  const [sortMode, setSortMode] = useState<'score' | 'history'>('score');

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [recommendedMenus, setRecommendedMenus] = useState<Menu[]>([]);
  const [keepList, setKeepList] = useState<Menu[]>([]);

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
  const [newIngredientCategory, setNewIngredientCategory] = useState<IngredientCategory>('その他');
  const [newMenuType, setNewMenuType] = useState<MenuType>('main');
  const [masterLoading, setMasterLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingIngredientCategory, setEditingIngredientCategory] = useState<IngredientCategory>('その他');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState<string[]>([]);
  const [editingMenuType, setEditingMenuType] = useState<MenuType>('main');
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);
  
  const [aiMenu, setAiMenu] = useState<Menu | null>(null);
  //const [aiMenuTitle, setAiMenuTitle] = useState("");
  const [aiMenuTitle, setAiMenuTitle] = useState<string | null>(null); // 最初は null にする
  const [selectedMenuType, setSelectedMenuType] = useState<MenuType>('main');
  const [selectedManageMenuType, setSelectedManageMenuType] = useState<MenuType>('main');

  const aiSuggesterRef = useRef<{ handleAiSuggest: () => void }>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
          category: (INGREDIENT_CATEGORIES.includes(item.category as any) ? item.category : 'その他') as IngredientCategory
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

  const handleToggleKeep = (menu: Menu) => {
    if (keepList.some(item => item.id === menu.id)) {
      setKeepList(keepList.filter(item => item.id !== menu.id));
    } else {
      setKeepList([...keepList, menu]);
    }
  };

  const handleRemoveFromKeep = (id: string) => {
    setKeepList(keepList.filter(item => item.id !== id));
  };

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
      const today = new Date().toISOString().split('T')[0];

      // 🟢 変更箇所：すでに今日作った場合の処理をモーダルに置き換え
      if (currentLast === today) {
        handleRemoveFromKeep(menu.id);
        
        // infoタイプのモーダルを表示して、関数をここで終了（return）する
        setModal({
          show: true,
          type: 'info',
          title: 'お知らせ',
          message: `「${menu.title}」は本日すでに調理済みとして記録されています。\n重複を防ぐためカウントの更新をスキップしました。`,
          data: null
        });
        return; 
      }

      // 未記録の場合のみ更新
      const { error } = await supabase
        .from('menus')
        .update({ 
          cook_count: currentCount + 1,
          prev_cooked_at: currentLast,
          last_cooked_at: today,
          is_cancelled: false
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
    const trimmedName = newIngredientName.trim(); // 共通で使えるように変数化
    if (!trimmedName) return;

    setMasterLoading(true);

    // 🟢 1. 食材名の重複チェック
    const { data: existingIng } = await supabase
      .from('ingredients')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle(); // データが0件でもエラーにしないメソッド

    if (existingIng) {
      setMasterLoading(false);
      setModal({
        show: true,
        type: 'info',
        title: '登録エラー',
        message: `食材「${trimmedName}」はすでに登録されています。`,
        data: null
      });
      return; // ここで処理を終了し、インサートを行わない
    }

    // 重複がなければ登録
    const { error } = await supabase
      .from('ingredients')
      .insert([{ name: trimmedName, category: newIngredientCategory }]);

    if (!error) {
      setNewIngredientName('');
      setNewIngredientCategory('その他');
      setRefreshTrigger(prev => prev + 1);
    }
    setMasterLoading(false);
  };

  const handleRegisterMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newMenuTitle.trim(); // 共通で使えるように変数化
    if (!trimmedTitle) return;

    setMasterLoading(true);

    // 🟢 2. メニュー名の重複チェック
    const { data: existingMenu } = await supabase
      .from('menus')
      .select('id')
      .eq('title', trimmedTitle)
      .maybeSingle();

    if (existingMenu) {
      setMasterLoading(false);
      setModal({
        show: true,
        type: 'info',
        title: '登録エラー',
        message: `メニュー「${trimmedTitle}」はすでに登録されています。`,
        data: null
      });
      return; // ここで処理を終了し、インサートを行わない
    }

    // 重複がなければ登録
    const { data: menuData, error: menuError } = await supabase
      .from('menus')
      .insert([{ title: trimmedTitle, cook_count: 0, menu_type: newMenuType }])
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
    setNewMenuType('main');
    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

  const handleUpdateIngredient = async (id: string) => {
    if (!editingText.trim()) return;
    const { error } = await supabase
      .from('ingredients')
      .update({ name: editingText.trim(), category: editingIngredientCategory })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleStartEditMenu = async (menu: Menu) => {
    setEditingId(menu.id);
    setEditingText(menu.title);
    
    setEditingMenuType(menu.menu_type || 'main');

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
      .update({ 
        title: editingText.trim(),
        menu_type: editingMenuType 
      })
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

  // recommendedMenus が更新されるたびに並び替えを実行
  const sortedMenus = [...recommendedMenus].filter(menu => {
    // 1. メニュータイプの絞り込みを追加 (データが未設定の場合は 'main' として扱う)
    const currentType = menu.menu_type || 'main';
    if (currentType !== selectedMenuType) {
      return false;
    }

    // 2. 履歴モードの時だけ、last_cooked_at が null のものを除外する
    if (sortMode === 'history') {
      return menu.last_cooked_at !== null && menu.last_cooked_at !== undefined;
    }
    
    // おすすめモードの時はすべて表示する
    return true;
  })
  .sort((a, b) => {
    if (sortMode === 'score') {
      return (b.score || 0) - (a.score || 0);
    } else {
      const dateA = a.last_cooked_at ? new Date(a.last_cooked_at).getTime() : 0;
      const dateB = b.last_cooked_at ? new Date(b.last_cooked_at).getTime() : 0;
      return dateB - dateA;
    }
  });

// 🟢 変更点1: 背景を夕焼けをイメージした美しいグラデーション（または画像）に変更
  // ※ もし画像にしたい場合は bg-gradient-to-b ... の代わりに bg-[url('/sunset.jpg')] bg-cover bg-center bg-no-repeat bg-fixed にします
  return (
    <main className="min-h-screen relative text-slate-800 dark:text-slate-100">
        <div className="fixed inset-0 -z-50 w-full h-full">
          {/* 実際の画像 */}
          <img 
            src="/images/Gemini_Generated_Image_caadsjcaadsjcaad.png" 
            alt="background" 
            className="w-full h-full object-cover"
          />
          {/* 暗いフィルター（文字の視認性を保つためのオーバーレイ） */}
          <div className="absolute inset-0 bg-white/30 dark:bg-zinc-950/40 backdrop-blur-[2px]" />
        </div>
    
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ヘッダー & 画面切り替えタブ */}
        {/* 🟢 変更点2: 背景がカラフルになったので、ヘッダーの文字を白（または高コントラスト）に固定して見やすく */}
        <div className="text-center py-2 space-y-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            🍳 今日の晩ごはん
          </h1>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setViewMode('main')}
              className={`flex items-center justify-center whitespace-nowrap px-5 py-2 rounded-xl font-bold transition-all ${currentStyles.masterText} ${
                viewMode === 'main' 
                  ? 'bg-white text-indigo-900 shadow-lg scale-105' 
                  : 'bg-white/20 text-white backdrop-blur-sm border border-white/30 hover:bg-white/30'
              }`}
            >
              📋 メニュー選び
            </button>
            <button
              onClick={() => setViewMode('master')}
              className={`flex items-center justify-center whitespace-nowrap px-5 py-2 rounded-xl font-bold transition-all ${currentStyles.masterText} ${
                viewMode === 'master' 
                  ? 'bg-white text-indigo-900 shadow-lg scale-105' 
                  : 'bg-white/20 text-white backdrop-blur-sm border border-white/30 hover:bg-white/30'
              }`}
            >
              ✏️ 登録・編集
            </button>
            <button
              onClick={() => { setViewMode('setting'); setEditingId(null); }}
              className={`flex items-center justify-center whitespace-nowrap px-5 py-2 rounded-xl font-bold transition-all ${currentStyles.masterText} ${
                viewMode === 'setting' 
                  ? 'bg-white text-indigo-900 shadow-lg scale-105' 
                  : 'bg-white/20 text-white backdrop-blur-sm border border-white/30 hover:bg-white/30'
              }`}
            >
              ⚙️ 設定
            </button>
          </div>
        </div>

        {/* ----------------- 画面1: メインアプリ ----------------- */}
        {viewMode === 'main' && (
          <>
            {/* 使いたい食材 */}
            <div className="bg-white/70 dark:bg-zinc-950/70 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white flex items-center gap-2`}>🥦 使いたい食材</h2>
                {selectedIngredients.length > 0 && (
                  <button onClick={() => setSelectedIngredients([])} className={`text-indigo-600 dark:text-white hover:text-indigo-800 dark:hover:underline font-bold underline ${currentStyles.score}`}>
                    ＜選択クリア＞
                  </button>
                )}
              </div>
              
              {ingredients.length > 0 ? (
                <div className="pb-10 max-h-72 overflow-y-auto pr-2 pl-4 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-100/10 shadow-inner">
                  {INGREDIENT_CATEGORIES.map(category => {
                    const filteredIngredients = ingredients.filter(ing => ing.category === category);
                    if (filteredIngredients.length === 0) return null;
                    
                    return (
                      <div key={category} className="space-y-1.5">
                        <span className={`pt-4 block font-black text-indigo-600 dark:text-yellow-600 tracking-wider ${currentStyles.category}`}>
                          ー {category} －
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
                                    : 'bg-white dark:bg-zinc-950 text-slate-700 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
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
              <div className="bg-white dark:bg-zinc-950/80 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-stone-100/10 flex flex-col">
<div className="flex justify-between items-center mb-4 gap-2">
  <h2 className={`whitespace-nowrap ${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white`}>
    {selectedIngredients.length === 0 ? '📋 おすすめメニュー' : '📋 おすすめメニュー（食材選択中）'}
  </h2>
  
  {/* 🟢 再提案ボタンを「おすすめメニュー」の右に右寄せで配置 */}
  {aiMenuTitle !== null && (
    <button
      onClick={() => aiSuggesterRef.current?.handleAiSuggest()}
      disabled={aiLoading}
      className={`${currentStyles.masterText} py-[0.4em] px-[0.8em] rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-transparent dark:border-zinc-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
    >
      {aiLoading ? '🔄 考案中...' : '🔄 再提案'}
    </button>
  )}
</div>

<AiMenuSuggester 
  ref={aiSuggesterRef} // 🟢 子の関数を呼ぶためのref
  selectedIngredients={selectedIngredients}
  aiMenuTitle={aiMenuTitle} 
  onSuggestionReceived={(newMenu) => {
    console.log("親で受信！:", newMenu.title);
    setAiMenuTitle(newMenu.title);
  }}
  currentStyles={currentStyles}
  onLoadingChange={setAiLoading} // 🟢 子のローディング状態を親と同期
/>
                  <div className="flex items-center gap-5">
                    {/* 🟢 追加：メニュータイプ（主菜・副菜）切り替えボタン */}
                    <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 text-stone-900 dark:text-white">
                      <button 
                        onClick={() => setSelectedMenuType('main')} 
                        className={`whitespace-nowrap px-2 py-1 rounded ${currentStyles.score} ${selectedMenuType === 'main' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                      >
                        🍗 主菜
                      </button>
                      <button 
                        onClick={() => setSelectedMenuType('side')} 
                        className={`whitespace-nowrap px-2 py-1 rounded ${currentStyles.score} ${selectedMenuType === 'side' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                      >
                        🥗 副菜
                      </button>
                    </div>

                    {/* 既存の並び替えボタン */}
                    <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 text-stone-900 dark:text-white">
                      <button onClick={() => setSortMode('score')} className={`whitespace-nowrap px-2 py-1 rounded ${currentStyles.score} ${sortMode === 'score' ? ' text-black dark:text-white bg-white dark:bg-stone-950 shadow' : 'text-slate-500'}`}>おすすめ</button>
                      <button onClick={() => setSortMode('history')} className={`whitespace-nowrap px-2 py-1 rounded ${currentStyles.score} ${sortMode === 'history' ? ' text-black dark:text-white bg-white dark:bg-stone-950 shadow' : 'text-slate-500'}`}>調理履歴</button>
                    </div>
                  </div>
                
                <div className="pb-10 overflow-y-auto max-h-130 p-4 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-100/10 shadow-inner space-y-3">
                  {loading ? (
                    <div className={`text-center py-8 text-slate-400 dark:text-white animate-pulse ${currentStyles.masterText}`}>メニューを取得中...</div>
                  ) : sortedMenus.length > 0 ? (
                    sortedMenus.map(menu => {
                      const isAlreadyKept = keepList.some(item => item.id === menu.id);

                      return (
                        <div key={menu.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-950 hover:bg-indigo-50/30 dark:hover:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-800 transition">
                          <div className="flex flex-col gap-1 flex-1 pr-2 pl-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`font-bold text-slate-800 dark:text-white ${currentStyles.title}`}>{menu.title}</span>
                              {menu.ingredient_count === 0 && (
                                <span className={`bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-white border border-rose-200 dark:border-rose-500 px-1.5 py-0.5 rounded font-bold animate-pulse ${currentStyles.badge}`}>
                                  ⚠️食材未登録
                                </span>
                              )}
                            </div>

                            {sortMode === 'score' ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-slate-500 dark:text-zinc-400 font-bold ${currentStyles.score}`}>
                                  おすすめスコア: {Math.round(menu.score || 0)}点
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-slate-500 dark:text-zinc-400 font-bold ${currentStyles.score}`}>
                                  最終調理日: {menu.last_cooked_at ? new Date(menu.last_cooked_at).toLocaleDateString() : '未調理'}
                                </span>
                                {menu.cook_count && menu.cook_count > 0 && !menu.is_cancelled ? (
                                  <button onClick={() => triggerCancelCookModal(menu.id, menu.title)} className={`text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:underline font-black ${currentStyles.score}`}>
                                    ↩ 調理取消
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </div>
                          
                          <button 
                            onClick={() => handleToggleKeep(menu)} 
                            className={`rounded-lg font-bold transition-all shadow-sm shrink-0 border ${currentStyles.masterBtn} ${
                              isAlreadyKept
                                ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-white dark:text-black dark:border-white shadow-md scale-95' 
                                : 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-white dark:hover:text-black'
                            }`}
                          >
                            {isAlreadyKept ? '📌 追加済み' : '📌 候補'}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className={`text-slate-400 dark:text-white text-center py-8 ${currentStyles.masterText}`}>メニューが見つかりませんでした。</p>
                  )}
                </div>
              </div>

              {/* 調理候補 */}
              <div className="bg-white dark:bg-zinc-950/80 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-stone-100/10 flex flex-col">
                <div className="flex items-center gap-2 mb-2 border-slate-100 dark:border-zinc-800 pb-3">
                  <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white`}>
                    📌 調理候補
                  </h2>
                  <span className={`bg-indigo-100 dark:bg-zinc-800 text-indigo-700 dark:text-white font-bold px-2 py-0.5 rounded-full ${currentStyles.badge}`}>{keepList.length}件</span>
                </div>
                <div className="pb-10 p-4 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-zinc-800 shadow-inner space-y-3">
                  {keepList.length > 0 ? (
                    keepList.map(menu => (
                      <div key={menu.id} className="flex items-center justify-between p-3 bg-indigo-50/40 dark:bg-zinc-950 rounded-xl border border-indigo-100/70 dark:border-zinc-800">
                        <span className={`font-bold text-slate-800 dark:text-white flex-1 pr-2 ${currentStyles.title}`}>{menu.title}</span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => triggerMadeModal(menu)} className={`bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg font-bold shadow-sm transition ${currentStyles.masterBtn}`}>✅ 作った！</button>
                          <button onClick={() => handleRemoveFromKeep(menu.id)} className={`bg-white dark:bg-zinc-900 text-slate-500 dark:text-white border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition ${currentStyles.masterBtn}`}>キャンセル</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-xl bg-slate-50/30 dark:bg-stone-900">
                      <p className={`text-slate-400 dark:text-white ${currentStyles.masterText}`}>作りたいメニューを追加してみましょう</p>
                    </div>
                  )}
                  {keepList.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-indigo-100 dark:border-zinc-800 space-y-3">
                      <h3 className={`font-bold text-indigo-700 dark:text-white ${currentStyles.masterText}`}>
                        🛒 必要な食材
                      </h3>
                      
                      {shoppingList.length > 0 ? (
                        <div className="space-y-2 pr-1">
                          {INGREDIENT_CATEGORIES.map(category => {
                            const filteredList = shoppingList.filter(ing => ing.category === category);
                            if (filteredList.length === 0) return null;

                            return (
                              <div key={category} className="space-y-1">
                                <span className={`block font-black text-indigo-600 dark:text-yellow-600 pt-1 pb-1 ${currentStyles.category}`}>
                                  ー {category} ー
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {filteredList.map(ing => (
                                    <span key={ing.id} className={`bg-indigo-100 dark:bg-zinc-950 text-indigo-800 dark:text-white rounded-lg font-bold border border-slate-200 dark:border-zinc-700 ${currentStyles.btn}`}>
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



        {/* ----------------- 画面2: マスタ管理画面 ----------------- */}
        {viewMode === 'master' && (
          <div className="space-y-8">
            
            {/* 登録フォームエリア */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 食材単体のマスタ登録 */}
              <div className="bg-white dark:bg-zinc-950/70 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2`}>
                  🥦 食材の追加
                </h2>
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
                      onChange={(e) => setNewIngredientCategory(e.target.value as IngredientCategory)}
                      className={`w-full border rounded-xl focus:outline-blue-500 transition cursor-pointer font-black ${inputGlobalStyle} ${currentStyles.input}`}
                      disabled={masterLoading}
                    >
                      {INGREDIENT_CATEGORIES.map(cat => (
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

              {/* メニューマスタ登録 */}
              <div className="bg-white dark:bg-zinc-950/70 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 md:col-span-2">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2`}>
                  🍽️ メニューの追加
                </h2>
                <form onSubmit={handleRegisterMenu} className="space-y-3">
                  <input
                    type="text"
                    value={newMenuTitle}
                    onChange={(e) => setNewMenuTitle(e.target.value)}
                    placeholder="例: ハンバーグ"
                    className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                    disabled={masterLoading}
                  />

                  {/* 🟢 追加：新規メニューのタイプ選択 */}
                  <div>
                    <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>
                      メニューのカテゴリ：
                    </span>
                    <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 text-stone-900 dark:text-white w-fit">
                      <button
                        type="button" // ⚠️ フォーム送信を防ぐために必須
                        onClick={() => setNewMenuType('main')}
                        className={`px-3 py-1 rounded ${currentStyles.score} ${newMenuType === 'main' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                      >
                        🍗 主菜
                      </button>
                      <button
                        type="button" // ⚠️ フォーム送信を防ぐために必須
                        onClick={() => setNewMenuType('side')}
                        className={`px-3 py-1 rounded ${currentStyles.score} ${newMenuType === 'side' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                      >
                        🥗 副菜
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>
                      使用する食材を選択：
                    </span>
                    <div className="pb-10 max-h-48 overflow-y-auto border border-slate-100 dark:border-stone-100/10 p-2 rounded-xl bg-slate-50/50 dark:bg-stone-900 space-y-2">
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
                                const isTarget = newMenuIngredients.includes(ing.id);
                                return (
                                  <button
                                    type="button" key={ing.id} onClick={() => handleToggleMasterIngredientSelection(ing.id)}
                                    className={`rounded border font-bold transition ${currentStyles.masterBtn} ${isTarget ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600' : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
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
              <div className="bg-white dark:bg-zinc-950/88 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 flex flex-col">
                <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 border-b dark:border-zinc-800 pb-2`}>
                  🥦 食材の編集・削除
                </h2>
                <div className="max-h-100 overflow-y-auto pr-2 space-y-3">
                  {INGREDIENT_CATEGORIES.map(category => {
                    const filtered = ingredients.filter(ing => ing.category === category);
                    if (filtered.length === 0) return null;
                    return (
                      <div key={category} className="space-y-1">
                        <span className={`block font-black text-indigo-600 dark:text-yellow-600 ${currentStyles.category}`}>
                          ー {category} ー
                        </span>
                        <div className="space-y-1">
                          {filtered.map(ing => (
                            <div key={ing.id} className="relative p-2 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                              <div className={`
                                transition-all duration-500 ease-in-out overflow-hidden
                                ${editingId === ing.id 
                                  ? 'opacity-100 max-h-[500px] translate-y-0 pointer-events-auto' 
                                  : 'opacity-0 max-h-0 -translate-y-2 pointer-events-none'
                                }
                              `}>
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                                    className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                                  />
                                  <div className="flex items-center justify-between gap-2">
                                    <select
                                      value={editingIngredientCategory}
                                      onChange={(e) => setEditingIngredientCategory(e.target.value as IngredientCategory)}
                                      className={`border rounded-xl focus:outline-blue-500 transition cursor-pointer font-black ${inputGlobalStyle} ${currentStyles.input}`}
                                    >
                                      {INGREDIENT_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} className="font-black">
                                          {cat}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex gap-2">
                                      <button onClick={() => setEditingId(null)} className={`bg-slate-200 text-slate-600 rounded font-bold ${currentStyles.masterBtn}`}>キャンセル</button>
                                      <button onClick={() => handleUpdateIngredient(ing.id)} className={`bg-blue-600 hover:bg-blue-700 text-white rounded font-black ${currentStyles.masterBtn}`}>保存</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className={`
                                transition-all duration-500 ease-in-out
                                ${editingId === ing.id 
                                  ? 'opacity-0 pointer-events-none' 
                                  : 'opacity-100 pointer-events-auto'
                                }
                              `}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className={`font-bold text-slate-700 dark:text-white ${currentStyles.masterText}`}>{ing.name}</span>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button onClick={() => { setEditingId(ing.id); setEditingText(ing.name); setEditingIngredientCategory(ing.category); }} className={`text-indigo-600 dark:text-white hover:underline font-bold dark:bg-zinc-800 dark:rounded ${currentStyles.masterBtn}`}>編集</button>
                                    <button onClick={() => triggerDeleteIngredientModal(ing.id, ing.name)} className={`text-rose-500 dark:text-rose-400 hover:underline font-bold dark:bg-zinc-800 dark:rounded ${currentStyles.masterBtn}`}>削除</button>
                                  </div>
                                </div>
                              </div>
                              <BoundaryPin isEditing={editingId === ing.id} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* メニューの一覧・編集・削除 */}
              <div className="bg-white dark:bg-zinc-950/88 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 flex flex-col">
                {/* タイトルと切り替えボタンを横並びにするコンテナ */}
                <div className="flex justify-between items-center mb-3 border-b dark:border-zinc-800 pb-2 flex-wrap gap-2">
                  <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white`}>
                    📋 メニューの編集・削除
                  </h2>
                  
                  {/* 🟢 追加：編集・削除リスト用のメニュータイプ（主菜・副菜）切り替えボタン */}
                  <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 text-stone-900 dark:text-white">
                    <button 
                      onClick={() => setSelectedManageMenuType('main')} 
                      className={`px-2 py-1 rounded ${currentStyles.score} ${selectedManageMenuType === 'main' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                    >
                      🍗 主菜
                    </button>
                    <button 
                      onClick={() => setSelectedManageMenuType('side')} 
                      className={`px-2 py-1 rounded ${currentStyles.score} ${selectedManageMenuType === 'side' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                    >
                      🥗 副菜
                    </button>
                  </div>
                </div>

                <div className="max-h-100 overflow-y-auto pr-2 space-y-2">
                  {/* 🟢 recommendedMenus の直後に .filter を追加して選択中のタイプだけに絞り込む */}
                  {recommendedMenus
                    .filter(menu => (menu.menu_type || 'main') === selectedManageMenuType)
                    .map((menu) => {
                      const isEditing = editingId === menu.id;

                      return (
                        <div key={menu.id} className="relative p-2 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">

                          {/* 編集モードの表示レイアウト */}
                          <div className={`
                            transition-all duration-500 ease-in-out overflow-hidden
                            ${isEditing 
                              ? 'opacity-100 max-h-[1000px] translate-y-0 pointer-events-auto' 
                              : 'opacity-0 max-h-0 -translate-y-2 pointer-events-none'
                            }
                          `}>
                            <div className="flex flex-col gap-2 mb-2">
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className={`w-full border rounded-xl focus:outline-blue-500 transition ${inputGlobalStyle} ${currentStyles.input}`}
                              />
                              
                              {/* 編集中のメニュータイプ切り替えトグル */}
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-slate-400 dark:text-white ${currentStyles.score}`}>
                                  カテゴリ：
                                </span>
                                <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 text-stone-900 dark:text-white">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMenuType('main')}
                                    className={`px-2 py-0.5 rounded text-xs ${currentStyles.score} ${editingMenuType === 'main' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                                  >
                                    🍗 主菜
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingMenuType('side')}
                                    className={`px-2 py-0.5 rounded text-xs ${currentStyles.score} ${editingMenuType === 'side' ? 'text-black dark:text-white bg-white dark:bg-zinc-950 shadow' : 'text-slate-500'}`}
                                  >
                                    🥗 副菜
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div>
                              <span className={`block font-bold text-slate-400 dark:text-white mb-1 ${currentStyles.score}`}>
                                使用する食材：
                              </span>
                              <div className="max-h-48 overflow-y-auto border border-slate-200/60 dark:border-stone-100/10 p-2 rounded-xl bg-white dark:bg-stone-900 space-y-2">
                                {INGREDIENT_CATEGORIES.map((category) => {
                                  const filtered = ingredients.filter((ing) => ing.category === category);
                                  if (filtered.length === 0) return null;
                                  return (
                                    <div key={category} className="space-y-0.5">
                                      <span className={`block font-black text-indigo-600 dark:text-yellow-600 ${currentStyles.score}`}>
                                        ー {category} ー
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {filtered.map((ing) => {
                                          const isChecked = editingMenuIngredients.includes(ing.id);
                                          return (
                                            <button
                                              type="button"
                                              key={ing.id}
                                              onClick={() => handleToggleEditingMenuIngredient(ing.id)}
                                              className={`rounded font-bold border transition ${currentStyles.masterBtn} ${
                                                isChecked
                                                  ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                                                  : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-white border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
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
                            <div className="flex justify-end gap-2 pb-2 mt-2">
                              <button onClick={() => setEditingId(null)} className={`bg-slate-200 text-slate-600 rounded font-bold ${currentStyles.masterBtn}`}>キャンセル</button>
                              <button onClick={() => handleUpdateMenuAndIngredients(menu.id)} className={`bg-blue-600 hover:bg-blue-700 text-white rounded font-black shadow-sm ${currentStyles.masterBtn}`}>保存</button>
                            </div>
                            <BoundaryPin isEditing={isEditing} />
                          </div>

                          {/* 通常モード（一覧表示）のレイアウト */}
                          <div className={`
                            transition-all duration-500 ease-in-out overflow-hidden
                            ${isEditing 
                              ? 'opacity-0 max-h-0 -translate-y-2 pointer-events-none' 
                              : 'opacity-100 max-h-[200px] translate-y-0 pointer-events-auto'
                            }
                          `}>
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-2">
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
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}



        {/* ----------------- 画面3: マスタ管理・設定画面 ----------------- */}
        {viewMode === 'setting' && (
          <div className="space-y-8">
            
            {/* 文字サイズ変更 設定カード */}
            <div className="bg-white dark:bg-zinc-950/70 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
              <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2`}>
                🔎 文字サイズ
              </h2>
              <div className="flex flex-wrap gap-3 max-w-md">
                {(['small', 'medium', 'large'] as const).map((size) => {
                  const label = size === 'small' ? '小（標準）' : size === 'medium' ? '中（1.5倍）' : '大（2倍）';
                  return (
                    <button
                      key={size}
                      onClick={() => handleFontSizeChange(size)}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold border transition-all ${currentStyles.masterText} ${
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
          </div>
        )}
      </div>

      {/* 統合型アプリ内確認モーダル */}
      {modal.show && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl max-w-xl w-full shadow-xl border border-slate-100 dark:border-zinc-800 space-y-4">
            <h3 className={`${currentStyles.sectionTitle} font-bold text-slate-900 dark:text-white`}>
              {modal.title}
            </h3>
            <p className={`text-slate-600 dark:text-white leading-relaxed whitespace-pre-line ${currentStyles.masterText}`}>
              {modal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              {/* 🟢 変更箇所：infoタイプの場合は「確認」ボタン1つだけを表示 */}
              {modal.type === 'info' ? (
                <button 
                  onClick={() => setModal({ show: false, type: null, title: '', message: '', data: null })} 
                  className={`bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm ${currentStyles.masterBtn}`}
                >
                  確認
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setModal({ show: false, type: null, title: '', message: '', data: null })} 
                    className={`bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-slate-600 dark:text-white ${currentStyles.masterBtn}`}
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleModalConfirm} 
                    className={`text-white rounded-xl font-black shadow-sm ${currentStyles.masterBtn} ${
                      modal.type?.startsWith('delete') ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700'
                    }`}
                  >
                    はい
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}