const express = require('express');
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { formatToTimeZone } = require('date-fns-tz');
const { addDays, startOfDay, endOfDay } = require('date-fns');
const ical = require('ical-generator');
const countryFlagEmoji = require('country-flag-emoji');

const app = express();
const PORT = process.env.PORT || 3000;

// 国家代码映射
let COUNTRY_CODES = {};

// 国家代码和名称映射
const COUNTRY_NAMES = {
  'AU': 'australia',
  'EA': 'eurozone',
  'CN': 'china',
  'FR': 'france',
  'CA': 'canada',
  'CH': 'switzerland',
  'DE': 'germany',
  'US': 'united-states',
  'IT': 'italy',
  'UK': 'united-kingdom',
  'JP': 'japan',
  'NZ': 'new-zealand',
  'ES': 'spain',
  'KR': 'south-korea',
  'HK': 'hong-kong',
  'SG': 'singapore',
  'NO': 'norway',
  'SE': 'sweden'
};

// 国家代码和emoji映射
const COUNTRY_EMOJIS = {
  'AU': '🇦🇺',
  'EA': '🇪🇺',
  'CN': '🇨🇳',
  'FR': '🇫🇷',
  'CA': '🇨🇦',
  'CH': '🇨🇭',
  'DE': '🇩🇪',
  'US': '🇺🇸',
  'IT': '🇮🇹',
  'UK': '🇬🇧',
  'JP': '🇯🇵',
  'NZ': '🇳🇿',
  'ES': '🇪🇸',
  'KR': '🇰🇷',
  'HK': '🇭🇰',
  'SG': '🇸🇬',
  'NO': '🇳🇴',
  'SE': '🇸🇪'
};

// 更新国家代码映射
const updateCountryCodes = async () => {
  try {
    console.log('Updating country codes from API...');
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/countries');
    if (!response.data?.data?.items || !Array.isArray(response.data.data.items)) {
      console.error('Invalid country API response format:', response.data);
      return;
    }

    const newCountryCodes = {};
    response.data.data.items.forEach(item => {
      newCountryCodes[item.country_id] = [item.country_name, item.flag_uri];
    });

    COUNTRY_CODES = newCountryCodes;
    console.log(`Updated country codes, total: ${Object.keys(COUNTRY_CODES).length} countries`);
  } catch (error) {
    console.error('Error updating country codes:', error);
  }
};

// 获取标准化的国家代码
const getNormalizedCountry = (country) => {
  // 先尝试直接匹配国家代码
  if (COUNTRY_CODES[country]) {
    return country;
  }
  
  // 再尝试匹配中文名称
  for (const [code, [name]] of Object.entries(COUNTRY_CODES)) {
    if (country === name) {
      return code;
    }
  }
  
  return null;
};

// 获取国家的emoji
const getCountryEmoji = (countryCode) => {
  return COUNTRY_EMOJIS[countryCode] || '';
};

// Convert timestamp to UTC Date object (considering Beijing timezone)
const toUTCDate = (timestamp) => {
  // 创建北京时间的 Date 对象
  const date = new Date(timestamp * 1000);
  // 转换为北京时间（UTC+8）
  const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const utcDate = new Date(date.getTime() + beijingOffset);
  return utcDate;
};

// Get country flag emoji
const getFlag = (countryCode) => {
  try {
    return countryFlagEmoji.get(countryCode)?.emoji || '';
  } catch {
    return '';
  }
};

// Get importance stars
const getImportanceStars = (importance) => {
  return '⭐️'.repeat(importance || 1);
};

// Format description with actual, forecast and previous values
const formatDescription = (actual, forecast, previous) => {
  const parts = [];
  if (actual !== undefined && actual !== null && actual !== '') {
    parts.push(`今值: ${actual}`);
  }
  if (forecast !== undefined && forecast !== null && forecast !== '') {
    parts.push(`预期: ${forecast}`);
  }
  if (previous !== undefined && previous !== null && previous !== '') {
    parts.push(`前值: ${previous}`);
  }
  return parts.join(' | ');
};

// Format location with country and values
const formatLocation = (emoji, country, actual, forecast, previous) => {
  const values = formatDescription(actual, forecast, previous);
  return values ? `${emoji} ${country} | ${values}` : `${emoji} ${country}`;
};

// 生成日历内容
async function generateCalendarContent() {
  try {
    // 先更新国家代码
    await updateCountryCodes();
    
    console.log('Generating calendar content...');
    
    // Calculate time range (Beijing time)
    const now = new Date();
    const start = Math.floor(startOfDay(now).getTime() / 1000); // 从今天开始
    const end = Math.floor(endOfDay(addDays(now, 30)).getTime() / 1000); // 到30天后

    console.log(`Time range: ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);

    // Fetch data from API
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: { start, end }
    });

    if (!response.data?.data?.items || !Array.isArray(response.data.data.items)) {
      console.error('Invalid API response format:', response.data);
      throw new Error('Invalid API response format');
    }

    const items = response.data.data.items;
    console.log(`Received ${items.length} events from API`);

    // 只保留重要性为 3 的事件
    const importantEvents = items.filter(event => event.importance === 3);
    console.log(`Filtered ${importantEvents.length} important events (importance = 3)`);

    const calendar = ical({ name: 'Economic Calendar' });

    for (const event of importantEvents) {
      const startDate = toUTCDate(event.public_date);
      const normalizedCountry = getNormalizedCountry(event.country);
      const emoji = getCountryEmoji(normalizedCountry);

      calendar.createEvent({
        start: startDate,
        end: new Date(startDate.getTime() + 60 * 60 * 1000), // 1小时后
        summary: event.title,
        description: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous),
      });
    }

    return calendar.toString();
  } catch (error) {
    console.error('Error generating calendar content:', error);
    throw error;
  }
}

// API endpoint to generate calendar
app.get('/api/generate', async (req, res) => {
  try {
    const calendarContent = await generateCalendarContent();
    
    // 如果不是在 Vercel 环境，则保存到文件
    if (!process.env.VERCEL) {
      await fs.promises.writeFile(
        path.join(__dirname, 'public', 'economic-calendar.ics'),
        calendarContent
      );
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/calendar',
      'Content-Disposition': 'attachment; filename=economic-calendar.ics'
    });
    res.end(calendarContent);
  } catch (error) {
    console.error('Error generating calendar:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Serve static files
app.use(express.static('public'));

// Start server if running directly (not in Vercel)
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Export for Vercel
module.exports = app;
