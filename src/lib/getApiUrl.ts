export const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    // ブラウザ実行時は、今アクセスしているホスト名を使う
    return `http://${window.location.hostname}:54321`;
  }
  // サーバー側実行時(SSR/API Route)は環境変数を使う
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
};