// ===== 設定ファイル =====
// SUPABASE_URL を空のままにすると「デモモード」（サンプルデータで動作確認できる）
window.SHOPMAP_CONFIG = {
  SUPABASE_URL: 'https://kctwhkxnvfidsnqaoefh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_6vtlwnwq3Mi0t6XdGxQN7g_0VFm5PTU',
  PHOTO_BUCKET: 'shopmap-photos',

  // お店にいるスクール生の役割
  PEOPLE_ROLES: ['オーナー', '運営者', 'スタッフ', '商品を卸している', '関係者'],

  // 🚨仮の一覧。正式名称をなつこさんに確認して直すこと（講座名は言い換え禁止）
  IOB_COURSES: [
    'オーガニック専門家コース',
    'オーガニックコスメ専門家コース',
    'オーガニックライフスタイルコース',
    'オーガニック教養コース',
    'オーガニック地域講師コース',
    'オーガニックビジネスアカデミー',
    'THE THREAD',
  ],
  IOB_CERTS: [
    'オーガニック専門家資格',
    'オーガニックコスメ専門家資格',
    'オーガニック地域講師',
    'オーガニックライフスタイルマスター', // 資格ではなく修了タイトル（本人確認 2026-09-22）
  ],

  // 初期表示（日本全体が見える位置）
  INITIAL_CENTER: [36.2, 138.2],
  INITIAL_ZOOM: 5,
};

// カテゴリ定義（追加・変更はここだけ。schema.sql の check 制約も合わせて変更）
window.SHOPMAP_CATEGORIES = {
  food:   { label: '飲食',         icon: '🍽', color: '#f26b3b' },
  farm:   { label: '農家',         icon: '🌾', color: '#7a9a3a' },
  salon:  { label: 'サロン',       icon: '💆', color: '#c86a9a' },
  shop:   { label: 'ショップ・スーパー', icon: '🛍', color: '#0085c9' },
  stay:   { label: '宿泊',         icon: '🏡', color: '#85634b' },
  school: { label: '教室・講座',   icon: '📚', color: '#6a5acd' },
  online: { label: 'オンライン・商品', icon: '🌐', color: '#2a9d8f' }, // 実店舗なし（オンライン活動・商品のみ）＝ピンは出ず一覧に載る
  other:  { label: 'その他',       icon: '📍', color: '#553727' },
};
