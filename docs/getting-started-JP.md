# Zario クイックスタート

このガイドでは、Node.js アプリケーションに Zario を導入し、基本的な使い方をすぐに始める方法を説明します。

## インストール

お好みのパッケージマネージャーを使って Zario をインストールしてください。

```bash
# npm を使用
npm install zario

# yarn を使用
yarn add zario

# pnpm を使用
pnpm add zario

# bun を使用
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

[← Introduction](./introduction.md) | [Configuration →](./configuration.md)
