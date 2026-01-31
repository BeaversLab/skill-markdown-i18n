# i18n Glossary

Technical terms and their translation conventions.

## Keep in English

These terms should NOT be translated:

| Term | Reason |
|------|--------|
| API | Industry standard |
| CLI | Industry standard |
| OAuth | Protocol name |
| JWT | Protocol name |
| Gateway | Product term |
| webhook | Technical term |
| npm | Tool name |
| Node.js | Tool name |
| PATH | Environment concept |
| SSL/TLS | Protocol names |
| HTTP/HTTPS | Protocol names |
| RPC | Protocol name |
| JSON/YAML | Format names |
| URL | Industry standard |
| UI | Industry standard |
| ID | Industry standard |

## Translate Consistently

| EN | ZH | JA | KO |
|----|----|----|-----|
| Install | 安装 | インストール | 설치 |
| Configuration | 配置 | 設定 | 설정 |
| Troubleshooting | 故障排查 | トラブルシューティング | 문제 해결 |
| Authentication | 认证 | 認証 | 인증 |
| Authorization | 授权 | 認可 | 인가 |
| Settings | 设置 | 設定 | 설정 |
| Guide | 指南 | ガイド | 가이드 |
| Documentation | 文档 | ドキュメント | 문서 |
| Error | 错误 | エラー | 오류 |
| Warning | 警告 | 警告 | 경고 |
| Success | 成功 | 成功 | 성공 |
| Failed | 失败 | 失敗 | 실패 |
| Running | 运行中 | 実行中 | 실행 중 |
| Stopped | 已停止 | 停止 | 중지됨 |
| Connected | 已连接 | 接続済み | 연결됨 |
| Disconnected | 已断开 | 切断 | 연결 해제됨 |
| Allowlist | 允许列表 | 許可リスト | 허용 목록 |
| Blocklist | 阻止列表 | ブロックリスト | 차단 목록 |

## Context-Dependent

Some terms change based on context:

### "Run"
- Command context: 运行 (zh) / 実行 (ja)
- Server context: 运行 (zh) / 稼働 (ja)

### "Service"
- System service: 服务 (zh) / サービス (ja)
- Web service: 服务 (zh) / サービス (ja)

### "Model"
- AI model: 模型 (zh) / モデル (ja)
- Data model: 数据模型 (zh) / データモデル (ja)

## Command-Line Flags

Never translate flags or their values:
- `--verbose` stays `--verbose`
- `--beta` stays `--beta`
- `-s` stays `-s`

## Placeholder Patterns

Keep these unchanged:
- `{{variable}}` - Mustache variables
- `${variable}` - Shell variables
- `$VARIABLE` - Environment variables
- `%s`, `%d` - Format specifiers
- `:param` - URL parameters
