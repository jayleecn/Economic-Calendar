const express = require('express');
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { addDays, startOfDay, endOfDay, subDays } = require('date-fns');
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
function getNormalizedCountry(country) {
  const countryMap = {
    '中国': 'china',
    '美国': 'united-states',
    '欧元区': 'eurozone',
    '日本': 'japan',
    '英国': 'united-kingdom',
    '澳大利亚': 'australia',
    '加拿大': 'canada',
    '瑞士': 'switzerland',
    '德国': 'germany',
    '法国': 'france',
    '意大利': 'italy',
    '新西兰': 'new-zealand',
    '西班牙': 'spain',
    '韩国': 'south-korea',
    '香港': 'hong-kong',
    '新加坡': 'singapore',
    '挪威': 'norway',
    '瑞典': 'sweden'
  };
  return countryMap[country] || country.toLowerCase().replace(/\s+/g, '-');
}

// 获取国家的emoji
const getCountryEmoji = (countryCode) => {
  return COUNTRY_EMOJIS[countryCode] || '';
};

// Convert timestamp to UTC Date object (considering Beijing timezone)
const toUTCDate = (timestamp) => {
  return new Date(timestamp * 1000);
};

// Get country flag emoji
const getFlag = (countryCode) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

// Get importance stars
const getImportanceStars = (importance) => {
  return '⭐️'.repeat(importance);
};

// Format description with actual, forecast and previous values
const formatDescription = (actual, forecast, previous) => {
  const parts = [];
  if (actual !== null && actual !== '') {
    parts.push(`今值: ${actual}`);
  }
  if (forecast !== null && forecast !== '') {
    parts.push(`预期: ${forecast}`);
  }
  if (previous !== null && previous !== '') {
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
    
    // 获取时间范围
    const now = new Date();
    const startTime = Math.floor(now.getTime() / 1000);
    const endTime = Math.floor(addDays(now, 7).getTime() / 1000);

    console.log('Fetching events from', startTime, 'to', endTime);

    // Fetch events
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: {
        start: startTime,
        end: endTime,
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
    // 先更新国家代码
    await updateCountryCodes();
    
    console.log(`Generating calendar for ${countryName}...`);
    
    // 获取时间范围
    const now = new Date();
    const startTime = Math.floor(now.getTime() / 1000);
    const endTime = Math.floor(addDays(now, 7).getTime() / 1000);

    console.log('Fetching events from', startTime, 'to', endTime);

    // Fetch events
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: {
        start: startTime,
        end: endTime,
      },
    });

    const items = response.data.data.items;
    console.log(`Fetched ${items.length} events`);

    // Filter important events for the specific country
    const countryEvents = items.filter(event => 
      event.importance === 3 && event.country_id === countryId
    );
    console.log(`Filtered ${countryEvents.length} important events for ${countryName}`);

    // Create calendar
    const calendar = ical({
      name: `${countryName}经济日历`,
      timezone: 'Asia/Shanghai'
    });

    for (const event of countryEvents) {
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
    console.error(`Error generating calendar for ${countryName}:`, error);
    throw error;
  }
}

// 更新首页生成时间
async function updateGenerationTime() {
  try {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const filePath = path.join(__dirname, 'public', 'index.html');
    let content = await fsp.readFile(filePath, 'utf8');
    
    // 使用更简单的替换方式
    const searchString = '日历最后生成时间：';
    const startIndex = content.indexOf(searchString);
    if (startIndex === -1) {
      console.error('Could not find generation time string');
      return;
    }
    
    const endIndex = content.indexOf('</p>', startIndex);
    if (endIndex === -1) {
      console.error('Could not find closing p tag');
      return;
    }
    
    const newContent = content.substring(0, startIndex + searchString.length) +
                      formattedTime +
                      content.substring(endIndex);
    
    await fsp.writeFile(filePath, newContent);
    console.log('Generation time updated successfully:', formattedTime);
  } catch (error) {
    console.error('Error updating generation time:', error);
    throw error;
  }
}

// 生成所有日历
async function generateAllCalendars() {
  try {
    console.log('Generating all calendars...');
    
    // 获取时间范围
    const now = new Date();
    const startTime = Math.floor(now.getTime() / 1000);
    const endTime = Math.floor(addDays(now, 7).getTime() / 1000);

    console.log('Fetching events from', startTime, 'to', endTime);

    // 获取所有事件
    const response = await axios.get('https://api-one-wscn.awtmt.com/apiv1/finance/macrodatas', {
      params: {
        start: startTime,
        end: endTime,
      },
    });

    const items = response.data.data.items;
    console.log(`Fetched ${items.length} events`);

    // 筛选重要事件
    const importantEvents = items.filter(event => event.importance === 3);
    console.log(`Filtered ${importantEvents.length} important events (importance = 3)`);

    // 生成全球日历
    const calendar = ical({
      name: '全球经济日历',
      timezone: 'Asia/Shanghai'
    });

    // 添加所有重要事件到全球日历
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

    // 保存全球日历
    await fsp.writeFile(path.join(__dirname, 'public', 'economic-calendar.ics'), calendar.toString());
    console.log('Global calendar generated successfully');

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

    // 生成各个国家的日历
    for (const countryData of Object.values(eventsByCountry)) {
      const countryCalendar = ical({
        name: `${countryData.country_name}经济日历`,
        timezone: 'Asia/Shanghai'
      });

      for (const event of countryData.events) {
        const startDate = toUTCDate(event.public_date);
        const emoji = getCountryEmoji(event.country_id);
        countryCalendar.createEvent({
          start: startDate,
          end: startDate,
          summary: event.title,
          description: event.title,
          location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous),
        });
      }

      const normalizedCountry = getNormalizedCountry(countryData.country_name);
      await fsp.writeFile(
        path.join(__dirname, 'public', `economic-calendar-${normalizedCountry}.ics`),
        countryCalendar.toString()
      );
      console.log(`Calendar for ${countryData.country_name} generated successfully`);
    }

    // 更新生成时间
    await updateGenerationTime();
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

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 导出函数供构建脚本使用
module.exports = {
  generateAllCalendars
};

// 只在直接运行时启动服务器（不是被 require 时）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
