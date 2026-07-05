// app/api/create-recipe/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 🚀 Vercelのサーバー上で動く非同期関数（POSTリクエストを受け付ける）
export async function POST(request: Request) {
  try {
    // 1. 画面（page.tsx）から送られてきたデータを取り出す
    const { menu_title, aiCount } = await request.json();

    // 3. おかわりカウンタ（aiCount）に応じてプロンプトを分岐
    let prompt = "";
    let currentTemperature = 0.2;
    if (aiCount === 0) {
      currentTemperature = 0.2;
      prompt = `メニュー名「${menu_title}」」の王道定番レシピを日本語で作成してください。Markdown形式ではなく通常のテキスト形式で。`;
    } else if (aiCount === 1) {
      currentTemperature = 0.7;
      prompt = `メニュー名「${menu_title}」」のレシピを日本語で作成してください。Markdown形式ではなく通常のテキスト形式で。`;
    } else {
      currentTemperature = 1.3;
      prompt = `メニュー名「${menu_title}」」のアレンジレシピを日本語で作成してください。Markdown形式ではなく通常のテキスト形式で。`;
    }

    // 2. 環境変数から安全にAPIキーを取得してGeminiを初期化
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        temperature: currentTemperature 
      } 
    });

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