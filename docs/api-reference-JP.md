# API リファレンス

このページでは、Zario の主要なクラスとメソッドについて詳細なリファレンスを提供します。

## `Logger` クラス

ロガーを作成するための中心となるクラスです。  
`EventEmitter` を継承しており、トランスポート・アグリゲーター・エンリッチャーで発生したエラーをイベントとして通知します。

### コンストラクタ

`new Logger(options?: LoggerOptions)`

### イベント

#### `'error'`

ロギングパイプライン（transports / aggregators / enrichers）でエラーが発生したときに発火します。

- **Payload**: `{ type: string, error: Error }`
- **Types**: `'transport'`, `'aggregator'`, `'enricher'`

---

### ログ出力メソッド

すべてのログメソッドは、`message` 文字列とオプションの `metadata` オブジェクトを受け取ります。

- `debug(message, metadata?)`
- `info(message, metadata?)`
- `warn(message, metadata?)`
- `error(message, metadata?)`
- `fatal(message, metadata?)`
- `boring(message, metadata?)`
- `silent(message, metadata?)`
- `logWithLevel(level: string, message: string, metadata?: object)`  
  → カスタムログレベルで出力

---

### インスタンスメソッド

#### `createChild(options: LoggerOptions): Logger`

現在のロガー設定を継承した新しいロガーインスタンスを作成します。  
指定したオプションは親設定とマージされます。

- **Prefix** は連結される（例: `[Parent][Child]`）
- **Context** はマージされる
- **Transports / Filters / Enrichers** は継承される

---

#### `startTimer(name: string): Timer`

パフォーマンス測定用タイマーを開始し、`Timer` オブジェクトを返します。

- `timer.end()`  
  → タイマーを終了し、経過時間をログ出力  
  （例: `Database query took 150ms`）

---

#### `addFilter(filter: Filter)` / `removeFilter(filter: Filter)`

フィルターを動的に追加・削除します。

---

#### `addAggregator(aggregator: LogAggregator)` / `removeAggregator(aggregator: LogAggregator)`

アグリゲーターを動的に追加・削除します。

---

#### `addEnricher(enricher: LogEnricher)`

構造化ログパイプラインにエンリッチャー（メタデータ追加処理）を追加します。

---

#### `setAsyncMode(enabled: boolean)`

実行時に非同期ログモードの ON/OFF を切り替えます。

---

#### `flushAggregators(): Promise<void>`

登録されているすべてのアグリゲーターを手動でフラッシュします。  
アプリケーション終了前の呼び出しに便利です。

---

## `Timer` オブジェクト

`logger.startTimer()` によって返されます。

- `end()`  
  → `startTimer` 呼び出しからの経過時間を計測し、`logger.info()` で出力  
  → 冪等（複数回呼んでも 1 回のみ実行）

---

## 定数 & 型

### `LogLevel`

組み込みログレベルのユニオン型：

```
'silent' | 'boring' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
```

---

### `Transport`

ログ出力先（トランスポート）のインターフェース。  
実装については [Transports](./transports.md) を参照。

---

## Transport オプション

### `FileTransportOptions`

- `path`: string - 出力ファイルパス
- `maxSize?`: number - ローテーション前の最大ファイルサイズ
- `maxFiles?`: number - 保持するローテーションファイル数
- `compression?`: `'gzip' | 'deflate' | 'none'` - 圧縮方式
- `compressOldFiles?`: boolean - 古いファイルを圧縮するか
- `batchInterval?`: number - 書き込みバッファ間隔（ms、0 で無効）
- `maxQueueSize?`: number - メモリ保護のための最大キュー数（デフォルト: `10000`）

---

### `HttpTransportOptions`

- `url`: string - 送信先エンドポイント
- `method?`: string - HTTP メソッド（デフォルト: `'POST'`）
- `headers?`: object - HTTP ヘッダー
- `timeout?`: number - タイムアウト（ms）
- `retries?`: number - リトライ回数
- `forceAsync?`: boolean - 同期 `write()` 呼び出しでも強制的に非同期化

---

### `CircuitBreakerTransportOptions`

- `threshold?`: number - サーキットを開く失敗回数（デフォルト: `5`）
- `timeout?`: number - Half-Open 状態の待機時間（ms、デフォルト: `60000`）
- `resetTimeout?`: number - 自動リセット時間
- `onStateChange?`: function - 状態変化コールバック `(fromState, toState)`
- `onTrip?`: function - トリップ時コールバック `(failureCount)`
- `onReset?`: function - リセット時コールバック

---

### `DeadLetterQueueOptions`

- `transport`: Transport - **必須**。ラップ対象のトランスポート
- `maxRetries?`: number - 最大リトライ回数（デフォルト: `3`）
- `retryableErrorCodes?`: string[] - リトライ対象エラーコード（デフォルト: ネットワークエラー）
- `deadLetterFile?`: string - 失敗ログ保存ファイル
- `onDeadLetter?`: function - デッドレター発生時コールバック `(deadLetter)`

---

### `DeadLetterLog`

`LogData` を拡張した、デッドレター専用メタデータ：

- `deadLetterReason`: string - 失敗理由（人間可読）
- `originalError?`: string - 元のエラーコード
- `retryCount`: number - リトライ回数
- `failedAt`: Date - 永続的失敗時刻

---

## Aggregators

アグリゲーターの詳細は [Advanced Usage](./advanced-usage.md) を参照。

### `BatchAggregator(maxSize, flushCallback, maxQueueSize?)`

- `maxSize`: number - フラッシュ前に収集するログ数
- `flushCallback`: function - バッチ処理用コールバック
- `maxQueueSize?`: number - 最大キューサイズ（デフォルト: `10000`）

---

### `TimeBasedAggregator(flushInterval, flushCallback, maxQueueSize?)`

- `flushInterval`: number - フラッシュ間隔（ms）
- `flushCallback`: function - バッチ処理用コールバック
- `maxQueueSize?`: number - 最大キューサイズ（デフォルト: `10000`）

---

[← Configuration](./configuration-JP.md) | [Transports →](./transports-JP.md)
