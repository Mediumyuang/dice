TON Dice (MVP)

Коротко: Telegram-бот (telegraf) с provably fair dice, виртуальный баланс в SQLite (better-sqlite3). Web-приложение пока заглушка под будущий Vite + React + TON Connect.

Технологии:
- Telegram bot: telegraf
- БД: SQLite через better-sqlite3 (по умолчанию). Можно указать DB_PATH=":memory:" для in-memory
- Provably fair: serverSeed (секрет), clientSeed (по умолчанию telegram id), nonce. Сначала публикуется hash(serverSeed), затем по /proof раскрывается serverSeed
- Тесты: vitest

Установка и запуск:
1) Заполнить `.env` по примеру `.env.example`
2) Установить зависимости:
```
npm install
```
3) Запуск в dev-режиме:
```
npm run dev
```
4) Сборка и запуск:
```
npm run build
npm start
```
5) Тесты:
```
npm test
```

Переменные окружения (.env.example):
- TELEGRAM_BOT_TOKEN — токен бота
- NODE_ENV — режим
- PORT — зарезервировано (на будущее)
- SERVER_SEED_SECRET — секрет для генерации serverSeed
- DB_PATH — путь к базе (./data.sqlite или :memory:)
- START_BALANCE — стартовый баланс (по умолчанию 1000)
- MIN_BET, MAX_BET — лимиты ставок
- HOUSE_EDGE_BPS — house edge в базисных пунктах (100 = 1.00%)
 - WEBAPP_URL — URL Mini App (по умолчанию http://localhost:5173)

Команды бота:
- /start: создаёт аккаунт (если нет), выдаёт стартовый баланс и показывает serverSeedHash
- /help: краткая справка
- /bet <число 1–100> <сумма>: ставит на выпадение РОЛЛ < числа
- /roll: крутит текущую ставку, учитывает house edge, обновляет баланс, пишет пруф-данные (hash, clientSeed, nonce)
- /proof: раскрывает прошлый serverSeed и мгновенно создаёт новый serverSeedHash для следующего раунда
 - /mini: присылает кнопку для открытия Mini App внутри Telegram

Структура проекта:
```
/src/bot/index.ts           — инициализация бота
/src/bot/commands.ts        — обработчики команд
/src/core/provablyFair.ts   — provably fair RNG, хэширование
/src/core/rng.ts            — утилиты RNG/крипто
/src/db/index.ts            — SQLite-обёртка, таблицы users/pending_bets/bets
/src/types.ts               — основные типы
/src/config.ts              — конфиг из .env
/web/README.md              — заглушка под будущий Vite+React WebApp с TON Connect
/tests/provablyFair.test.ts — тесты критической логики provably fair
```

Замечания:
- Минимум зависимостей, без скрытых подкруток. Пэйаут: (100% − edge) / target%.
- Любой новый файл кратко описан в этом README.
- Первая итерация — без TON-платежей. Только механика dice + provably fair + виртуальный баланс.

Деплой Mini App на Vercel (быстро):
1) Войти в Vercel CLI и привязать проект `web/` как отдельный фронтенд:
```
cd web
npm i
npx vercel login
npx vercel init  # если запрашивает
npx vercel --prod
```
2) Полученный https-домен (например, `https://ton-dice-web.vercel.app`) пропишите в `.env` в корне:
```
WEBAPP_URL=https://ton-dice-web.vercel.app
```
3) Перезапустить бота:
```
npm run dev
```
4) В Telegram команда `/mini` выдаст кнопку Mini App; `/start` покажет кнопочную клавиатуру с WebApp.


