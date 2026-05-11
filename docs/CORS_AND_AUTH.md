# CORS と認証（GitHub Pages × GAS Web App）

別オリジンから `https://script.google.com/macros/...` に `fetch` すると、次のような事象が起きることがあります。

- ブラウザのログイン／同意画面へのリダイレクトが挟まり、`fetch` が CORS で失敗する
- Cookie / セッションが期待どおり引き継がれない

## 推奨の検証順

1. **同一 GAS にホストした静的 HTML**（`iframe` 内の同一オリジン）で `fetch` が通るか確認する。
2. **`credentials: 'include'`** で試す（本フロント実装はこれを使用）。成功しない場合は次へ。
3. **Google Identity Services（GIS）でアクセストークンを取得**し、**Apps Script Execution API** で `script.run` する（Web アプリ URL ではなく API 側を呼び出す）。
4. 組織ポリシーがある場合は **Workspace 管理者** に OAuth クライアント／承認済みドメインを確認する。

このリポジトリの GAS 側は **メール別 AllowList**（[`code.js`](code.js) 内）と **ユーザー権限実行**（[`appsscript.json`](../appsscript.json)）を前提にしています。Execution API に切り替える場合も、スクリプト内の `Session.getActiveUser().getEmail()` と同じユーザーでトークンを取得する必要があります。

## フロントの環境変数

[`frontend/.env.example`](frontend/.env.example) の `VITE_GAS_WEB_APP_URL` に、デプロイ済み **Web アプリ URL** を設定します（末尾 `/exec`）。

Execution API に切り替える場合は、この URL ではなく API クライアントと `scriptId` を使う別実装が必要です（実装時に検証）。
