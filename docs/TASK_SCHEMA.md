# Thingsクローン — データ契約（Phase 1）

## マスターシート列（1行＝1タスク、1シート・フラット）

| 列 | フィールド    | 型 / 形式 |
|----|---------------|-----------|
| A  | id            | UUID v4 |
| B  | area          | 文字列 |
| C  | project       | 文字列 |
| D  | heading       | 文字列 |
| E  | title         | 文字列 |
| F  | notes         | 文字列（URL等） |
| G  | status        | `active` \| `completed` \| `canceled` |
| H  | startDate     | `YYYY-MM-DD` または空 |
| I  | dueDate       | `YYYY-MM-DD` または空 |
| J  | checkItems    | JSON文字列: `[{ "id", "text", "isDone" }]` |
| K  | updatedAt     | ISO8601 UTC（競合解決の単一ソース）例: `2026-05-11T10:00:00.000Z` |

- 1行目はヘッダー行として扱います。
- `checkItems` は空欄のとき `[]` として正規化します。
- `updatedAt` はサーバーが書き換えのたびに更新します（クライアント送信値は競合検査にのみ使用）。

## GAS API JSON（フロントと同一形）

### TaskRecord（1件）

```json
{
  "id": "uuid",
  "area": "",
  "project": "",
  "heading": "",
  "title": "",
  "notes": "",
  "status": "active",
  "startDate": "2026-05-12",
  "dueDate": "2026-05-15",
  "checkItems": [{ "id": "c1", "text": "...", "isDone": false }],
  "updatedAt": "2026-05-11T10:00:00.000Z"
}
```

### GET 応答（`doGet` クエリ `mode=tasks`）

```json
{
  "ok": true,
  "tasks": [ /* TaskRecord[] */ ]
}
```

### POST `action: upsert`

リクエスト:

```json
{
  "action": "upsert",
  "task": {
    "id": "",
    "area": "",
    "project": "",
    "heading": "",
    "title": "必須",
    "notes": "",
    "status": "active",
    "startDate": "",
    "dueDate": "",
    "checkItems": []
  },
  "expectedUpdatedAt": "2026-05-11T10:00:00.000Z"
}
```

- 新規: `task.id` が空のとき UUID を採番し追記。
- 競合: `expectedUpdatedAt` を指定し、シート上の `updatedAt` と異なるとき `409` 相当のオブジェクトを返す（下記）。

### POST `action: delete`

```json
{
  "action": "delete",
  "id": "uuid",
  "expectedUpdatedAt": "optional"
}
```

## エラー・競合レスポンス（共通ラッパ）

成功例:

```json
{
  "ok": true,
  "task": { /* TaskRecord */ },
  "sync": {
    "tasksApi": { "ok": true },
    "calendar": { "ok": true }
  }
}
```

競合:

```json
{
  "ok": false,
  "error": "CONFLICT",
  "message": "...",
  "task": { /* サーバー上の最新 TaskRecord */ }
}
```

禁止（ホワイトリスト等）:

```json
{
  "ok": false,
  "error": "FORBIDDEN",
  "message": "..."
}
```
