# Zario クイックスタート

このガイドでは、Node.js アプリケーションに Zario を導入し、基本的な使い方をすぐに始める方法を説明します。

## インストール

Zario は Bun でインストールしてください。

```bash
bun add zario
```

## 基本的な使い方

ログ出力を開始するには、`Logger` クラスのインスタンスを作成します。

```typescript
import { Logger, ConsoleTransport } from 'zario';

// カスタム設定でロガーを作成
const logger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()],
  prefix: '[APP]'
});

// 各ログレベルで出力
logger.debug('This is a debug message'); // level が 'info' の場合は表示されない
logger.info('Application started');
logger.warn('Warning: Low disk space');
logger.error('Error: Connection failed');
logger.fatal('Fatal: System crash');
```

デフォルトでは、Zario は **`info` 以上のログレベル** を出力します。

## 軽量 Logger インポート（バンドル最適化）

`Logger` だけが必要な場合は、軽量エントリポイントを使用してください。

```typescript
import { Logger } from 'zario/logger';
```

これにより、バンドラでルートエクスポート全体の読み込みを回避できます。

### 軽量インポート時のリトライサポート設定

ルートの `zario` パッケージからインポートする場合（例：`import { Logger } from 'zario'`）、後方互換性のためにリトライ・トランスポート・ラッパーは内部で自動的に設定されます。

しかし、`zario/logger` からインポートする場合は、アプリケーションの起動時に一度だけリトライファクトリを設定する必要があります。

#### 例：アプリケーション起動時のセットアップ
以下は、リトライファクトリのセットアップを示す最小限の起動スクリプトの例です：

```typescript
import { Logger } from 'zario/logger';
import { RetryTransport } from 'zario/transports/RetryTransport';
import { ConsoleTransport } from 'zario/transports/ConsoleTransport';

// 1. 起動時に一度だけリトライファクトリを設定
Logger.retryTransportFactory = (options) => new RetryTransport(options);

// 2. retryOptions を指定して Logger を初期化
const logger = new Logger({
  level: 'info',
  transports: [new ConsoleTransport()],
  retryOptions: {
    maxAttempts: 5,
    baseDelay: 1000
  }
});

logger.info('Application started with retry support');
```

#### 例：トランスポートチェーンのセットアップ
`retryOptions` のラッピングを利用して、手動でトランスポートチェーンを構築することも可能です：

```typescript
import { Logger } from 'zario/logger';
import { RetryTransport } from 'zario/transports/RetryTransport';
import { HttpTransport } from 'zario/transports/HttpTransport';

// 1. リトライファクトリを設定
Logger.retryTransportFactory = (options) => new RetryTransport(options);

// 2. 指定した retryOptions で HttpTransport が自動的にラップされます
const logger = new Logger({
  transports: [
    new HttpTransport({
      url: 'https://logs.example.com/ingest'
    })
  ],
  retryOptions: {
    maxAttempts: 3,
    baseDelay: 500,
    backoffMultiplier: 2
  }
});
```

## 環境自動設定（Environment Auto-Configuration）

Zario は `NODE_ENV` 環境変数に基づいて自動的に設定を切り替えることができます。  
これにより、開発環境と本番環境のセットアップが簡単になります。

### 開発モード（Development Mode）

`process.env.NODE_ENV` が `'development'`（または未設定）の場合に有効。

- **デフォルトレベル**: `debug`
- **フォーマット**: プレーンテキスト + カラー表示（`colorize: true`, `json: false`）
- **トランスポート**: `ConsoleTransport`
- **モード**: 同期処理（`asyncMode: false`）

### 本番モード（Production Mode）

`process.env.NODE_ENV` が `'production'` の場合に有効。

- **デフォルトレベル**: `warn`
- **フォーマット**: 構造化 JSON（`colorize: false`, `json: true`）
- **トランスポート**: `ConsoleTransport` + `FileTransport`（既定：`./logs/app.log`）
- **モード**: 非同期処理（`asyncMode: true`）

```javascript
// 環境を自動検出して設定
const logger = new Logger();

// 任意の設定で上書きも可能
const logger = new Logger({
  level: 'info',   // 本番環境でも info レベルに固定
  asyncMode: false // 同期ログに固定
});
```

## コンテキスト情報の追加

ログにコンテキスト（メタデータ）を追加するには、第 2 引数にオブジェクトを渡します。

```javascript
logger.info('User logged in', { 
  userId: '123', 
  ip: '192.168.1.1' 
});
```

JSON モードでは、これらのフィールドは JSON オブジェクトのルートに直接展開されます。

---

[← Introduction](./introduction-JP.md) | [Configuration →](./configuration-JP.md)
