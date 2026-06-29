import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

Deno.serve(async (req) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // ここでフロントエンドから食材データなどを受け取る
  const { ingredients } = await req.json();

  const prompt = `使いたい食材を使って、何か一品メニューを提案して: ${ingredients}`;
  const result = await model.generateContent(prompt);
  
  return new Response(
    JSON.stringify({ suggestion: result.response.text() }),
    { headers: { "Content-Type": "application/json" } },
  );
});