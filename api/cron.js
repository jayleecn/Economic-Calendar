const { generateICS } = require('../index.js');

// Vercel Cron Job handler - runs daily at 12:00 Beijing time (04:00 UTC)
export default async function handler(req, res) {
  try {
    console.log('Daily update started at:', new Date().toISOString());
    await generateICS();
    console.log('Calendar updated successfully');
    res.status(200).json({ success: true, message: 'Calendar updated successfully' });
  } catch (error) {
    console.error('Error updating calendar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
