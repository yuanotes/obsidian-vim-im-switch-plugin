# Obsidian Vim IM Switch Plugin

## 简介

本插件可以让你在使用 [Obsidian](https://obsidian.md/) 的时候，在启动 Vim键绑定 后，能够自动切换输入法。

在 Vim 模式下切换到 `normal` 的时候，该插件会自动将系统输入法切换到英文状态，在进入 `insert` 或者 `replace` 模式时，则会将输入法切换成中文输入法。

## 依赖

注意：该插件依赖 `fcitx-remote` 命令，插件会通过调用 `fcitx-remote` 来判断系统输入法的状态以及自动切换输入法。

1. 如果你使用 macOS 系统，可以在 https://github.com/xcodebuild/fcitx-remote-for-osx 下载该命令。

2. 如果你使用的是 Linux 系统，则可以通过系统的包管理器安装 `fcitx` 输入法，一般 `fcitx` 输入法会自带 `fcitx-remote` 命令。

3. 如果你使用的是 Windows 系统，我通过AutoHotKey编译了一个简单的版本，可在 [这里](https://github.com/yuanotes/obsidian-vim-im-switch-plugin/releases/download/1.0.3/fcitx-remote.exe) 直接下载exe文件。

## 后续计划

- 支持 [im-select](https://github.com/daipeihust/im-select)

## 捐赠

通过金钱来鞭策我吧。

| 支付宝 | 微信支付 |
|--------| ------- |
|  ![支付宝收款码](./assets/alipay.jpg) | ![微信支付收款码](./assets/wechat_pay.jpg) |
