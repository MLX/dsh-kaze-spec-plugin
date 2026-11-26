# Third-party notices

This package is distributed under the MIT License in `LICENSE`. The following
third-party material is included in the published package.

## Mermaid

- Version: `mermaid@11.12.1`
- Copyright: Copyright (c) 2014 - 2022 Knut Sveidqvist
- License: MIT
- Included as: the generated on-demand diagram chunk `lib/client.mermaid.js`
  and the `mermaid` development dependency used to build it.

The MIT permission notice for Mermaid is reproduced below. Mermaid itself
bundles other libraries (for example D3, DOMPurify, KaTeX, and dayjs) in its
published distribution; those components remain under their own licenses. The
full dependency metadata and license files are available in the Mermaid
package: <https://www.npmjs.com/package/mermaid>.

```text
The MIT License (MIT)

Copyright (c) 2014 - 2022 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## DeepSeek Harness Typert protocol

- Version: `@deepseek-ai/dsh-typert-protocol@0.2.2-rc.5`
- Copyright: Copyright (c) 2026 DeepSeek
- License: MIT
- Included as: `vendor/dsh-typert-protocol/`, used only to build `lib/host.js`.
  The full license text is in `vendor/dsh-typert-protocol/LICENSE`.

## DeepSeek Harness runtime packages

The plugin loads `@deepseek-ai/cordis`, React, Zod, and other DeepSeek Harness
packages from the profile that installs it. Those packages are not copied into
this repository and remain under their own licenses.

## Original project

The original plugin code, documentation, command catalog, and skill bodies are
Copyright (c) 2026 Kaze Spec contributors and are licensed under the MIT License
in `LICENSE`.
