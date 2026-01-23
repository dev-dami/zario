# ログフォーマット

Zario は 2 つの主要なログフォーマットをサポートしています：**プレーンテキスト（デフォルト）** と **JSON**。  
`json` 設定オプションを使って、これらのフォーマットを切り替えることができます。

## プレーンテキスト形式

プレーンテキスト形式は **人間が読みやすい表示** を目的として設計されており、開発環境や CLI ツールに最適です。

### 構造

テキストログのデフォルト構造は以下の通りです：

```text
[Timestamp] [Prefix] [LEVEL] Message {metadata}
```

- **Timestamp**: `timestamp` が `true` の場合に出力されます。形式は `timestampFormat` に従います。
- **Prefix**: ロガーに `prefix` が設定されている場合に出力されます。
- **LEVEL**: ログレベル（例：INFO、ERROR）。オプションでカラー表示されます。
- **Message**: メインのログメッセージ。
- **Metadata**: 追加データ。ログメソッドに渡されたオブジェクトが JSON としてシリアライズされます。

### 例

**標準ログ：**

```text
[2025-01-23 10:22:20] [INFO] Server started on port 3000
```

**Prefix とメタデータ付き：**

```text
[2025-01-23 10:22:20] [API] [ERROR] Database connection failed {"host":"localhost","port":5432}
```

## JSON 形式

JSON 形式は **構造化され、機械可読なフォーマット** であり、本番環境や ELK、Datadog、クラウドロギングサービスなどのログ集約基盤に最適です。

### 構造

各ログエントリは **1 行 1 JSON オブジェクト** として出力されます。  
一部のロガーのように `data` フィールドへネストするのではなく、Zario では **メタデータを JSON ルートに直接展開（スプレッド）** するため、検索やクエリが容易です。

### フィールド

- `level`: ログレベル文字列
- `message`: ログメッセージ文字列
- `timestamp`: ISO 8601 形式のタイムスタンプ（`timestamp: true` の場合）
- `prefix`: ロガープレフィックス（設定されている場合）
- `...metadata`: メタデータのキー・値はすべてルートレベルに展開されます

### 例

**基本的な JSON ログ：**

```json
{"level":"info","message":"User logged in","timestamp":"2025-01-23T10:22:20.000Z"}
```

**メタデータ付き JSON ログ：**

```json
{
  "level": "error",
  "message": "Request failed",
  "timestamp": "2025-01-23T10:22:25.000Z",
  "path": "/api/users",
  "status": 500,
  "userId": "12345"
}
```

## カラーサポート

`colorize` が有効（開発環境ではデフォルト有効）の場合、Zario はコンソール出力に ANSI カラーコードを使用します。

### 環境検出

Zario はターミナルのカラーサポートを自動検出します。  
環境変数を使用して強制的に有効・無効を切り替えることも可能です。

- `FORCE_COLOR=1`: カラー出力を強制的に有効化
- `FORCE_COLOR=0`: カラー出力を無効化

---

[← Advanced Usage](./advanced-usage.md) | [Roadmap →](./roadmap.md)
