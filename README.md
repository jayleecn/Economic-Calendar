# Economic Calendar Subscription Service

A service that provides Chinese macroeconomic events calendar through iCloud/Google Calendar subscription.

## Features

- Provides economic events for the past 7 days and upcoming 7 days
- Updates daily at 00:00 (Beijing Time)
- Supports iCloud and Google Calendar subscription
- Includes actual, forecast, and previous values for each event

## How to Subscribe

### iCloud Calendar
1. Open iPhone Settings
2. Go to Calendar > Accounts > Add Account
3. Select "Add Calendar Subscription"
4. Enter the subscription URL: `https://your-vercel-url.com/cal.ics`

### Google Calendar
1. Open Google Calendar
2. Click the "+" button next to "Other calendars"
3. Select "From URL"
4. Enter the subscription URL: `https://your-vercel-url.com/cal.ics`
5. Click "Add calendar"

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Start production server
npm start
```
