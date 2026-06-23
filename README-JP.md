<div align="center">

<a id="top"></a>

# Zario

### TypeScript向けのミニマルなロギングソリューション

[![npm version](https://img.shields.io/npm/v/zario?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/zario)
[![license](https://img.shields.io/npm/l/zario?style=for-the-badge&color=green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dt/zario?style=for-the-badge&logo=npm&color=orange)](https://www.npmjs.com/package/zario)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zario?style=for-the-badge&logo=webpack&color=purple)](https://bundlephobia.com/package/zario)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/Dev-Dami/zario?label=build)](https://github.com/Dev-Dami/zario/actions)

[English](README.md)


<br/>

**高速** • **軽量** • **依存関係ゼロ** • **TypeScriptネイティブ**

<br/>

[ドキュメント](#-documentation) · [クイックスタート](#-quick-start) · [特徴](#-features) · [コントリビューション](#-contributing)

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

<br/>

## 特徴

- **軽量** — 最小限のサイズで高速に動作
- **シンプルなAPI** — `info()`, `warn()`, `error()` など直感的なメソッド
- **柔軟なフォーマット** — プレーンテキスト / 構造化JSONに対応
- **複数トランスポート** — Console、File（ストリーミング＋ローテーション）、HTTP（非同期リトライ）、CircuitBreaker、DeadLetterQueue
- **子ロガー** — モジュールやリクエスト単位のスコープ付きロギング
- **非同期モード** — 高負荷環境向けのノンブロッキング書き込み
- **メモリ安全** — 上限付きキューとメモリ効率の高いストリーミング設計
- **高い拡張性** — カスタムログレベル、カラー、フィルタリングに対応
## エコシステム

Zarioをお使いのWebフレームワークに簡単に導入するための、公式アダプターを提供しています：

- [zario-express](https://github.com/dev-dami/zario-express) — Expressロギングミドルウェア。
- [nestjs-zario](https://github.com/dev-dami/nestjs-zario) — NestJSカスタムロガーサービス。
- [fastify-zario](https://github.com/dev-dami/fastify-zario) — Fastifyカスタムロガーラッパー。

## Winston、Pinoとの比較

公平かつ客観的な評価を行うため、同一環境下で Zario、Winston、Pino の比較テストを行いました：
1. **バンドルサイズ**: 各パッケージを読み込み、1回ログを出力するコードを `esbuild` でバンドル・最小化した際のファイルサイズを測定。
2. **パフォーマンス**: 100,000回ログを出力する時間を測定。システムのI/Oによる影響を排除し、フォーマッタおよびフレームワーク自体のオーバーヘッドを測定するため、共通の `Writable` null ストリームに対して出力。

### 比較データ

| 項目 / 機能 | Zario (Lean) | Zario (Full) | Pino | Winston |
| :--- | :---: | :---: | :---: | :---: |
| **バンドルサイズ (最小化)** | 11.80 KB | 24.72 KB | 60.65 KB | 143.92 KB |
| **処理速度 (単純ログ)** | 586k ops/sec | 586k ops/sec | 942k ops/sec | 177k ops/sec |
| **処理速度 (メタデータ付)** | 391k ops/sec | 391k ops/sec | 839k ops/sec | 110k ops/sec |
| **実行時依存関係数** | 0 | 0 | 8個以上 | 10個以上 |
| **耐障害性トランスポート** | 設定により利用可能 | 標準搭載 (Retry, CB, DLQ) | カスタム実装が必要 | 外部ライブラリが必要 |
| **Tree-shakeability** | 対応 | 対応 | 非対応 | 非対応 |

## インストール

```bash
bun add zario
```

## クイックスタート

```typescript
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()],
  prefix: "[MyApp]",
});

logger.info("サーバーがポート3000で起動しました");
logger.warn("メモリ使用量が高くなっています");
logger.error("データベース接続に失敗しました", { code: 500 });
```

### 軽量インポートパス

`Logger` だけが必要な場合は、バンドルサイズ削減のために軽量エントリポイントを利用できます。

```typescript
import { Logger } from "zario/logger";
```

`zario/logger` は `Logger` と logger 関連型のみを公開します。  
このエントリポイントで `retryOptions` を使う場合は、起動時に一度だけ `Logger.retryTransportFactory` を設定してください。

## ドキュメント

ドキュメント:

| セクション | 説明 |
|-----------|------|
| [**はじめに**](./docs/introduction-JP.md) | 設計思想、コア機能、主なユースケースの概要 |
| [**スタートガイド**](./docs/getting-started-JP.md) | インストール方法と環境の自動セットアップ手順 |
| [**設定**](./docs/configuration-JP.md) | ロガー設定・カスタムレベル・カラー設定の完全リファレンス |
| [**APIリファレンス**](./docs/api-reference-JP.md) | Logger クラスおよび各種ユーティリティの詳細API仕様 |
| [**トランスポート**](./docs/transports-JP.md) | Console / File / HTTP / Circuit Breaker / Dead Letter Queue の解説 |
| [**高度な使い方**](./docs/advanced-usage-JP.md) | フィルター・エンリッチャー（構造化ログ）・アグリゲーター |
| [**ログフォーマット**](./docs/log-formats-JP.md) | テキストおよび JSON 出力形式の仕様 |
| [**ベンチマーク**](./docs/benchmarks-JP.md) | 他のロギングライブラリとの性能比較 |
| [**ロードマップ**](./docs/roadmap-JP.md) | 今後の計画と追加予定の機能 |

## コントリビューション

バグ報告、機能提案、コードのコントリビューションを歓迎します。 詳細は [Contributing Guide](./CONTRIBUTING.md) をご覧ください。

## ライセンス

本プロジェクトは MIT License のもとで公開されています。詳細は[LICENSE](./LICENSE) をご覧ください。

<br/>

<div align="center">

### 開発者のために作られました

このリポジトリにスターを付けて応援してください

</div>

<br/>

[トップへ戻る](#top)
