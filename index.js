const express = require('express');
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { addDays, startOfDay, endOfDay } = require('date-fns');
const ical = require('ical-generator').default;
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
const COUNTRY_EMOJIS = Object.fromEntries(
  Object.keys(COUNTRY_NAMES).map(countryCode => [countryCode, countryFlagEmoji.get(countryCode)?.emoji || ''])
);

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
  const values = [];
  if (actual !== null && actual !== '') values.push(`今值: ${actual}`);
  if (forecast !== null && forecast !== '') values.push(`预期: ${forecast}`);
  if (previous !== null && previous !== '') values.push(`前值: ${previous}`);
  return values.length > 0 ? `${emoji}${country} | ${values.join(' | ')}` : `${emoji}${country}`;
};

// 生成日历内容
async function generateCalendarContent() {
  try {
    // 先更新国家代码
    await updateCountryCodes();
    
    console.log('Generating calendar content...');
    
    // Calculate time range (Beijing time)
    const now = new Date();
    const startTime = startOfDay(now);
    const endTime = endOfDay(addDays(now, 30));

    console.log('Fetching events from', startTime, 'to', endTime);

    // Fetch events
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: {
        start: Math.floor(startTime.getTime() / 1000),
        end: Math.floor(endTime.getTime() / 1000),
      },
    });

    const items = response.data.data.items;
    console.log(`Fetched ${items.length} events`);

    // Filter important events
    const importantEvents = items.filter(event => event.importance === 3);
    console.log(`Filtered ${importantEvents.length} important events (importance = 3)`);

    // Create calendar
    const calendar = ical({
      name: 'Economic Calendar',
      timezone: 'Asia/Shanghai'
    });

    for (const event of importantEvents) {
      const startDate = toUTCDate(event.public_date);
      const emoji = getCountryEmoji(event.country_id);
      calendar.createEvent({
        start: startDate,
        end: startDate,
        summary: event.title,
        description: event.title,
        location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous),
      });
    }

    return calendar.toString();
  } catch (error) {
    console.error('Error generating calendar content:', error);
    throw error;
  }
}

// 生成单个国家的日历内容
async function generateCountryCalendar(countryId, countryName) {
  try {
    console.log(`Generating calendar for ${countryId} (${countryName})...`);
    
    // Calculate time range (Beijing time)
    const now = new Date();
    const startTime = startOfDay(now);
    const endTime = endOfDay(addDays(now, 30));

    console.log('Fetching events from', startTime, 'to', endTime);

    // Fetch events
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: {
        start: Math.floor(startTime.getTime() / 1000),
        end: Math.floor(endTime.getTime() / 1000),
        country: countryId,
      },
    });

    const items = response.data.data.items;
    console.log(`Fetched ${items.length} events for ${countryId}`);

    // Filter important events
    const importantEvents = items.filter(event => event.importance === 3);
    console.log(`Filtered ${importantEvents.length} important events (importance = 3)`);

    // 如果没有重要事件，返回 null
    if (importantEvents.length === 0) {
      return null;
    }

    // Create calendar
    const calendar = ical({
      name: `${countryName} Economic Calendar`,
      timezone: 'Asia/Shanghai'
    });

    for (const event of importantEvents) {
      const startDate = toUTCDate(event.public_date);
      const emoji = getCountryEmoji(event.country_id);
      calendar.createEvent({
        start: startDate,
        end: startDate,
        summary: event.title,
        description: event.title,
        location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous),
      });
    }

    return calendar.toString();
  } catch (error) {
    console.error(`Error generating calendar for ${countryId}:`, error);
    throw error;
  }
}

// 生成所有日历
async function generateAllCalendars() {
  try {
    console.log('Generating all calendars...');
    
    // 确保 public 目录存在
    const publicDir = path.join(__dirname, 'public');
    await fs.promises.mkdir(publicDir, { recursive: true });
    
    // Calculate time range (Beijing time)
    const now = new Date();
    const startTime = startOfDay(now);
    const endTime = endOfDay(addDays(now, 30));

    console.log('Fetching events from', startTime, 'to', endTime);

    // 获取所有事件
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: {
        start: Math.floor(startTime.getTime() / 1000),
        end: Math.floor(endTime.getTime() / 1000),
      },
    });

    const items = response.data.data.items;
    console.log(`Fetched ${items.length} events`);

    // 筛选重要事件
    const importantEvents = items.filter(event => event.importance === 3);
    console.log(`Filtered ${importantEvents.length} important events (importance = 3)`);

    // 按国家分组
    const eventsByCountry = {};
    importantEvents.forEach(event => {
      if (!eventsByCountry[event.country]) {
        eventsByCountry[event.country] = {
          events: [],
          country_id: event.country_id,
          country_name: event.country
        };
      }
      eventsByCountry[event.country].events.push(event);
    });

    // 生成全球日历
    const calendar = ical({
      name: 'Economic Calendar',
      timezone: 'Asia/Shanghai'
    });

    for (const event of importantEvents) {
      const startDate = toUTCDate(event.public_date);
      const emoji = getCountryEmoji(event.country_id);
      calendar.createEvent({
        start: startDate,
        end: startDate,
        summary: event.title,
        description: event.title,
        location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous)
      });
    }

    // 保存全球日历
    const globalCalendarPath = path.join(publicDir, 'economic-calendar.ics');
    await fs.promises.writeFile(globalCalendarPath, calendar.toString());
    console.log('Global calendar generated');

    // 为每个国家生成日历
    for (const [country, data] of Object.entries(eventsByCountry)) {
      // 检查是否有对应的标准国家名称
      const countryName = COUNTRY_NAMES[data.country_id];
      if (!countryName) {
        console.log(`Skipping ${country} (${data.country_id}): no standard name found`);
        continue;
      }

      const countryCalendar = ical({
        name: `${country} Economic Calendar`,
        timezone: 'Asia/Shanghai'
      });

      for (const event of data.events) {
        const startDate = toUTCDate(event.public_date);
        const emoji = getCountryEmoji(event.country_id);
        countryCalendar.createEvent({
          start: startDate,
          end: startDate,
          summary: event.title,
          description: event.title,
          location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous)
        });
      }

      const fileName = `economic-calendar-${countryName}.ics`;
      const filePath = path.join(publicDir, fileName);
      await fs.promises.writeFile(filePath, countryCalendar.toString());
      console.log(`Calendar generated for ${country} (${countryName}): ${data.events.length} events`);
    }

    // 更新 index.html 中的生成时间
    const indexPath = path.join(publicDir, 'index.html');
    let indexContent = await fs.promises.readFile(indexPath, 'utf8');
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8小时的毫秒数
    const currentTime = beijingTime.toISOString().slice(0, 16).replace('T', ' ');
    indexContent = indexContent.replace(
      /日历最后生成时间：.*。/,
      `日历最后生成时间：${currentTime}。`
    );
    await fs.promises.writeFile(indexPath, indexContent, 'utf8');
    console.log('All calendars generated successfully');
  } catch (error) {
    console.error('Error generating calendars:', error);
    throw error;
  }
}

// API endpoint to generate calendar
app.get('/api/generate', async (req, res) => {
  try {
    await generateAllCalendars();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Error generating calendar:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

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
