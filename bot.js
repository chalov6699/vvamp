const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

if (!TOKEN) {
    console.log('[bot] TELEGRAM_BOT_TOKEN не задан в .env, бот не запущен');
    module.exports = null;
    return;
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('[bot] Запущен');

// Приветствие
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'друг';

    const text = `👋 Привет, ${name}!\n\n` +
        `Добро пожаловать в *VAMP SHMOT*.\n\n` +
        `Нажми кнопку ниже, чтобы открыть каталог и сделать заказ.`;

    const opts = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '🛍 Открыть магазин', web_app: { url: 'https://vampshmot.ru' } }
            ], [
                { text: '🔒 Политика конфиденциальности', callback_data: 'privacy' }
            ]]
        }
    };

    bot.sendMessage(chatId, text, opts);
});

// Обработка кнопки "Политика"
bot.on('callback_query', (query) => {
    if (query.data === 'privacy') {
        const policy = `*Политика конфиденциальности*\n\n` +
            `Мы собираем минимальный объём данных:\n` +
            `• Имя и email — для оформления заказа.\n` +
            `• Телефон и адрес — для доставки.\n` +
            `• Данные не передаются третьим лицам, кроме ЮKassa (для оплаты) и службы доставки.\n\n` +
            `По вопросам удаления данных: напишите администратору.`;
        bot.sendMessage(query.message.chat.id, policy, { parse_mode: 'Markdown' });
    }
});

// Рассылка (только для админа)
bot.onText(/\/broadcast (.+)/, (msg, match) => {
    if (String(msg.from.id) !== String(ADMIN_ID)) {
        bot.sendMessage(msg.chat.id, '❌ У вас нет прав для рассылки.');
        return;
    }
    const text = match[1];
    const dbPath = path.join(__dirname, 'database.db');
    // Читаем chat_id из простой таблицы (создадим её)
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS bot_users (chat_id TEXT PRIMARY KEY, first_name TEXT, username TEXT, joined_at TEXT)');
    const users = db.prepare('SELECT chat_id FROM bot_users').all();
    let sent = 0;
    users.forEach((u, i) => {
        setTimeout(() => {
            bot.sendMessage(u.chat_id, text, { parse_mode: 'Markdown' }).catch(() => {});
        }, i * 50); // пауза, чтобы не превысить лимиты
        sent++;
    });
    bot.sendMessage(msg.chat.id, `✅ Рассылка запущена для ${sent} пользователей.`);
});

// Сбор chat_id
bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(__dirname, 'database.db'));
    db.exec('CREATE TABLE IF NOT EXISTS bot_users (chat_id TEXT PRIMARY KEY, first_name TEXT, username TEXT, joined_at TEXT)');
    db.prepare('INSERT OR IGNORE INTO bot_users (chat_id, first_name, username, joined_at) VALUES (?, ?, ?, datetime("now"))')
        .run(String(msg.chat.id), msg.from.first_name || '', msg.from.username || '');
});

module.exports = bot;
