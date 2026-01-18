<div align="center">

<a id="top"></a>

# 📝 Zario

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

[📖 ドキュメント](#-documentation) · [⚡ クイックスタート](#-quick-start) · [✨ 特徴](#-features) · [🤝 コントリビューション](#-contributing)

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

## 📦 インストール

```bash
npm install zario
```

## 🚀 クイックスタート

```typescript
import { Logger, ConsoleTransport } from "zario";

const logger = new Logger({
  level: "info",
  colorize: true,
  transports: [new ConsoleTransport()],
  prefix: "[MyApp]",
});

logger.info("🚀 サーバーがポート3000で起動しました");
logger.warn("⚠️ メモリ使用量が高くなっています");
logger.error("❌ データベース接続に失敗しました", { code: 500 });
```

## 📖 ドキュメント

Documentation:

| セクション                                            　| 説明                                                                  　　　　　 |
| ---------------------------------------------------　| -----------------------------------------------------------------------------　|
| [📘 **はじめに**](./docs/introduction.md)       　　　　| 設計思想、コア機能、主なユースケース                              　　　　　　　　　　　　　　|
| [🚀 **スタートガイド**](./docs/getting-started.md) 　　　| インストール方法と環境の自動設定                     　　　　　　　　　　　　　　　　　　　　　　|
| [⚙️ **設定**](./docs/configuration.md)     　　　　　　　| ロガー設定、カスタムレベル、カラー設定の完全リファレンス             　　　　　　　　　　　　　　　|
| [📖 **APIリファレンス**](./docs/api-reference.md)     　| Loggerクラスおよびユーティリティの詳細API               　　　　　　　　　　　　　　　　　　　　　|
| [📁 **トランスポート**](./docs/transports.md)           | コンソール / ファイル / HTTP / サーキットブレーカー / デッドレターキューの解説　　　　　　　　　 |
| [🧩 **高度な使い方**](./docs/advanced-usage.md)   　　　　| フィルター、エンリッチャー（構造化ログ）、アグリゲーター                     |
| [📊 **ログフォーマット**](./docs/log-formats.md)         | テキストおよびJSON出力形式の仕様                               |
| [🗺️ **ロードマップ**](./docs/roadmap.md)                 | 今後の計画と追加予定の機能                                           |
| [📊 **ベンチマーク**](./docs/benchmarks.md)           | 他のロギングライブラリとの性能比較                          |

## 🤝 コントリビューション

バグ報告、機能提案、コードのコントリビューションを歓迎します。 詳細は [Contributing Guide](./CONTRIBUTING.md) をご覧ください。

## 📄 ライセンス

本プロジェクトは MIT License のもとで公開されています。詳細は[LICENSE](./LICENSE) をご覧ください。

<br/>

<div align="center">

### 開発者のために作られました

⭐ このリポジトリにスターを付けて応援してください

</div>

<br/>

[⬆ トップへ戻る](#top)
