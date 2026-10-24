# 知乎专栏导出

[![CI](https://github.com/Hokkaidoooo/zhihu-column-exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/Hokkaidoooo/zhihu-column-exporter/actions/workflows/ci.yml)

将当前浏览器账号已经有权阅读的知乎专栏保存到本地。导出包包含 Markdown、离线 HTML、阅读目录和正文图片，适合个人学习、检索与备份。

## 安装

需要 Chrome 120 或更新版本，也可在支持 Manifest V3 的 Chromium 浏览器中加载。

1. 从 [最新发布](https://github.com/Hokkaidoooo/zhihu-column-exporter/releases/latest) 下载并解压安装包。
2. 打开 `chrome://extensions/`，开启“开发者模式”。Windows 用户也可双击包内的 `install-extension.cmd` 打开扩展页和文件夹。
3. 点击“加载已解压的扩展程序”，选择包内的 `extension` 文件夹。
4. 将“知乎付费专栏导出”固定到浏览器工具栏。

更新时，替换扩展文件夹，在扩展页点击“重新加载”，再关闭旧导出页并重新打开。

## 使用

1. 在已登录并有权阅读的浏览器中打开专栏目录或正文页。
2. 点击扩展图标，确认来源页面和导出格式。
3. 点击“开始导出”，保持导出页可见，等待保存 ZIP。
4. 如果中途停止或有失败，点击“重试未完成”补读文章、重新下载图片并保存新包。

支持的常见入口：

```text
https://www.zhihu.com/column/c_专栏ID
https://www.zhihu.com/xen/market/remix/paid_column/专栏ID
https://www.zhihu.com/market/paid_column/专栏ID/section/章节ID
https://zhuanlan.zhihu.com/p/文章ID
```

标准专栏会自动分页读取完整目录，无需手动滚动到底。相关推荐不会计入文章清单。

扩展优先使用已验证的登录态文章接口；接口只返回试看、正文不一致或不可用时，会显示原因并改用正常文章页读取。页面模式最多同时使用 4 个后台标签页，并显示进度和预计剩余时间。耗时取决于网络、页面加载和文章数量，预估仅供参考。

## 查看导出结果

```text
专栏名-日期.zip
├─ index.html              本地阅读目录（选择 HTML 时）
├─ README.md               文章目录与完成情况
├─ articles/               Markdown 正文
├─ html/                   离线 HTML 正文
├─ assets/                 已下载图片
├─ export-info.json        成功文章、失败原因与原文链接
├─ 未导出章节.txt           文章未完成时生成
└─ 未下载图片.txt           本地图片下载失败时生成
```

停止或中断后，所有未完成文章都会进入补导清单，包括尚未开始的文章；已成功正文仍可保存。重试只补读未完成文章，保存时会重新整理图片和压缩包。

只有完整目录中的全部文章都已导出，且所选本地图片全部下载成功，才会显示“全部导出完成”并写入 `complete: true`。图片失败时会显示原因、标记部分结果，并保留原图片地址；这类图片需要联网查看。保存被取消或拒绝时会明确报错，可点击“再次保存”重新选择位置。

## 权限与隐私

扩展只申请知乎页面、知乎图片、标签页、脚本注入和下载所需权限。不申请 Cookie 权限，不读取或写出 Cookie、登录令牌，也不发送文章到第三方服务。

正文请求沿用浏览器的正常登录态。未登录、未订阅、试看或正文不完整的内容不会被当作全文；扩展不绕过付费权限校验。请只保存自己有权阅读的内容并用于合法的个人用途。

公开仓库和安装包包含程序、合成测试数据及说明，不包含账号配置、真实阅读记录或文章导出包。

## 开发与许可

构建与验证命令见 [开发指南](DEVELOPMENT.md)。代码使用 [MIT License](LICENSE)，捆绑依赖许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
