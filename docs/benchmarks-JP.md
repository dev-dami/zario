# パフォーマンスベンチマーク

このページには、リポジトリで実行した最新のベンチマーク結果を記載します。
数値は CPU オーバーヘッドの目安であり、アプリケーション全体のスループットを
保証するものではありません。

## 実行環境

- **OS**: Ubuntu 24.04（Linux 6.14.0-29-generic）
- **CPU**: Intel Core i3-8130U @ 2.20GHz（2コア / 4スレッド）
- **RAM**: 8GB DDR4
- **ランタイム**: Bun 1.4.0 / Node.js v24.14.0
- **出力先**: プロセス内の null / no-op シンク。ディスク・ネットワーク I/O なし

## Zario ホットパススイート

`bun benchmarks/logger.bench.ts` で実行します。各行は 6 サンプルの中央値です。
以下は `benchmarks/logger.bench.ts` のデフォルト設定で実行した結果です。

| ベンチマーク | Median ops/sec | Median ns/op |
|---|---:|---:|
| Simple message (sync) | 12,945,716 | 78 |
| Message with metadata (sync) | 12,210,208 | 82 |
| Message with deep metadata (sync) | 7,515,826 | 134 |
| Filtered debug log (level=error) | 164,273,841 | 6 |
| Filtered info log (level=error) | 204,739,764 | 5 |
| Simple JSON log (end-to-end) | 8,212,903 | 122 |
| JSON log with metadata (end-to-end) | 3,532,846 | 283 |
| Dynamic JSON message (end-to-end) | 2,703,703 | 371 |
| Simple message (async enqueue) | 3,637,374 | 276 |
| Message with metadata (async enqueue) | 4,321,454 | 231 |
| Format text (with metadata) | 4,631,418 | 217 |
| Format text (simple) | 15,930,759 | 63 |
| Format JSON (with metadata) | 3,324,086 | 301 |
| Format JSON (simple fast path) | 14,044,473 | 72 |
| Child logger simple message | 10,362,968 | 97 |
| Child logger with metadata | 10,281,366 | 97 |

非同期行は enqueue / dispatch のオーバーヘッドを測定します。実際のトランスポートの
遅延やスループットは含みません。

## 他ライブラリとの比較

`cd .benchmark && bun run bench:all` で実行します。最新の完全な実行では、環境内で
デフォルトの 2.5 秒実行が 3 番目のシナリオ中に Node.js のヒープを使い切ったため、
`ZARIO_BENCH_DURATION_MS=500 ZARIO_BENCH_MIN_ITERATIONS=100000` を使用しました。

| ライブラリ | Simple ops/sec | Metadata ops/sec | Child ops/sec | Filtered ops/sec | Deep metadata ops/sec | Error ops/sec |
|---|---:|---:|---:|---:|---:|---:|
| Zario | 2,892,211 | 1,133,669 | **1,352,701** | **11,669,719** | 403,413 | 546,099 |
| Pino | 987,051 | 485,484 | 854,028 | 10,455,052 | 233,218 | 359,316 |
| Winston | 208,805 | 108,229 | 143,938 | 440,655 | 48,605 | 53,006 |
| Bunyan | 176,456 | 201,345 | 152,322 | 8,747,737 | 95,457 | 179,995 |
| Log4js | 815,356 | **1,286,107** | - | 2,868,417 | **739,115** | **750,633** |
| Loglevel | **19,004,827** | **10,994,588** | - | 10,207,611 | **10,202,277** | **10,068,812** |

100,000 件のバーストでは、Zario は 26.29 ms（3,804,448 logs/sec）でした。
Loglevel は 3.95 ms、Pino は 78.11 ms です。実際の I/O により結果は変わります。

## 再現方法

```bash
bun benchmarks/logger.bench.ts
cd .benchmark
bun install
ZARIO_BENCH_DURATION_MS=500 ZARIO_BENCH_MIN_ITERATIONS=100000 bun run bench:all
```

結果は CPU、ランタイムのバージョン、GC、バックグラウンド負荷によって変動します。

---

[← ロードマップ](./roadmap-JP.md) | [Introduction →](./introduction-JP.md)
