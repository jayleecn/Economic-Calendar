const { generateAllCalendars } = require('../index.js');

async function main() {
    try {
        console.log('Starting calendar generation...');
        await generateAllCalendars();
        console.log('Calendar generation completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error generating calendars:', error);
        process.exit(1);
    }
}

// 确保脚本执行完成后退出
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

main();
