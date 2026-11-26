# Vendored sources

This directory contains the only vendored third-party source kept in the
repository. It is MIT-licensed and is not loaded at runtime.

| Path | Version | Purpose | License |
|---|---|---|---|
| `dsh-typert-protocol/` | `@deepseek-ai/dsh-typert-protocol@0.2.2-rc.5` | Pinned Remote protocol used while bundling `lib/host.js`, so the Host build does not require a local DSH install | MIT, see `dsh-typert-protocol/LICENSE` |

Mermaid is **not** vendored. `mermaid@11.12.1` is a development dependency
declared in `package.json`; the built chunk `lib/client.mermaid.js` is generated
from it by `npm run build`.

See `../THIRD_PARTY_NOTICES.md` for the full notices.
