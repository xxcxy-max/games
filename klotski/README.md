# 数字华容道 Number Klotski

经典数字滑动拼图（15 Puzzle / Klotski）网页版。单文件实现，零依赖、零构建，打开即玩。

![游戏预览](preview.png)

## 在线试玩

https://games.leonova.xyz/klotski/

## 功能特性

- 🧩 **四种难度**：入门 3x3、初级 4x4、中级 7x7、高级 10x10
- 📊 **计步与计时**：实时统计移动步数和用时
- 💡 **查看答案**：卡关时可查看目标排列
- 🎯 **目标高亮**：高级棋盘自动高亮下一个目标数字位置
- 🌍 **9 种语言**：简体中文、繁体中文、English、日本語、Tiếng Việt、Français、Deutsch、Español、한국어
- 🔊 **音效反馈**：移动音效与胜利音效
- 📱 **响应式设计**：适配桌面与移动端
- 🔍 **SEO 优化**：多语言 meta 动态更新、hreflang、结构化数据、URL 语言参数

## 游戏规则

棋盘上有一个空格，只能移动与空格相邻的数字块。目标是将所有数字按 1、2、3…… 顺序排列，用尽可能少的步数和最短的时间完成。

## 本地运行

无需安装任何东西，直接用浏览器打开 `index.html` 即可。
也可以起一个本地服务器：

```bash
npx serve .
```

## 技术栈

- 纯 HTML5 + CSS3 + 原生 JavaScript，单文件实现
- Tailwind CSS（CDN）实现响应式布局
- 无构建步骤、无外部依赖

## 文件结构

```
klotski/
├── index.html      # 游戏本体（页面 + 样式 + 逻辑 + 9 语言 i18n）
├── background.jpg  # 页面背景图
├── preview.png     # 游戏预览截图（游戏大厅卡片用）
├── move.mp3        # 移动音效
└── victory.mp3     # 胜利音效
```

## 多语言

游戏通过 `?lang=` URL 参数、localStorage 记忆和 IP 属地探测自动选择语言，也可通过页面右上角下拉框手动切换。切换时页面内容、`<title>`、SEO meta 标签（description / keywords / canonical / OG）会同步更新。

---

# Number Klotski

A classic sliding number puzzle (15 Puzzle) for the web. Single-file implementation, zero dependencies, zero build — just open and play.

## Play Online

https://games.leonova.xyz/klotski/

## Features

- 🧩 **4 difficulties**: Beginner 3x3, Easy 4x4, Medium 7x7, Hard 10x10
- 📊 **Move & time tracking** in real time
- 💡 **Show answer** when you get stuck
- 🎯 **Next-target highlight** on the hard board
- 🌍 **9 languages**: 简体中文, 繁體中文, English, 日本語, Tiếng Việt, Français, Deutsch, Español, 한국어
- 🔊 **Sound effects** for moves and victory
- 📱 **Responsive design** for desktop and mobile
- 🔍 **SEO optimized**: dynamic multilingual meta tags, hreflang, structured data, URL language parameter

## How to Play

The board contains numbered tiles and one empty space. You can only move a tile adjacent to the empty space. Arrange all numbers in order from 1, 2, 3... with the fewest moves and shortest time.

## Run Locally

No installation needed — just open `index.html` in a browser, or serve it locally:

```bash
npx serve .
```

## Tech Stack

- Pure HTML5 + CSS3 + vanilla JavaScript, single file
- Tailwind CSS (CDN) for responsive layout
- No build step, no external dependencies
