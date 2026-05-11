# NiceNotes（Thingsクローン / Workspace）

## 構成

- **GAS（デプロイ単位）**: [`code.js`](code.js) と [`index.html`](index.html)（[`appsscript.json`](appsscript.json) はマニフェスト）。分割なしで `clasp push` しやすい構成。
- **マスターデータ**: Google スプレッドシート1冊（フラット [`docs/TASK_SCHEMA.md`](docs/TASK_SCHEMA.md)）。
- **フル UI**: [`frontend/`](frontend/)（Vite + React + Dexie + TanStack Query）。
- **デモ（ファイル数を最小にしたいとき）**: ルートの [**`task-demo.html`**](task-demo.html) のみで試せます（ビルド不要・1 ファイル）。

## デモ（単一 HTML・B パターン）

[`task-demo.html`](task-demo.html) は CSS / JS を同居させた静的ファイルです。Dexie は CDN から読みます。IndexedDB 名は `frontend` 版と同じ `nice-notes-task-app` のため、同じブラウザではデータを共有します。

1. リポジトリのルートで HTTP サーバーを立てる（**`file://` だと GAS へ `fetch` が失敗しやすい**です）:

```bash
npx serve .
```

2. ブラウザで `http://localhost:3000/task-demo.html`（ポートは `serve` の表示に合わせる）を開く。
3. GAS の Web アプリ URL（`…/exec`）を入力して **保存** → **今すぐ取得** で一覧同期、**今すぐメモ**で追加。

本格運用・分割は [`frontend/`](frontend/) を利用してください。

## GAS セットアップ

1. スプレッドシートを用意し **Tasks** / **AllowList** シートを作成（AllowList の A 列に許可メールのみ）。
2. Apps Script の **スクリプト プロパティ**:
   - `TASK_APP_MASTER_SPREADSHEET_ID` — マスタースプレッドシート ID（必須）
   - 任意: `TASK_APP_MASTER_SHEET_NAME`（既定 `Tasks`）
   - 任意: `TASK_APP_ALLOWLIST_SHEET_NAME`（既定 `AllowList`）
   - 開発のみ: `TASK_APP_SKIP_ALLOWLIST` = `true` で一覧照合を省略（本番では推奨しません）
3. エディタ **サービス** で **Tasks API**（Advanced）を有効化。
4. **Webアプリ** として再デプロイ（`USER_ACCESSING`）。GitHub Pages から叩く場合はアクセスを「組織ユーザー」等に合わせる。

## CORS / 認証

GitHub Pages など別ドメインから `fetch` する場合、ログインリダイレクトや CORS で失敗することがあります。  
対策の候補は [`docs/CORS_AND_AUTH.md`](docs/CORS_AND_AUTH.md) を参照してください。

## フロント（Vite）

```bash
cd frontend
cp .env.example .env.local
# VITE_GAS_WEB_APP_URL に Webアプリ URL を設定
npm install
npm run dev
```

デプロイ（GitHub Pages 等）は `VITE_BASE_PATH=/リポジトリ名/` をビルド時に指定できます。

```bash
set VITE_BASE_PATH=/NiceNotes/
npm run build
```

## テスト

- フロント: `cd frontend && npm test`
- GAS: エディタで `runTaskAppUnitTests` を実行（[`code.js`](code.js) 末尾）
