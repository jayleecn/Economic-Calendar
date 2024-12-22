const { generateAllCalendars } = require('../index.js');

async function main() {
    try {
        console.log('Starting calendar generation...');
        await generateAllCalendars();
        console.log('Calendar generation completed');
        process.exit(0);
    } catch (error) {
        console.error('Error generating calendars:', error);
        process.exit(1);
    }
}

main();
