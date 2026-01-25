# 設定リファレンス

Zario は非常に高いカスタマイズ性を備えています。  
`Logger` コンストラクタに `LoggerOptions` オブジェクトを渡すことで、動作を細かく設定できます。

## Logger オプション

| オプション | 型 | デフォルト | 説明 |
|------------|------|-------------|-------------|
| `level` | `LogLevel` | `'info'` | 出力する最小ログレベル |
| `colorize` | `boolean` | `true` | コンソール出力をカラー表示するかどうか |
| `json` | `boolean` | `false` | ログを JSON 形式で出力するかどうか |
| `transports` | `Transport[]` | `[Console]` | 使用するトランスポートの配列 |
| `timestamp` | `boolean` | `false` | ログにタイムスタンプを含めるかどうか |
| `timestampFormat` | `string` | `'YYYY-MM-DD HH:mm:ss'` | タイムスタンプのフォーマット |
| `prefix` | `string` | `''` | すべてのログに付与するプレフィックス |
| `context` | `object` | `{}` | すべてのログに付与されるデフォルトメタデータ |
| `asyncMode` | `boolean` | `false` | 非ブロッキング非同期ログを有効化 |
| `customLevels` | `object` | `undefined` | カスタムログレベル名と優先度のマッピング |
| `customColors` | `object` | `undefined` | カスタムログレベル名と色のマッピング |
| `filters` | `Filter[]` | `[]` | ログ出力前に適用されるフィルター配列 |
| `aggregators` | `Aggregator[]` | `[]` | ログ集約（バッチ処理など）を行う配列 |
| `enrichers` | `Enricher[]` | `[]` | 構造化ログ用のメタデータ処理パイプライン |

## ログレベル

Zario には、優先度順に並んだ組み込みログレベルが用意されています。

1. `silent` (0) - すべてのログを抑制
2. `boring` (1) - 低優先度の情報（カラーなし）
3. `debug` (2) - 詳細なデバッグ情報
4. `info` (3) - 一般的な情報メッセージ
5. `warn` (4) - 重大ではない警告
6. `error` (5) - 処理失敗時のエラー
7. `fatal` (6) - シャットダウンにつながる重大な障害

設定された `level` と **同じかそれ以上の優先度** のログのみが処理されます。

## カスタムレベル & カラー

独自のログレベルと優先度・色を定義することも可能です。

```typescript
const logger = new Logger({
  customLevels: {
    'success': 4,  // warn と同じ優先度
    'trace': 1     // debug より低い優先度
  },
  customColors: {
    'success': 'green',
    'trace': 'gray'
  }
});

logger.logWithLevel('success', 'Operation completed!');
```

### 使用可能なカラー

Zario は標準 ANSI カラーに対応しています：

`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`  
および `brightRed` などの明るい（bright）バリアント。

## タイムスタンプのカスタマイズ

`timestampFormat` では以下のプレースホルダーが使用できます。

- `YYYY` : 4 桁の年
- `MM` : 2 桁の月（01-12）
- `DD` : 2 桁の日（01-31）
- `HH` : 2 桁の時（00-23）
- `mm` : 2 桁の分（00-59）
- `ss` : 2 桁の秒（00-59）
- `SSS` : 3 桁のミリ秒（000-999）

例：

```
YYYY/MM/DD HH:mm:ss.SSS
→ 2025/01/23 10:22:20.500
```

## メモリ & パフォーマンス

Zario は、高負荷環境でも安全かつ高速に動作するためのオプションを提供しています。

### キュー制限（`maxQueueSize`）

`FileTransport` やログアグリゲーター（`BatchAggregator`, `TimeBasedAggregator`）では `maxQueueSize` を設定できます。  
これにより、処理待ちログの最大保持数を制限し、遅い I/O や下流サービス障害時のメモリリークを防止します。

### 非同期 HTTP（`forceAsync`）

`HttpTransport` は `forceAsync` オプションにより強制的に非同期モードへ切り替え可能です。  
これにより、ネットワークリクエストがメインイベントループをブロックせず、同期ログ呼び出し時でも安定したパフォーマンスを維持できます。

---

[← 入門ガイド](./getting-started-JP.md) | [API リファレンス →](./api-reference-JP.md)
