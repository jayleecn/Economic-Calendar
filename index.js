const express = require('express');
const axios = require('axios');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');
const { formatToTimeZone } = require('date-fns-tz');
const { addDays, startOfDay, endOfDay } = require('date-fns');
const { createEvents } = require('ics');
const countryFlagEmoji = require('country-flag-emoji');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// Convert timestamp to UTC Date object
const toUTCDate = (timestamp) => {
  return new Date(timestamp * 1000);
};

// Get country flag emoji
const getFlag = (countryCode) => {
  try {
    return countryFlagEmoji.get(countryCode)?.emoji || '';
  } catch {
    return '';
  }
};

// Format event description
const formatDescription = (actual, forecast, previous) => {
  return `今值 ${actual || '-'}，预期 ${forecast || '-'}，前值 ${previous || '-'}`;
};

// Generate ICS events
const generateICS = async () => {
  try {
    console.log('Generating ICS file...');
    
    // Calculate time range (Beijing time)
    const now = new Date();
    const start = Math.floor(startOfDay(addDays(now, -7)).getTime() / 1000);
    const end = Math.floor(endOfDay(addDays(now, 7)).getTime() / 1000);

    console.log(`Time range: ${start} to ${end}`);

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

    const events = items.map(event => {
      console.log('Processing event:', event);
      const startDate = toUTCDate(event.public_date);
      const endDate = new Date(startDate.getTime() + 60000); // Add 1 minute

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
          endDate.getUTCFullYear(),
          endDate.getUTCMonth() + 1,
          endDate.getUTCDate(),
          endDate.getUTCHours(),
          endDate.getUTCMinutes()
        ],
        title: `${getFlag(event.country_id)} ${event.title}`,
        description: formatDescription(event.actual, event.forecast, event.previous),
        location: `${getFlag(event.country_id)} ${event.country}`
      };
    });

    return new Promise((resolve, reject) => {
      createEvents(events, (error, value) => {
        if (error) {
          console.error('Error creating ICS events:', error);
          reject(error);
        } else {
          const filePath = path.join(publicDir, 'cal.ics');
          writeFileSync(filePath, value);
          console.log(`ICS file generated successfully at ${filePath}`);
          resolve(value);
        }
      });
    });
  } catch (error) {
    console.error('Error generating ICS file:', error);
    throw error;
  }
};

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Generate initial ICS file
  generateICS().catch(error => {
    console.error('Failed to generate initial ICS file:', error);
  });
  
  // Schedule daily updates at 00:00 Beijing time
  setInterval(async () => {
    try {
      const now = new Date();
      const beijingTime = formatToTimeZone(now, 'HH:mm', { timeZone: 'Asia/Shanghai' });
      
      if (beijingTime === '00:00') {
        console.log('Running scheduled update...');
        await generateICS();
      }
    } catch (error) {
      console.error('Failed to run scheduled update:', error);
    }
  }, 60000); // Check every minute
});
