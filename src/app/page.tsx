'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import AiMenuSuggester from '@/components/AiMenuSuggester';
import React from 'react';
import { INGREDIENT_CATEGORIES } from '@/constants';
import { IngredientModal } from '@/components/modals/IngredientModal';
import { MenuModal } from '@/components/modals/MenuModal';
import { SettingDrawer } from '@/components/SettingDrawer';

console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Supabase Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)

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
  memo: string;
}

interface ModalConfig {
  show: boolean;
  type: 'info' | 'confirm' | null;
  title: string;
  message: string;
  onConfirm?: () => void | Promise<void>;
}

interface MenuListItemProps { 
  menu: any; 
  isEditing: boolean;
} 

const MENU_TYPES: { id: MenuType; label: string }[] = [
  { id: 'main', label: '主菜' },
  { id: 'side', label: '副菜' }
];














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
    onConfirm: undefined
  });

  const [loading, setLoading] = useState(false);

  const [newMenuTitle, setNewMenuTitle] = useState('');
  const [newMenuIngredients, setNewMenuIngredients] = useState<string[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientCategory, setNewIngredientCategory] = useState<IngredientCategory>('その他');
  const [newMenuType, setNewMenuType] = useState<MenuType>('main');
  const [masterLoading, setMasterLoading] = useState(false);
  const [newMenuMemo, setNewMenuMemo] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingIngredientCategory, setEditingIngredientCategory] = useState<IngredientCategory>('その他');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState<string[]>([]);
  const [editingMenuType, setEditingMenuType] = useState<'main' | 'side'>('main');
  const [editingMemo, setEditingMemo] = useState('');
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);
  
  const [aiMenu, setAiMenu] = useState<Menu | null>(null);
  //const [aiMenuTitle, setAiMenuTitle] = useState("");
  const [aiMenuTitle, setAiMenuTitle] = useState<string | null>(null); // 最初は null にする
  const [selectedMenuType, setSelectedMenuType] = useState<MenuType>('main');
  const [selectedManageMenuType, setSelectedManageMenuType] = useState<MenuType>('main');

  const aiSuggesterRef = useRef<{ handleAiSuggest: () => void }>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [newMemoTab, setNewMemoTab] = useState<'write' | 'preview'>('write');
  const [editingMemoTab, setEditingMemoTab] = useState<'write' | 'preview'>('write');

  const [viewingMemoMenu, setViewingMemoMenu] = useState<Menu | null>(null);

  // 🔮 AIレシピ作成機能のための状態管理（State）
  const [aiCount, setAiCount] = useState<number>(0); // おかわりガチャの回数カウント
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false); // 通信中（レシピ作成中...）のフラグ
  const [extractedRecipe, setExtractedRecipe] = useState<string | null>(null); // AIが生成したレシピの一時保持
  
  const [isIngModalOpen, setIsIngModalOpen] = useState(false);
  const [ingModalMode, setIngModalMode] = useState<'add' | 'edit'>('add'); // 👈 モード変数を追加！
  const [selectedIngForModal, setSelectedIngForModal] = useState<any | null>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef<boolean>(false);
  const startY = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuModalMode, setMenuModalMode] = useState<'add' | 'edit'>('add');
  const [selectedMenuForModal, setSelectedMenuForModal] = useState<any>(null);
  const [editingMenuTitle, setEditingMenuTitle] = useState('');

  const currentStyles = FONT_SIZES[fontSize];
  const inputGlobalStyle = "bg-gray-300 text-black font-black placeholder-zinc-500 border-slate-300";
  
  const [isSettingOpen, setIsSettingOpen] = useState(false);

  // 2. 「新規追加」ボタンが押された時の処理
  const handleOpenAddIngredient = () => {
    setIngModalMode('add');        // 👈 モードを明示的に 'add' に！
    setSelectedIngForModal(null);
    setEditingText('');
    setEditingIngredientCategory(INGREDIENT_CATEGORIES[0]);
    setIsIngModalOpen(true);
  };
    
  // メニュー新規追加用（もしどこかに「＋」ボタンを作る場合用）
  const handleOpenAddMenu = () => {
    setMenuModalMode('add');
    setSelectedMenuForModal(null);
    setEditingMenuTitle('');
    setEditingMenuType('main');
    setEditingMenuIngredients([]);
    setEditingMemo('');
    setIsMenuModalOpen(true);
  };

  // メニュー編集用（長押しなどで呼び出す用）
  const handleOpenEditMenu = async (menu: any) => {
    setMenuModalMode('edit');
    setSelectedMenuForModal(menu);
    setEditingMenuTitle(menu.title);
    setEditingMemo(menu.memo || '');

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
    setIsMenuModalOpen(true);
  };

  // 🟢 開始処理
  const handleIngredientStart = (
    e: React.TouchEvent | React.MouseEvent,
    ingredient: any,
    onEdit: (target: any) => void
  ) => {
    isLongPressActive.current = false;
    isScrolling.current = false; // 押し始めた時は一回リセット

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startY.current = clientY;

    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      // スクロール中なら長押しモーダルは開かない
      if (isScrolling.current) return;
      isLongPressActive.current = true;
      onEdit(ingredient);
    }, 600);
  };

  // 🟢 動いた時の処理
  const handleIngredientMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!longPressTimer.current) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // 10px以上動いたら「これはスクロール操作だ」と判定
    if (Math.abs(clientY - startY.current) > 10) {
      isScrolling.current = true; // 🌟 スクロール中フラグを立てる
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  // 💡 長押し＆スクロール誤爆防止を両立した決定版センサー
  const handleIngredientLongPress = (
    ingredient: any,
    onToggle: () => void,
    onEdit: (targetIng: any) => void
  ) => {  
    let timer: NodeJS.Timeout | null = null;
    let isLongPress = false;
    let startX = 0;
    let startY = 0;
    let isScrolled = false; // スクロールしたかどうかのフラグ

    // ーーー スマホ（タッチパネル）用の処理 ーーー
    const handleTouchStart = (e: React.TouchEvent) => {
      isLongPress = false;
      isScrolled = false;
      // タッチした位置を記録（スクロール判定用）
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      timer = setTimeout(() => {
        isLongPress = true;
        onEdit(ingredient);
      }, 600); // 0.6秒長押しで編集
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!timer) return;
      
      // 指が少しでも動いたら（10ピクセル以上）、それは「スクロール」とみなす
      const moveX = Math.abs(e.touches[0].clientX - startX);
      const moveY = Math.abs(e.touches[0].clientY - startY);
      if (moveX > 10 || moveY > 10) {
        isScrolled = true;
        if (timer) clearTimeout(timer); // 長押しタイマーを即座に破棄
      }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (timer) clearTimeout(timer);
      
      // スクロールした場合は、タップ処理（選択トグルの反転）を完全に無視する
      if (isScrolled) return;

      if (!isLongPress) {
        onToggle(); // 純粋なタップの時だけ実行
      } else {
        e.preventDefault(); // 長押し時はブラウザの挙動をリセット
      }
    };

    // ーーー PC（マウス）用の処理 ーーー
    const handleMouseDown = () => {
      isLongPress = false;
      timer = setTimeout(() => {
        isLongPress = true;
        onEdit(ingredient);
      }, 600);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
      if (timer) clearTimeout(timer);
      if (!isLongPress) {
        onToggle();
      } else {
        e.preventDefault();
      }
    };

    return {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove, // 🌟 これでスクロールを監視！
      onTouchEnd: handleTouchEnd,
    };
  };

  const openMemoModal = (menu: Menu) => {
    setViewingMemoMenu(menu);
  };
/*
  useEffect(() => {
    // 1コメ半（少しだけ描画を待ってから計算するJavaScriptの定番の処理）
    setTimeout(() => {
      const textarea = document.getElementById('new-memo-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, 50);
  }, [ newMenuMemo, newMemoTab]);
*/
/*
  useEffect(() => {
    if (editingId) {
      // 1コメ半（少しだけ描画を待ってから計算するJavaScriptの定番の処理）
      setTimeout(() => {
        const textarea = document.getElementById('editing-memo-textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }
      }, 50);
    }
  }, [editingId, editingMemo, editingMemoTab]);
*/
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
      type: 'confirm',
      title: '調理の確認',
      message: `「${menu.title}」を作りましたか？`,
      onConfirm: async () => {

        const { data: currentMenu } = await supabase
          .from('menus')
          .select('cook_count, last_cooked_at, memo')
          .eq('id', menu.id)
          .single();

        const currentCount = currentMenu?.cook_count || 0;
        const currentLast = currentMenu?.last_cooked_at || null;
        const today = new Date().toISOString().split('T')[0];

        // 重複チェック
        if (currentLast === today) {
          handleRemoveFromKeep(menu.id);
          
          // infoタイプのモーダルを表示して、関数をここで終了する
          setModal({
            show: true,
            type: 'info',
            title: 'お知らせ',
            message: `「${menu.title}」は本日すでに調理済みとして記録されています。\n重複を防ぐためカウントの更新をスキップしました。`,
          });
          return; 
        }

        // 未記録の場合のみSupabaseを更新
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

        setModal({ show: false, type: null, title: '', message: '', onConfirm: undefined });
      }
    });
  };

  const triggerCancelCookModal = (menuId: string, title: string) => {
    setModal({
      show: true,
      type: 'confirm',
      title: '調理取消の確認',
      message: `「${title}」の直近の調理実績を取り消しますか？`,
      onConfirm: async () => {
        const { error } = await supabase.rpc('cancel_last_cooked', { target_menu_id: menuId });
        if (!error) {
          setRefreshTrigger(prev => prev + 1);
        }
        setModal({ show: false, type: null, title: '', message: '', onConfirm: undefined });
      }
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
      type: 'confirm',
      title: '削除の確認',
      message: msg,
      onConfirm: async () => {
        setMasterLoading(true);
        await supabase.from('menu_ingredients').delete().eq('ingredient_id', id);
        const { error: ingError } = await supabase.from('ingredients').delete().eq('id', id);
        if (!ingError) {
          setSelectedIngredients(prev => prev.filter(item => item !== id));
          setRefreshTrigger(prev => prev + 1);
          setIsIngModalOpen(false);
        }
        setMasterLoading(false);
        setModal({ show: false, type: null, title: '', message: '', onConfirm: undefined });
      }
    });
  };

  const triggerDeleteMenuModal = (id: string, title: string) => {
    setModal({
      show: true,
      type: 'confirm',
      title: '削除の確認',
      message: `メニュー「${title}」を削除しますか？\n\n※このメニューの使用食材マスタデータも同時に削除されます。`,
      onConfirm: async () => {
        await supabase.from('menu_ingredients').delete().eq('menu_id', id);
        const { error } = await supabase.from('menus').delete().eq('id', id);
        if (!error) {
          handleRemoveFromKeep(id);
          setRefreshTrigger(prev => prev + 1);
          setIsMenuModalOpen(false);
        }
        setModal({ show: false, type: null, title: '', message: '', onConfirm: undefined });
      }
    });
  };

  const handleRegisterIngredient = async () => {

    const trimmedName = editingText?.trim();

    if (!trimmedName) {
      setModal({
        show: true,
        type: 'info', 
        title: '登録エラー',
        message: '食材名を入力してください。',
      });
      return; 
    }

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
      });
      return; // ここで処理を終了し、インサートを行わない
    }

    // 重複がなければ登録
    const { error } = await supabase
      .from('ingredients')
      .insert([{ name: trimmedName, category: editingIngredientCategory }]);

    if (!error) {
      setNewIngredientName('');
      setRefreshTrigger(prev => prev + 1);
      setIsIngModalOpen(false);
    }
    setMasterLoading(false);
  };

  const handleRegisterMenu = async () => {
    const trimmedTitle = editingMenuTitle?.trim();

    if (!trimmedTitle) {
      setModal({
        show: true,
        type: 'info', 
        title: '登録エラー',
        message: 'メニュー名を入力してください。',
      });
      return; 
    }

    setMasterLoading(true);

    // 🟢 メニュー名の重複チェック
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
      });
      return;
    }

    // 重複がなければインサート
    const { data: menuData, error: menuError } = await supabase
      .from('menus')
      .insert([
        { 
          title: trimmedTitle, 
          cook_count: 0, 
          menu_type: editingMenuType, // 🌟 モーダルの選択状態をそのまま使用
          memo: editingMemo
        }
      ])
      .select('id')
      .single();
      
    if (menuError || !menuData) {
      setMasterLoading(false);
      return;
    }

    if (editingMenuIngredients.length > 0) {
      const relationData = editingMenuIngredients.map(ingId => ({
        menu_id: menuData.id,
        ingredient_id: ingId
      }));
      await supabase.from('menu_ingredients').insert(relationData);
    }

    setEditingMenuTitle('');
    setEditingMenuType('main');
    setIsMenuModalOpen(false);

    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

  const handleUpdateIngredient = async (id: string) => {
    
    const trimmedName = editingText?.trim();

    if (!trimmedName) {
      setModal({
        show: true,
        type: 'info', 
        title: '登録エラー',
        message: '食材名を入力してください。',
      });
      return; 
    }

    setMasterLoading(true);

    // 🟢 1. 編集後の名前が、すでに他の食材で使われていないかチェック
    const { data: existingIng } = await supabase
      .from('ingredients')
      .select('id')
      .eq('name', trimmedName)
      .neq('id', id) // ✨ ここが重要！「自分以外の食材」という条件を指定
      .maybeSingle();

    if (existingIng) {
      setMasterLoading(false);
      setModal({
        show: true,
        type: 'info',
        title: '更新エラー',
        message: `食材「${trimmedName}」はすでに登録されています。`,
      });
      return; // ⚠️ ここで処理を中断することで、小窓が消えずに残ります！
    }

    // 🟢 2. 重複がなければアップデートを実行
    const { error } = await supabase
      .from('ingredients')
      .update({ name: trimmedName, category: editingIngredientCategory })
      .eq('id', id);

    if (!error) {
      setRefreshTrigger(prev => prev + 1);
      setIsIngModalOpen(false); // 🎉 更新が「成功した時だけ」ここで小窓を閉じる！
    }
    setMasterLoading(false);
  };

  const handleStartEditMenu = async (menu: Menu) => {
    setEditingId(menu.id);
    setEditingText(menu.title);
    setEditingMemo(menu.memo || '');

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

    const trimmedTitle = editingMenuTitle?.trim();

    if (!trimmedTitle) {
      setModal({
        show: true,
        type: 'info', 
        title: '登録エラー',
        message: 'メニュー名を入力してください。',
      });
      return; 
    }

    setMasterLoading(true);

    // 🟢 1. 編集後のメニュー名が、すでに「他のメニュー」で使われていないかチェック
    const { data: existingMenu, error: checkError } = await supabase
      .from('menus')
      .select('id')
      .eq('title', trimmedTitle)
      .neq('id', menuId) // ✨ 食材の時と同じ！「自分以外のメニュー」という条件を指定
      .maybeSingle();

    if (checkError) {
      console.error(checkError);
    }

    // 重複するメニューが見つかった場合はアラートを出して中断
    if (existingMenu) {
      setMasterLoading(false);
      setModal({
        show: true,
        type: 'info',
        title: '更新エラー',
        message: `メニュー「${trimmedTitle}」はすでに登録されています。`,
      });
      return; // ⚠️ ここで処理を中断することで、モーダルを閉じずに残します
    }

    // 🟢 2. 重複がなければ通常の更新処理へ
    const { error: menuError } = await supabase
      .from('menus')
      .update({ 
        title: trimmedTitle, // 🌟 トリム済みの名前を使用
        menu_type: editingMenuType,
        memo: editingMemo 
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

    setIsMenuModalOpen(false);
    setEditingId(null);
    setRefreshTrigger(prev => prev + 1);
    setMasterLoading(false);
  };

  const handleToggleMasterIngredientSelection = (id: string) => {
    setEditingMenuIngredients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

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

  const handleOpenConfirmModal = () => {
    if (!extractedRecipe) return;

    setModal({
      show: true,
      type: 'confirm',
      title: `✨ AIが作成したレシピを確認`,
      message: 'AIレシピをメモに追記しますか？（以下、レシピ内容）\n\n\n' + extractedRecipe,
      onConfirm: () => {
        // 1. メモの最後尾に結合
        setEditingMemo((prevMemo) => {
          if (prevMemo && prevMemo.trim()) return `${prevMemo}\n\n${extractedRecipe}`;
          return extractedRecipe;
        });
        // 2. 状態を姿①（初期状態）に戻す
        setExtractedRecipe(null);
        setAiCount((prev) => prev + 1);
        // 3. モーダルを閉じる
        setModal({ show: false, type: null, title: '', message: '', onConfirm: undefined });
      }
    });
  };

  // 🧠 自前で作った Vercel API 経由でレシピを生成する非同期関数（デバッグ強化版）
  const handleAiCreateRecipe = async () => {
    if (isAiLoading) return;
    if (!editingMenuTitle || editingMenuTitle.trim() === '') {
      setModal({
        show: true,
        type: 'info', 
        title: 'メニュー名が未入力です',
        message: 'AIレシピを作成するには、メニュー名を入力してください。',
      });
      return; 
    }
    setIsAiLoading(true);
    try {
      // 🚀 【非同期処理】たった今作成した「身内（Vercel）のAPI」を叩く！
      const response = await fetch('/api/create-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          menu_title: editingMenuTitle, // 料理名
          aiCount: aiCount          // おかわりカウンタ（0, 1, 2...）
        })
      });

      // 🔍 200系以外のエラーの場合、ステータスコードとテキストを引っ張り出す
      if (!response.ok) {
        let errorText = "";
        try {
          const errorData = await response.json();
          errorText = errorData.error || JSON.stringify(errorData);
        } catch {
          errorText = await response.text();
        }
        throw new Error(`サーバーエラー (Status: ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const recipeText = data.recipe; // APIから返ってきたレシピ文

      if (!recipeText) {
        throw new Error("レシピデータが空っぽです。");
      }

      // ✨ 姿③（貼付け待ち）に変身！
      setExtractedRecipe(recipeText);

    } catch (error) {
      console.error("AIレシピ生成エラー:", error);
      
      // ユーザーに見せる用の優しいアラートに戻します
      setModal({
        show: true,
        type: 'info',
        title: '通信エラー',
        message: 'AIレシピの作成に失敗しました。時間をおいて再度お試しください。',
      });
    } finally {
      setIsAiLoading(false);
    };
  }
  



















  // 🟢 変更点1: 背景を夕焼けをイメージした美しいグラデーション（または画像）に変更
  // ※ もし画像にしたい場合は bg-gradient-to-b ... の代わりに bg-[url('/sunset.jpg')] bg-cover bg-center bg-no-repeat bg-fixed にします
  return (
    <main className="min-h-screen relative text-slate-800 dark:text-slate-100">
      <div className="fixed inset-0 -z-50 w-full h-full min-h-[100dvh]">
        {/* 実際の画像 */}
        <img 
          src="/images/Gemini_Generated_Image_caadsjcaadsjcaad.png" 
          alt="background" 
          className="w-full h-full object-cover"
        />
        {/* 暗いフィルター（文字の視認性を保つためのオーバーレイ） */}
        <div className="absolute z-50 inset-0 bg-white/30 dark:bg-zinc-950/40 backdrop-blur-[2px]"/>
      </div>
    
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ヘッダー & 画面切り替えタブ */}{/* ヘッダーエリア */}
        <div className="relative flex items-center justify-center pt-6 px-4">
          
          {/* 中央のタイトル */}
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            🍳 今日の晩ごはん
          </h1>

          {/* 右上の設定ボタン (absoluteで配置) */}
          <button
            onClick={() => setIsSettingOpen(true)}
            className={`absolute right-4 p-2 rounded-xl bg-white/20 dark:bg-stone-800/70 hover:bg-white/30 
                      dark:hover:bg-zinc-600 transition-all text-white ${currentStyles.sectionTitle}`}
          >
            ⚙️
          </button>

          {/* ドロワーはどこに置いてもOK（固定配置のため） */}
          <SettingDrawer 
            isOpen={isSettingOpen} 
            onClose={() => setIsSettingOpen(false)}
            fontSize={fontSize}
            handleFontSizeChange={handleFontSizeChange}
            currentStyles={currentStyles}
          />
        </div>














        {/* ----------------- 画面1: メインアプリ ----------------- */}
        <div className="mb-4">
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
        </div>
        {/* 使いたい食材 */}
        <div className="bg-white/70 dark:bg-zinc-950/70 p-6 mb-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
        
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-5">
              <h2 className={`${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white flex items-center gap-2`}>
                🥦 使いたい食材
              </h2>
              <button
                type="button"
                onClick={handleOpenAddIngredient} // 👈 先ほど作った新規用の関数を呼ぶ
                className={`flex items-center justify-center font-black rounded-xl bg-indigo-50 
                            dark:bg-zinc-800 text-indigo-600 dark:text-yellow-600 
                            hover:bg-indigo-100 dark:hover:bg-zinc-700 transition shadow-sm 
                            border dark:border-zinc-700 ${currentStyles.masterBtn}`}
                title="食材を新規登録"
              >
                ✚
              </button>
            </div>
            {selectedIngredients.length > 0 && (
              <button onClick={() => setSelectedIngredients([])} className={`text-indigo-600 dark:text-white hover:text-indigo-800 dark:hover:underline font-bold underline ${currentStyles.score}`}>
                ＜選択クリア＞
              </button>
            )}
          </div>
          
          {ingredients.length > 0 ? (
            <div className="pb-10 max-h-72 overflow-y-auto overscroll-contain pr-2 pl-4 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-100/10 shadow-inner">
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
                        const isTarget = selectedIngredients.includes(ing.id);

                        return (
                          <button
                            key={ing.id}// 🟢 スマホ・タブレット（タッチ）用
                            onTouchStart={(e) => handleIngredientStart(e, ing, (target) => {
                              setSelectedIngForModal(target);
                              setEditingText(target.name);
                              setEditingIngredientCategory(target.category);
                              setIngModalMode('edit');
                              setIsIngModalOpen(true);
                            })}
                            onTouchMove={handleIngredientMove}
                            onTouchEnd={(e) => {
                              if (longPressTimer.current) clearTimeout(longPressTimer.current);
                              
                              if (isScrolling.current) {
                                e.preventDefault();
                                isScrolling.current = false;
                                isLongPressActive.current = false;
                                return;
                              }
                              if (!isLongPressActive.current) {
                                handleToggleIngredient(ing.id);
                              } else {
                                e.preventDefault();
                              }
                              isLongPressActive.current = false;
                            }}

                            // 🔵 PC（マウス）用
                            onMouseDown={(e) => {
                              if (e.button !== 0) return; // 左クリックのみ
                              handleIngredientStart(e, ing, (target) => {
                                setSelectedIngForModal(target);
                                setEditingText(target.name);
                                setEditingIngredientCategory(target.category);
                                setIngModalMode('edit');
                                setIsIngModalOpen(true);
                              });
                            }}
                            onMouseMove={handleIngredientMove} // マウスを押し下げたまま動かした時のキャンセル用
                            onMouseUp={() => {
                              if (longPressTimer.current) clearTimeout(longPressTimer.current);
                            }}
                            onMouseLeave={() => {
                              // ボタンの外にカーソルが出たらタイマーを解除
                              if (longPressTimer.current) clearTimeout(longPressTimer.current);
                            }}

                            // 🟢 PC（マウス）用のクリックイベント
                            onClick={() => {
                              // マウス操作、かつ長押しが発火していなかった場合のみトグルを動かす
                              if (window.matchMedia('(pointer: fine)').matches) {
                                if (!isLongPressActive.current) {
                                  handleToggleIngredient(ing.id);
                                }
                                isLongPressActive.current = false; // フラグをリセット
                              }
                            }}

                            className={`rounded-xl border font-bold transition select-none ${currentStyles.masterBtn} ${
                              isTarget 
                                ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600' 
                                : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-700'
                            }`}
                            style={{
                              WebkitTouchCallout: 'none',
                              touchAction: 'pan-y'
                            }}
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
          <div className="bg-white dark:bg-zinc-950/70 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-stone-100/10 flex flex-col">
            <div className="flex items-center gap-5 mb-4">
              <h2 className={`whitespace-nowrap ${currentStyles.sectionTitle} font-bold text-slate-700 dark:text-white`}>
                {selectedIngredients.length === 0 ? '📋 おすすめメニュー' : '📋 おすすめメニュー（食材選択中）'}
              </h2>
              
              <button
                type="button"
                onClick={handleOpenAddMenu} // 👈 先ほど作った新規用の関数を呼ぶ
                className={`flex items-center justify-center font-black rounded-xl bg-indigo-50 
                          dark:bg-zinc-800 text-indigo-600 dark:text-yellow-600 
                          hover:bg-indigo-100 dark:hover:bg-zinc-700 transition shadow-sm 
                          border dark:border-zinc-700 ${currentStyles.masterBtn}`}
                title="メニューを新規登録"
              >
                ✚
              </button>
            </div>

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
            
            <div className="pb-10 overflow-y-auto overscroll-contain max-h-130 p-4 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-100/10 shadow-inner space-y-3">
              {loading ? (
                <div className={`text-center py-8 text-slate-400 dark:text-white animate-pulse ${currentStyles.masterText}`}>メニューを取得中...</div>
              ) : sortedMenus.length > 0 ? (

                sortedMenus.map((menu: Menu) => {
                const isAlreadyKept = keepList.some(item => item.id === menu.id);

                return (
                <div 
                  key={menu.id} 
                  
                  // 🌟 スマホ長押し & PC操作の仕掛けをメニューカード全体に付与
                  onTouchStart={(e) => handleIngredientStart(e, menu, (target) => handleOpenEditMenu(target))} // 前述の共通Start関数を流用可能
                  onTouchMove={handleIngredientMove}
                  onTouchEnd={(e) => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    if (isScrolling.current) {
                      isScrolling.current = false;
                      return;
                    }
                    isLongPressActive.current = false;
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    handleIngredientStart(e, menu, (target) => handleOpenEditMenu(target));
                  }}
                  onMouseMove={handleIngredientMove}
                  onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  
                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-950 hover:bg-indigo-50/30 dark:hover:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-800 transition select-none"
                  style={{ WebkitTouchCallout: 'none', touchAction: 'pan-y' }}
                >
                  <div className="flex flex-col gap-1 flex-1 pr-2 pl-2 cursor-pointer">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`font-bold text-slate-800 dark:text-white ${currentStyles.title}`}>{menu.title}</span>
                      {menu.ingredient_count === 0 && (
                        <span className={`bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-white border border-rose-200 dark:border-rose-500 px-1.5 py-0.5 rounded font-bold animate-pulse ${currentStyles.badge}`}>
                          ⚠️食材未登録
                        </span>
                      )}
                    </div>

                    {/* スコア・履歴表示部分 */}
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
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // 親の長押し/クリック判定と競合しないようにガード
                              triggerCancelCookModal(menu.id, menu.title);
                            }} 
                            className={`text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:underline font-black ${currentStyles.score}`}
                          >
                            ↩ 調理取消
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // ガード
                      handleToggleKeep(menu);
                    }} 
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
          <div className="bg-white dark:bg-zinc-950/70 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-stone-100/10 flex flex-col">
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
                    <span className={`font-bold text-slate-800 dark:text-white flex-1 pr-2 ${currentStyles.title}`}>
                      {menu.title}
                      {/* 🟢 メモがある場合のみアイコンを表示 */}
                      {menu.memo && (
                          <button 
                            onClick={() => setModal({
                              show: true,
                              type: 'info', // 🟢 ボタンを「確認」1つだけにするために 'info' を指定
                              title: `${menu.title} のメモ`, // 🟢 ご希望のヘッダータイトル
                              message: menu.memo, // 🟢 ここにメモの本文を叩き込む
                            })} 
                            className="ml-2 text-amber-500 hover:text-amber-600 transition shrink-0"
                          >
                            📝
                          </button>
                        )}
                        
                      </span>

                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => triggerMadeModal(menu)} className={`bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg font-bold shadow-sm transition ${currentStyles.masterBtn}`}>
                        ✅ 作った！
                      </button>
                      <button onClick={() => handleRemoveFromKeep(menu.id)} className={`bg-white dark:bg-zinc-900 text-slate-500 dark:text-white border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition ${currentStyles.masterBtn}`}>
                        キャンセル
                      </button>
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













        {/* 
        {viewMode === 'setting' && (
          <div className="space-y-8">
            
            // 文字サイズ変更 設定カード 
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
        )} */}
      </div>

      <IngredientModal
        isOpen={isIngModalOpen}
        onClose={() => setIsIngModalOpen(false)}
        mode={ingModalMode}
        editingText={editingText}
        setEditingText={setEditingText} 
        editingCategory={editingIngredientCategory} 
        setEditingCategory={setEditingIngredientCategory} 
        currentStyles={currentStyles} 
        inputGlobalStyle={inputGlobalStyle} 
        onSave={() => {
          if (ingModalMode === 'edit') {
            handleUpdateIngredient(selectedIngForModal.id);
          } else {
            handleRegisterIngredient();
          }
          
        }}
        onDelete={() => {
          if (selectedIngForModal) {
            triggerDeleteIngredientModal(selectedIngForModal.id, selectedIngForModal.name);
          }
        }}
      />

<MenuModal
  isOpen={isMenuModalOpen}
  onClose={() => setIsMenuModalOpen(false)}
  mode={menuModalMode}
  editingMenuTitle={editingMenuTitle}
  setEditingMenuTitle={setEditingMenuTitle}
  editingMenuType={editingMenuType}
  setEditingMenuType={setEditingMenuType} 
  
  // 🟢 ここから下が新しく追加が必要なプロパティです！
  editingMenuMemo={editingMemo}
  setEditingMenuMemo={setEditingMemo}
  editingMenuIngredients={editingMenuIngredients} 
  handleToggleMasterIngredientSelection={handleToggleMasterIngredientSelection}
  ingredients={ingredients}
  isAiLoading={isAiLoading}
  extractedRecipe={extractedRecipe}
  handleAiCreateRecipe={handleAiCreateRecipe}
  handleOpenConfirmModal={handleOpenConfirmModal}
  masterLoading={masterLoading}
  // 🟢 ここまでを追加

  currentStyles={currentStyles}
  inputGlobalStyle={inputGlobalStyle}
  onSave={() => {
    if (menuModalMode === 'edit') {
      // 🌟 安全のために selectedMenuForModal の後ろに ? をつけておくとより安心です
      handleUpdateMenuAndIngredients(selectedMenuForModal?.id); 
    } else {
      handleRegisterMenu();
    }
  }}
  onDelete={() => {
    if (selectedMenuForModal) {
      triggerDeleteMenuModal(selectedMenuForModal.id, selectedMenuForModal.title);
    }
  }}
/>

      {/* 統合型アプリ内確認モーダル */}
      {modal.show && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          {/* 🟢 変更①：flex flex-col、max-h-[80vh]、overflow-hidden を追加し、p-6 を排除（枠線と余白の干渉を防ぐため） */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full shadow-xl border border-slate-100 dark:border-zinc-800 flex flex-col max-h-[80vh] overflow-hidden">
            
            {/* 🟢 変更②：ヘッダー部分。独立させて、個別にパディング（p-6 pb-3）を設定 */}
            <div className="p-6 pb-6">
              <h3 className={`${currentStyles.sectionTitle} font-bold text-slate-900 dark:text-white`}>
                {modal.title}
              </h3>
            </div>

            {/* 🟢 変更③：メッセージ部分。flex-1 と overflow-y-auto でここだけをスクロールさせる。px-6 で横余白を統一 */}
            <div className={`flex-1 overflow-y-auto px-6 text-slate-600 dark:text-white text-base leading-snug whitespace-pre-line ${currentStyles.masterText}`}>
              {modal.message}
            </div>

            {/* 🟢 変更④：ボタン部分。独立させて、個別にパディング（p-6 pt-3）を設定 */}
            <div className="flex justify-end gap-2 p-6 pt-3">
              {/* 🟢 infoタイプの場合は「確認」ボタン1つだけを表示 */}
              {modal.type === 'info' ? (
                <button 
                  onClick={() => setModal({ show: false, type: null, title: '', message: '' })} 
                  className={`pt-1 pl-3 pr-3 pb-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm ${currentStyles.masterBtn}`}
                >
                  確認
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setModal({ show: false, type: null, title: '', message: '' })} 
                    className={`pt-1 pl-3 pr-3 pb-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-slate-600 dark:text-white ${currentStyles.masterBtn}`}
                  >
                    キャンセル
                  </button>
                  <button onClick={() => {
                    if (modal.onConfirm) {
                      modal.onConfirm(); // ① 親から実行関数が渡されていれば、それを実行する
                    } 
                  }} 
                  className={`pt-1 pl-3 pr-3 pb-1 text-white rounded-xl font-black shadow-sm ${currentStyles.masterBtn} ${
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