const express = require('express');
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { formatToTimeZone } = require('date-fns-tz');
const { addDays, startOfDay, endOfDay } = require('date-fns');
const { createEvents } = require('ics');
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

// Generate ICS events for a specific country
const generateCountryICS = async (countryCode, events) => {
  const countryName = COUNTRY_CODES[countryCode][0];
  console.log(`Generating calendar for ${countryName} with ${events.length} events`);
  
  // 只保留重要性为 3 的事件
  const importantEvents = events.filter(event => event.importance === 3);
  
  if (importantEvents.length === 0) {
    console.log(`No important events found for ${countryName}`);
    return;
  }

  const calendarEvents = importantEvents.map(event => {
    const startDate = toUTCDate(event.public_date);
    const normalizedCountry = getNormalizedCountry(event.country);
    const emoji = getCountryEmoji(normalizedCountry);

    return {
      uid: event.calendar_key,
      start: [
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
        startDate.getUTCDate(),
        startDate.getUTCHours(),
        startDate.getUTCMinutes()
      ],
      end: [
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
        startDate.getUTCDate(),
        startDate.getUTCHours(),
        startDate.getUTCMinutes()
      ],
      title: `${event.title}`,
      description: '',
      location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous)
    };
  });

  return new Promise((resolve, reject) => {
    createEvents(calendarEvents, (error, value) => {
      if (error) {
        console.error(`Error creating ICS for ${countryName}:`, error);
        reject(error);
      } else {
        const fileName = COUNTRY_NAMES[countryCode] || countryCode.toLowerCase();
        const filePath = path.join(publicDir, `economic-calendar-${fileName}.ics`);
        try {
          fs.writeFileSync(filePath, value);
          console.log(`Successfully wrote calendar file for ${countryName} to ${filePath}`);
          resolve(value);
        } catch (error) {
          console.error(`Error writing file for ${countryName}:`, error);
          reject(error);
        }
      }
    });
  });
};

// Generate all ICS files
async function generateICS() {
  try {
    // 先更新国家代码
    await updateCountryCodes();
    
    console.log('Generating ICS files...');
    
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

    // Group events by normalized country
    const eventsByCountry = {};
    importantEvents.forEach(event => {
      const normalizedCountry = getNormalizedCountry(event.country);
      if (normalizedCountry) {
        if (!eventsByCountry[normalizedCountry]) {
          eventsByCountry[normalizedCountry] = [];
        }
        eventsByCountry[normalizedCountry].push(event);
      }
    });

    // Generate combined calendar
    const allEvents = importantEvents.map(event => {
      const startDate = toUTCDate(event.public_date);
      const normalizedCountry = getNormalizedCountry(event.country);
      const emoji = getCountryEmoji(normalizedCountry);

      return {
        uid: event.calendar_key,
        start: [
          startDate.getUTCFullYear(),
          startDate.getUTCMonth() + 1,
          startDate.getUTCDate(),
          startDate.getUTCHours(),
          startDate.getUTCMinutes()
        ],
        end: [
          startDate.getUTCFullYear(),
          startDate.getUTCMonth() + 1,
          startDate.getUTCDate(),
          startDate.getUTCHours(),
          startDate.getUTCMinutes()
        ],
        title: `${event.title}`,
        description: '',
        location: formatLocation(emoji, event.country, event.actual, event.forecast, event.previous)
      };
    });

    // Generate combined calendar
    await new Promise((resolve, reject) => {
      createEvents(allEvents, (error, value) => {
        if (error) {
          console.error('Error creating combined ICS:', error);
          reject(error);
        } else {
          fs.writeFileSync(path.join(publicDir, 'economic-calendar.ics'), value);
          console.log('Generated combined ICS file');
          resolve(value);
        }
      });
    });

    // Generate individual country calendars
    const countryPromises = Object.entries(eventsByCountry).map(([country, events]) => {
      return generateCountryICS(country, events);
    });

    await Promise.all(countryPromises);
    console.log('All ICS files generated successfully');

    // Update index.html with generation time
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let indexContent = await fsp.readFile(indexPath, 'utf8');
    indexContent = indexContent.replace(
      /日历生成时间：.*。<\/p>/,
      `日历生成时间：${timeString}。`
    );
    await fsp.writeFile(indexPath, indexContent, 'utf8');
    
    console.log('Calendar generated successfully at:', timeString);
  } catch (error) {
    console.error('Error generating ICS files:', error);
    throw error;
  }
};

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Serve static files
app.use(express.static('public'));

// API endpoint to generate ICS file
app.get('/generate', async (req, res) => {
  try {
    await generateICS();
    res.send({ success: true });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Start server if running directly (not in Vercel)
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    generateICS();
  });
}

// Export for Vercel
module.exports = app;
