'use client';

import React, { useRef } from 'react';
import { INGREDIENT_CATEGORIES } from '@/constants';

interface Ingredient {
  id: string;
  name: string;
  category: typeof INGREDIENT_CATEGORIES[number];
}

interface IngredientGridProps {
  ingredients: Ingredient[];
  selectedIngredients: string[];
  onToggle: (id: string) => void;
  onLongPressEdit: (ingredient: Ingredient) => void;
  currentStyles: any;
}

export const IngredientGrid: React.FC<IngredientGridProps> = ({
  ingredients,
  selectedIngredients,
  onToggle,
  onLongPressEdit,
  currentStyles,
}) => {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isScrolling = useRef(false);
  const isLongPressActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const handleIngredientStart = (e: React.TouchEvent | React.MouseEvent, ingredient: Ingredient) => {
    isScrolling.current = false;
    isLongPressActive.current = false;

    if ('touches' in e) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      if ('touches' in e && e.cancelable) e.preventDefault();
      onLongPressEdit(ingredient);
    }, 600);
  };

  const handleIngredientMove = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      const moveX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const moveY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (moveX > 10 || moveY > 10) {
        isScrolling.current = true;
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
    } else {
      isScrolling.current = true;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }
  };

  if (ingredients.length === 0) {
    return <p className={`text-slate-400 dark:text-white ${currentStyles.masterText}`}>食材がありません。「設定」から登録してください。</p>;
  }

  return (
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
                    key={ing.id}
                    onTouchStart={(e) => handleIngredientStart(e, ing)}
                    onTouchMove={handleIngredientMove}
                    onTouchEnd={(e) => {
                      if (longPressTimer.current) clearTimeout(longPressTimer.current);
                      if (isScrolling.current) {
                        e.preventDefault();
                        isScrolling.current = false;
                        isLongPressActive.current = false;
                        return;
                      }
                      if (!isLongPressActive.current) onToggle(ing.id);
                      else e.preventDefault();
                      isLongPressActive.current = false;
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      handleIngredientStart(e, ing);
                    }}
                    onMouseMove={handleIngredientMove}
                    onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    onClick={() => {
                      if (window.matchMedia('(pointer: fine)').matches) {
                        if (!isLongPressActive.current) onToggle(ing.id);
                        isLongPressActive.current = false;
                      }
                    }}
                    className={`rounded-xl border font-bold transition select-none ${currentStyles.masterBtn} ${
                      isTarget 
                        ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600' 
                        : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-white border-slate-200 dark:border-zinc-700'
                    }`}
                    style={{ WebkitTouchCallout: 'none', touchAction: 'pan-y' }}
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
  );
};