# i18n Glossary

Technical terms and their translation conventions.

## Link Localization

Internal site links must be localized to the target language:

### Pattern Rules

| Source Pattern | Target Pattern (ZH) | Example |
|----------------|---------------------|---------|
| `/en/*` | `/zh/*` | `/en/guide` → `/zh/guide` |
| `/xxx` (no locale) | `/zh/xxx` | `/install` → `/zh/install` |
| `http://*` or `https://*` | Keep unchanged | `https://api.example.com` (no change) |

### Identification

**Internal links to localize:**
- Start with `/` (root-relative)
- Point to pages within the same site
- DO NOT contain `http://` or `https://`

**External links (keep unchanged):**
- Start with `http://` or `https://`
- Point to different domains
- Example: `https://developer.mozilla.org`

### Examples

```markdown
# English Source
- See [Installation Guide](/en/install) for setup
- Check [API Reference](/api) for details
- Visit [GitHub](https://github.com) for source code
- Relative: [Getting Started](../guide)

# Chinese Translation
- 查看[安装指南](/zh/install)进行设置
- 检查 [API 参考](/zh/api)了解详情
- 访问 [GitHub](https://github.com)查看源代码
- 相对链接：[入门指南](../guide)
```

### Special Cases

1. **Relative links** - Keep unchanged:
   - `../other-page` (relative to current directory)
   - `./same-page` (same directory)

2. **Anchor links** - Keep anchor, localize path:
   - `/en/guide#install` → `/zh/guide#install`

3. **Mixed content** - Localize path, keep anchor and query params:
   - `/en/guide?version=2.0#install` → `/zh/guide?version=2.0#install`

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
