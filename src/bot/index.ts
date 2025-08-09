import { Telegraf } from 'telegraf';
import { TELEGRAM_BOT_TOKEN } from '../config.js';
import { registerCommands } from './commands.js';

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Missing TELEGRAM_BOT_TOKEN in environment');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
registerCommands(bot);

bot.launch().then(() => {
    console.log('TON Dice bot is running');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


