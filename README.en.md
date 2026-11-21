# Zhihu Column Exporter

[简体中文](README.md) · **English** · [Español](README.es.md) · [日本語](README.ja.md)

Save Zhihu articles and columns that your signed-in account can already read. The extension creates a ZIP with Markdown, offline HTML, a reading index and images for personal study or backup. The extension interface is in Chinese.

## Install or update

Use Chrome 120 or later, or a compatible Manifest V3 Chromium browser.

1. Download and extract the ZIP from [Releases](https://github.com/Hokkaidoooo/zhihu-column-exporter/releases/latest).
2. Open `chrome://extensions/`, enable **Developer mode**, and choose **Load unpacked**. Select the `extension` folder inside the extracted ZIP. On Windows, `install-extension.cmd` opens the extensions page and the folder.
3. Pin **知乎付费专栏导出** to the toolbar. To update, replace the extension folder, reload the extension, then close and reopen any old export page.

## Export and read offline

1. While signed in, open a column index or an article you have access to. Click the extension icon and choose the export formats.
2. Select **开始导出** (Start export), keep the export page visible, and save the ZIP when prompted.
3. Extract the ZIP. Open `index.html` if you selected HTML, or browse the Markdown in `articles/`. Check `export-info.json` for the result of each article and its source URL. If anything is missing, use **重试未完成** (Retry unfinished) on the export page.

For standard columns, the extension follows catalogue pagination and excludes recommendations. It checks the signed-in article API response before accepting it. If the response is unavailable, preview-only, or inconsistent, the extension explains why and reads the normal article page instead, using up to four background tabs. A ZIP can contain partial results: failed image downloads keep their original URLs and require internet access to display. `complete: true` requires all articles in the full catalogue and all images selected for local download to have been saved successfully.

## Permissions and privacy

The extension requests `downloads`, `scripting`, and `tabs` permissions, plus access to the Zhihu pages and `zhimg.com` image hosts it uses. Requests run in your normal browser session. The extension does not request cookie access, read or export cookies or login tokens, or send articles to third parties. It does not bypass sign-in, subscription or paywall checks. Export only material you are entitled to read and use it for lawful personal purposes.

## Build and license

With Node.js 22 and npm, run from the repository root:

```sh
npm ci
npm run check
npm run package
```

The package and checksums are written to `dist`. The checks use synthetic fixtures, not paid articles or account data. See the [development guide](DEVELOPMENT.md) and [changelog](CHANGELOG.md).

The zhihu-column-exporter contributors release the code under the [MIT License](LICENSE). See the [third-party notices](THIRD_PARTY_NOTICES.md) for bundled components. The code license does not grant rights to Zhihu articles.
