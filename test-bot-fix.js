import { Telegraf } from 'telegraf';
import { TELEGRAM_BOT_TOKEN } from './src/config.js';

console.log('Testing fixed imports...');
console.log('Token exists:', !!TELEGRAM_BOT_TOKEN);
console.log('Token length:', TELEGRAM_BOT_TOKEN?.length || 0);

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Token missing');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

bot.telegram.getMe()
    .then(me => {
        console.log('✅ Bot connection successful:', me);
        console.log('✅ Imports fixed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Bot error:', error.message);
        process.exit(1);
    });
