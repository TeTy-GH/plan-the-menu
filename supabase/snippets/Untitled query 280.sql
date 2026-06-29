DECLARE
  current_count int;
  current_last date;
  current_prev date;
BEGIN
  -- 現在の値を抽出
  SELECT cook_count, last_cooked_at, prev_cooked_at
  INTO current_count, current_last, current_prev
  FROM menus
  WHERE id = target_menu_id;

  -- すでに調理回数が0の場合は何もしない
  IF current_count IS NULL OR current_count <= 0 THEN
    RETURN json_build_object('success', false, 'message', '調理実績がありません。');
  END IF;

  IF current_last IS NULL THEN
    RETURN json_build_object('success', false, 'message', '取消可能な調理日が記録されていません。');
  END IF;

  -- 履歴の巻き戻しアップデート
  UPDATE menus
  SET 
    cook_count = current_count - 1,
    -- 直近の調理日には、1つ前の調理日（prev_cooked_at）を戻す
    last_cooked_at = current_prev,
    -- 2世代前は保持していないため、prev_cooked_atは一度NULLにする
    prev_cooked_at = NULL,
    -- ★フラグを立てて「これ以上取消不可」の状態にする
    is_cancelled = true
  WHERE id = target_menu_id;

  RETURN json_build_object('success', true, 'message', '直近の調理実績を取り消しました。');
END;