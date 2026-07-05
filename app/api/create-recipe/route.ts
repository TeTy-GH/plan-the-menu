// app/api/create-recipe/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 🚀 Vercelのサーバー上で動く非同期関数（POSTリクエストを受け付ける）
export async function POST(request: Request) {
  try {
    // 1. 画面（page.tsx）から送られてきたデータを取り出す
    const { menu_title, aiCount } = await request.json();

    // 2. 環境変数から安全にAPIキーを取得してGeminiを初期化
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite' }); // 💡 2026年現在の標準高速モデル

    // 3. おかわりカウンタ（aiCount）に応じてプロンプトを分岐
    let prompt = "";
    if (aiCount === 0) {
      prompt = `メニュー名「${menu_title}」に合う、王道で定番の美味しいレシピ（材料と簡単な作り方）を日本語で作成してください。`;
    } else if (aiCount === 1) {
      prompt = `メニュー名「${menu_title}」をベースに、いつもとちょっと違う味付けや、意外な隠し味、または時短になるような「アレンジ・変化球レシピ」を日本語で作成してください。`;
    } else {
      prompt = `メニュー名「${menu_title}」をベースに、野菜をたっぷり摂れる健康派アレンジ、または冷蔵庫の残り物でパパッと作れるような「ヘルシー・お手軽レシピ」を日本語で作成してください。`;
    }

    // 4. 🧠 Gemini API をサーバーからキック！
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 5. 成功したら画面にテキストを返す
    return NextResponse.json({ recipe: text });

 } catch (error: any) {
    console.error('Vercel API Error:', error);
    
    // 💡 固定文字ではなく、発生した本当のエラーメッセージ（error.message）を画面に送り返す
    return NextResponse.json(
      { error: `サーバー内部でのクラッシュ: ${error.message || String(error)}` }, 
      { status: 500 }
    );
  }
}