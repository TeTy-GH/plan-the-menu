import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai"
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    // mode: 'init' (初期ロード用) | 'force' (ボタンタップ用)
    const { mode, ingredient_ids } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    
    const now = new Date();
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const today = jstDate.toISOString().split('T')[0];

    // 1. DB確認 (maybeSingle を使うと0件でもエラーになりません)
    const { data: existingMenu, error: dbError } = await supabase
      .from('daily_menus')
      .select('id, menu_text')
      .eq('created_at', today)
      .maybeSingle();
      
    if (dbError) {
      console.error("DBエラー:", dbError);
    }

    // 'init' モードで、すでに今日の献立があればそれを返す
    if (mode === 'init' && existingMenu) {
      return new Response(JSON.stringify({ suggestedMenu: existingMenu.menu_text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ---------------------------------------------------------
    // ここから下は「今日まだデータがない」or「'force'モード」の処理
    // ---------------------------------------------------------

    // 2. 食材取得
    let ingredientNames = "指定なし";
    if (ingredient_ids && ingredient_ids.length > 0) {
      const { data: ingredients, error: ingError } = await supabase
        .from('ingredients')
        .select('name')
        .in('id', ingredient_ids);
      
      if (ingError) throw ingError;
      ingredientNames = ingredients?.map(i => i.name).join(", ") || "指定なし";
    }

    // 3. 過去7日間の除外メニュー取得
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentMenus } = await supabase
      .from('daily_menus')
      .select('menu_text')
      .gte('created_at', sevenDaysAgo.toISOString().split('T')[0]);
    const excludedMenus = recentMenus?.map(m => m.menu_text).join(", ") || "なし";

    // 4. AI処理
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const genAI = new GoogleGenerativeAI(apiKey || "");
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    //const prompt = `食材: ${ingredientNames}\n除外(過去7日): ${excludedMenus}\n晩ごはんを1つ提案して。「〇〇はいかがですか？」形式で短く。`;

    const prompt = `食材: ${ingredientNames}
除外(過去7日): ${excludedMenus}

晩ごはんのメニューを1つ提案してください。
出力は必ず以下の【フォーマット】を厳守し、余計な挨拶や解説は一切含めないでください。

【フォーマット】
[純粋な料理名] / [料理名を含んだ、40文字程度の秀逸な提案文]

【提案文のルール】
・一瞬で読めて食欲をそそる、短く洗練された1文（40文字前後）にしてください。

【出力例】
豚の生姜焼き / 甘辛く香ばしいタレの豚の生姜焼きで、炊きたてのご飯が止まらない至福の時間を。
チキン南蛮 / ジューシーなチキン南蛮に濃厚タルタルソースを絡めて、お腹も心も満たされる夕食に。
麻婆豆腐 / ピリッと痺れる辛みと旨みが絶妙な麻婆豆腐で、今夜は熱々のご飯を豪快にかき込もう。`;

    const result = await model.generateContent(prompt);
    const menuText = result.response.text().trim();
    const usedIngredientsArray = ingredientNames === "指定なし" ? [] : ingredientNames.split(', ');

    // 5. DB保存 (既存があればUpdate、なければInsert)
    if (existingMenu) {
      await supabase.from('daily_menus')
        .update({ 
          menu_text: menuText, 
          ingredients_used: usedIngredientsArray
        })
        .eq('created_at', today);
    } else {
      await supabase.from('daily_menus').insert({ 
        menu_text: menuText, 
        created_at: today,
        ingredients_used: usedIngredientsArray 
      });
    }

    return new Response(JSON.stringify({ suggestedMenu: menuText }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("エラー詳細:", err);
    return new Response(JSON.stringify({ error: err.message || "予期せぬエラーが発生しました" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});