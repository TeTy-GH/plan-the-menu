-- 1. すでに登録されてしまった「クォーテーション付きの 'main'」からクォーテーションを消し去る
UPDATE menus 
SET menu_type = 'main' 
WHERE menu_type = '''main''' OR menu_type = '''main'''::text;

-- 2. カラムのデフォルト値を、純粋な「main」という文字列に修正する
ALTER TABLE menus 
ALTER COLUMN menu_type SET DEFAULT 'main'::text;