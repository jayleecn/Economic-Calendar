const { generateAllCalendars } = require('../index.js');
const fs = require('fs').promises;
const path = require('path');

async function updateGenerationTime() {
    const indexPath = path.join(__dirname, '../public/index.html');
    try {
        let content = await fs.readFile(indexPath, 'utf8');
        const now = new Date();
        const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // 更新生成时间
        content = content.replace(
            /日历最后生成时间：.*?。/,
            `日历最后生成时间：${formattedTime}。`
        );
        
        await fs.writeFile(indexPath, content, 'utf8');
        console.log('Generation time updated successfully');
    } catch (error) {
        console.error('Error updating generation time:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('Starting calendar generation...');
        await generateAllCalendars();
        await updateGenerationTime();
        console.log('Calendar generation and time update completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

// 确保脚本执行完成后退出
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

main();
