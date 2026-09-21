# スクール生のお店マップ

スクール生が運営するお店や関連スポットを、スクール生だけが地図で探せるWebアプリ。

## 構成（すべて無料枠）

| 役割 | 使うもの | 理由 |
|---|---|---|
| 画面 | HTML + JavaScript（ビルド不要） | 他のIOBページと同じ作り方。ファイルを置くだけで動く |
| 地図 | Leaflet + OpenStreetMap | APIキー・課金登録なしで世界中が表示できる |
| データ・写真・管理者ログイン | Supabase（既存の共有プロジェクトに同居） | 自動停止対策（Vercel cron）が既に動いている |
| 住所→位置 | OpenStreetMap Nominatim | 無料。登録フォームでのみ使用 |
| 公開場所 | GitHub Pages（iobschool） | 既存の公開方法と同じ |

## ファイル

```
school-map/
├── index.html        地図（共通パスワードで閲覧）
├── submit.html       お店登録フォーム（誰でも送信可・承認待ちで保存）
├── admin.html        管理画面（管理者ログイン → 承認/見送り/非公開/削除）
├── css/style.css     IOBブランドカラー・スマホ優先
├── js/config.js      Supabaseの接続先・カテゴリ定義
├── js/api.js         データの出入り口（デモモード/本番の切替はここだけ）
├── js/map.js         地図・絞り込み・現在地・詳細シート
├── js/submit.js      登録フォーム
├── js/admin.js       管理画面
└── supabase/schema.sql  テーブル・権限・写真置き場・閲覧パスワード
```

## 閲覧制限のしくみ

- 地図のデータは、Supabaseの関数 `shopmap_get_shops(パスワード)` を通さないと取れない
- テーブルへの直接の読み取りは禁止（RLS）。パスワードを知らない人はページを開けてもデータが1件も取れない
- 登録フォームからは「承認待ち」でしか保存できない。承認できるのは `shopmap_admins` に入れたメールの管理者だけ
- 連絡先メールは管理画面だけに表示され、地図には出ない

## 本番化の手順

1. Supabase の SQL Editor で `supabase/schema.sql` を実行（最後の2つの値＝閲覧パスワードと管理者メールを書き換えてから）
2. Supabase の Authentication → Users → Add user で、管理者メールのユーザーをパスワード付きで作成
3. `js/config.js` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` を入れる
4. GitHub Pages に置く（URLをスクール生に共有）

`SUPABASE_URL` が空の間はデモモード（サンプルデータ・パスワード `demo`）で動く。

## ローカル確認

```
python3 -m http.server 8795 --directory school-map
```
