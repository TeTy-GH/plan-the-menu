-- 今日の日付のレコードを明示的に作成
INSERT INTO daily_menus (menu_text, created_at)
VALUES ('【テスト表示】今日は冷しゃぶサラダはいかがですか？', CURRENT_DATE)
ON CONFLICT (created_at) DO UPDATE SET menu_text = EXCLUDED.menu_text;