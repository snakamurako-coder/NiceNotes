# NiceNotes（Thingsクローン / Workspace）

## 構成

- **GAS（デプロイ単位）**: [`code.js`](code.js) と [`index.html`](index.html)（[`appsscript.json`](appsscript.json) はマニフェスト）。分割なしで `clasp push` しやすい構成。
- **マスターデータ**: Google スプレッドシート1冊（フラット [`docs/TASK_SCHEMA.md`](docs/TASK_SCHEMA.md)）。
- **フロント**: [`frontend/`](frontend/)（Vite + React + Dexie + TanStack Query）。

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

## フロント

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
