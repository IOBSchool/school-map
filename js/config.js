// ===== 設定ファイル =====
// SUPABASE_URL を空のままにすると「デモモード」（サンプルデータで動作確認できる）
window.SHOPMAP_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  PHOTO_BUCKET: 'shopmap-photos',

  // デモモードの閲覧パスワード
  DEMO_PASSWORD: 'demo',

  // 初期表示（日本全体が見える位置）
  INITIAL_CENTER: [36.2, 138.2],
  INITIAL_ZOOM: 5,
};

// カテゴリ定義（追加・変更はここだけ。schema.sql の check 制約も合わせて変更）
window.SHOPMAP_CATEGORIES = {
  food:   { label: '飲食',         icon: '🍽', color: '#f26b3b' },
  farm:   { label: '農家',         icon: '🌾', color: '#7a9a3a' },
  salon:  { label: 'サロン',       icon: '💆', color: '#c86a9a' },
  shop:   { label: '物販',         icon: '🛍', color: '#0085c9' },
  stay:   { label: '宿泊',         icon: '🏡', color: '#85634b' },
  school: { label: '教室・講座',   icon: '📚', color: '#6a5acd' },
  other:  { label: 'その他',       icon: '📍', color: '#553727' },
};
