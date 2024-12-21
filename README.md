# 全球经济日历订阅服务

一个基于华尔街见闻数据的经济日历订阅服务，支持 iCloud、Google Calendar 等主流日历应用。

## 主要功能

- 📅 提供未来 30 天的重要经济事件（⭐️⭐️⭐️）
- 🔄 每天北京时间 0 点自动更新
- 🌏 支持按国家/地区订阅
- 📊 包含事件的实际值、预期值和前值
- 🏳️ 显示国家/地区旗帜和名称

## 支持的国家/地区

- 🇺🇸 美国
- 🇨🇳 中国
- 🇪🇺 欧元区
- 🇯🇵 日本
- 🇬🇧 英国
- 🇦🇺 澳大利亚
- 🇩🇪 德国
- 🇫🇷 法国
- 🇨🇭 瑞士
- 🇨🇦 加拿大
- 🇮🇹 意大利
- 🇳🇿 新西兰

## 如何订阅

### iCloud 日历
1. 在 iPhone 上打开"设置"
2. 前往"日历" > "账户"
3. 选择"添加账户" > "添加订阅的日历"
4. 输入订阅链接：
   - 全球日历：`https://your-domain.com/economic-calendar.ics`
   - 单个国家（以美国为例）：`https://your-domain.com/economic-calendar-united-states.ics`

### Google Calendar
1. 打开 Google Calendar
2. 点击左侧"其他日历"旁的 "+" 按钮
3. 选择"通过 URL 订阅"
4. 输入订阅链接（同上）
5. 点击"添加日历"

## 开发说明

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 启动生产服务器
npm start
```

## 数据来源

数据来自[华尔街见闻](https://wallstreetcn.com/calendar)的经济日历。

## 部署

本项目可以部署在 Vercel 上：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/Economic-Calendar)
