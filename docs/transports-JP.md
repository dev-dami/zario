# トランスポート（Transports）

トランスポートは **ログメッセージの出力先** を定義する仕組みです。  
Zario には複数の組み込みトランスポートが用意されており、単体でも組み合わせても使用できます。

---

## 概要

各トランスポートは `Transport` インターフェースを実装しており、個別に設定可能です。

トランスポートは以下を担当します：

- **同期 / 非同期処理**: `write()` と `writeAsync()` の両対応
- **エラーハンドリング**: リトライや障害回復の仕組みを内蔵
- **高パフォーマンス**: 高スループット向けに最適化
- **リソース管理**: メモリ管理とクリーンアップを適切に実施

---

# 利用可能なトランスポート

---

## Console Transport

コンソールにログを出力します。色付けやフォーマット設定に対応。

### 基本的な使い方

```typescript
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  transports: [new ConsoleTransport()],
  colorize: true
});
```

### 設定オプション

| オプション | 型 | デフォルト | 説明 |
|------------|---------|-------------|----------------|
| `colorize` | boolean | true | 色付き出力を有効化 |
| `json` | boolean | false | テキストの代わりに JSON 出力 |

---

## File Transport

ログをファイルに書き込みます。  
自動ローテーション・圧縮機能をサポート。

### 基本的な使い方

```typescript
import { Logger, FileTransport } from "zario";

const logger = new Logger({
  transports: [new FileTransport({
    path: "./logs/app.log",
    maxSize: 10485760,
    maxFiles: 5,
    compression: "gzip"
  })]
});
```

### 設定オプション

| オプション | 型 | デフォルト | 説明 |
|------------|---------|-------------|----------------|
| `path` | string | ./logs/app.log | ログファイルパス |
| `maxSize` | number | 10485760 | ローテーション前の最大サイズ（bytes） |
| `maxFiles` | number | 5 | 保持する世代数 |
| `compression` | string | undefined | 圧縮方式 (`gzip`, `deflate`) |
| `batchInterval` | number | 1000 | バッチ書き込み間隔（ms） |

---

## HTTP Transport

ログを HTTP エンドポイントへ送信します。  
リトライやタイムアウトをサポート。

### 基本的な使い方

```typescript
import { Logger, HttpTransport } from "zario";

const logger = new Logger({
  transports: [new HttpTransport({
    url: "https://api.example.com/logs",
    method: "POST",
    headers: {
      Authorization: "Bearer your-token",
      "Content-Type": "application/json"
    },
    timeout: 5000,
    retries: 3
  })]
});
```

### 設定オプション

| オプション | 型 | デフォルト | 説明 |
|------------|---------|-------------|----------------|
| `url` | string | 必須 | HTTP エンドポイント |
| `method` | string | POST | HTTP メソッド |
| `headers` | object | {} | HTTP ヘッダー |
| `timeout` | number | 5000 | タイムアウト（ms） |
| `retries` | number | 3 | リトライ回数 |

---

## Retry Transport

任意のトランスポートに **自動リトライ（指数バックオフ）** を追加します。  
不安定なネットワークや外部サービスに最適。

### 基本的な使い方

```typescript
import { Logger, RetryTransport, HttpTransport } from "zario";

const retryTransport = new RetryTransport({
  wrappedTransport: new HttpTransport({ url: "https://api.example.com/logs" }),
  maxAttempts: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  jitter: true
});
```

### 設定オプション

| オプション | 型 | デフォルト | 説明 |
|------------|---------|-------------|----------------|
| `wrappedTransport` | Transport | 必須 | 対象トランスポート |
| `maxAttempts` | number | 3 | 最大リトライ回数 |
| `baseDelay` | number | 1000 | 初期待機時間（ms） |
| `backoffMultiplier` | number | 2 | バックオフ倍率 |
| `jitter` | boolean | true | ランダム遅延追加 |
| `retryableErrorCodes` | string[] | ECONNREFUSED 等 | リトライ対象エラー |

---

## Circuit Breaker Transport

連続失敗時に自動遮断し、**カスケード障害を防止** します。  
サーキットブレーカーパターンを実装。

### 状態

- CLOSED: 通常動作
- OPEN: 遮断（即失敗）
- HALF_OPEN: 回復確認中

### 基本的な使い方

```typescript
import { CircuitBreakerTransport, HttpTransport } from "zario";

const transport = new CircuitBreakerTransport(
  new HttpTransport({ url: "https://api.example.com/logs" }),
  { threshold: 5, timeout: 60000 }
);
```

### 設定オプション

| オプション | 型 | デフォルト | 説明 |
|------------|---------|-------------|----------------|
| `threshold` | number | 5 | 遮断する失敗回数 |
| `timeout` | number | 60000 | HALF_OPEN 待機時間 |
| `resetTimeout` | number | undefined | 自動リセット時間 |
| `onStateChange` | function | undefined | 状態変更コールバック |
| `onTrip` | function | undefined | 遮断時コールバック |
| `onReset` | function | undefined | 復旧時コールバック |

---

## Dead Letter Queue (DLQ)

すべてのリトライに失敗したログを保存します。  
ログ消失を防ぎ、後で解析可能。

### 基本的な使い方

```typescript
import { Logger, DeadLetterQueue, HttpTransport } from "zario";

const logger = new Logger({
  transports: [
    new DeadLetterQueue({
      transport: new HttpTransport({ url: "https://api.example.com" }),
      deadLetterFile: "./logs/dead-letters.jsonl"
    })
  ]
});
```

### 設定オプション

| オプション | 型 | デフォルト | 説明 |
|------------|---------|-------------|----------------|
| `transport` | Transport | 必須 | 対象トランスポート |
| `maxRetries` | number | 3 | 最大リトライ回数 |
| `retryableErrorCodes` | string[] | ネットワーク系 | リトライ対象エラー |
| `deadLetterFile` | string | undefined | 保存ファイル |
| `onDeadLetter` | function | undefined | 失敗時コールバック |

---

# トランスポートの組み合わせ例

```typescript
const logger = new Logger({
  transports: [primaryTransport, fallbackTransport]
});
```

複数のトランスポートを組み合わせることで  
**高信頼・高可用性なロギング構成** を実現できます。

---

# パフォーマンス考慮

- asyncMode を有効化してノンブロッキング化
- バッチ処理を活用
- メモリ上限付きキューでリーク防止
- リトライ / DLQ で障害耐性強化

---

# ベストプラクティス

1. 外部サービスには Circuit Breaker を使用
2. 重要ログは Dead Letter Queue を利用
3. 本番ではファイルローテーション有効化
4. トランスポートの状態を監視
5. 環境に適したトランスポートを選択

---

# 関連ドキュメント

- [API リファレンス](./api-reference-JP.md)
- [設定ガイド](./configuration-JP.md)
- [高度な使い方](./advanced-usage-JP.md)
