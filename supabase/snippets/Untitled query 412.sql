CREATE OR REPLACE FUNCTION public.get_recommended_menus(selected_ingredient_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(t) FROM (
        SELECT 
          m.id,
          m.title,
          m.cook_count,
          m.last_cooked_at,
          m.prev_cooked_at, -- 必要であれば追加してください
          m.is_cancelled,   -- ★ここを追加！
          COALESCE(
            CASE 
              WHEN selected_ingredient_ids IS NULL OR array_length(selected_ingredient_ids, 1) IS NULL OR array_length(selected_ingredient_ids, 1) = 0 THEN 0
              WHEN (SELECT COUNT(*) FROM menu_ingredients WHERE menu_id = m.id) = 0 THEN 0
              ELSE (COUNT(DISTINCT mi.ingredient_id)::float / (SELECT COUNT(*) FROM menu_ingredients WHERE menu_id = m.id)::float) * 100
            END, 
            0
          )
          - (COALESCE(m.cook_count, 0) * 3)
          - (CASE 
              WHEN m.last_cooked_at IS NULL THEN 0
              WHEN (CURRENT_DATE - m.last_cooked_at) >= 7 THEN 0
              ELSE (7 - (CURRENT_DATE - m.last_cooked_at)) * 5
             END) AS score
        FROM menus m
        LEFT JOIN menu_ingredients mi ON m.id = mi.menu_id AND mi.ingredient_id = ANY(selected_ingredient_ids)
        WHERE selected_ingredient_ids IS NULL 
           OR array_length(selected_ingredient_ids, 1) IS NULL 
           OR array_length(selected_ingredient_ids, 1) = 0 
           OR mi.ingredient_id IS NOT NULL
        GROUP BY m.id, m.title, m.cook_count, m.last_cooked_at, m.prev_cooked_at, m.is_cancelled -- ★ここにも追加
        ORDER BY score DESC, m.id ASC
      ) t
    ),
    '[]'::json
  );
END;$function$
