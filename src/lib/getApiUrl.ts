export const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // ローカル or LAN内(192.168.x.x など)の場合のみ、動的にポート54321を組み立てる
    const isLocalDev = 
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);

    if (isLocalDev) {
      return `http://${hostname}:54321`;
    }
  }
  
  // 本番環境、またはサーバーサイド実行時は環境変数をそのまま使う
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
};