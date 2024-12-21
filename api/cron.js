const { generateICS } = require('../index.js');

// Vercel Serverless Function handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
