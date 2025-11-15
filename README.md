# YouTube汇率转换器

[English Version](README.en.md)

## 简介
该 Chrome 扩展在 YouTube 直播页面中实时将 Super Chat、Super Sticker 等金额转换成人民币显示，方便国内用户快速了解价值。

## 功能
- 监听直播聊天室中的 Super Chat、Super Sticker、会员提醒等金额。
- 调用可配置的汇率接口，自动更新汇率并缓存本地。
- 允许在弹窗中启用或禁用转换，并查看最近一次汇率更新时间。

## 安装
- [chrome应用商店地址](https://chromewebstore.google.com/detail/nbijejcmoahflnldhgeplicafjpffnhp?utm_source=item-share-cb)

## 使用
打开任意 YouTube 直播或回放页面，扩展会自动转换聊天室金额；通过工具栏图标进入弹窗可切换启用状态。

## 配置
- 文件：`config.js`
- 修改 `RATE_API_URL` 指向自定义汇率服务，后台脚本会定期刷新数据。

## 开发
主要逻辑位于 `content.js`、`background.js` 等脚本，可视需求扩展币种或界面。

## 许可证
本项目遵循 [Apache License 2.0](LICENSE)；英文说明见 [README.en.md](README.en.md)。
