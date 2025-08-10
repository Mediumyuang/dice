# TON Dice Bank

Оффчейн-банк для Dice-игры с интеграцией Telegram WebApp и TON кошельков.

## 🚀 Возможности

- ✅ Исправленный детект Telegram WebApp
- ✅ Интеграция с TonConnect для TON кошельков
- ✅ Оффчейн-банк с депозитами и выводами
- ✅ Проверяемая честность игры
- ✅ Автоматический пуллер депозитов
- ✅ Supabase PostgreSQL база данных

## 🛠 Технологии

- **Frontend**: Vite + React + TypeScript
- **Backend**: Node.js + Express + Prisma
- **Database**: Supabase PostgreSQL
- **Blockchain**: TON + TonConnect
- **Telegram**: WebApp API

## 📋 Настройка

### 1. Переменные окружения

Создайте файлы `.env` в корне проекта и `web/.env.local`:

```bash
# .env (backend)
TREASURY_ADDRESS=<EQ... ваш адрес казны>
WITHDRAW_PRIVATE_KEY=<seed/private key кошелька для вывода>
VITE_TG_BOT_USERNAME=<имя бота без @>

# Supabase / Postgres
DATABASE_URL=postgresql://postgres:Batlvol5690@fssuowsdqtolbdjkyxvu.supabase.co:5432/postgres

# tonapi
TON_API_KEY=AE2AXH33J4FXT7AAAAAAQKOWZ46XVTOZQAUJ764DWTDAQ2ZLSQMVBDLVCLXUFIFROV7HVUA

# фронт
VITE_PUBLIC_WEBAPP_URL=https://<ваш_домен_мини_аппы>
```

```bash
# web/.env.local (frontend)
VITE_TG_BOT_USERNAME=<имя бота без @>
VITE_PUBLIC_WEBAPP_URL=https://<ваш_домен_мини_аппы>
```

### 2. Установка зависимостей

```bash
# Backend
npm install

# Frontend
npm run web:install
```

### 3. Настройка базы данных

```bash
# Генерация Prisma клиента
npm run db:generate

# Применение схемы к базе данных
npm run db:push
```

### 4. Обновление манифеста TonConnect

Отредактируйте `web/public/tonconnect-manifest.json`:

```json
{
  "url": "https://<ваш_домен_мини_аппы>",
  "name": "Dice Bank",
  "iconUrl": "https://<ваш_домен_мини_аппы>/icon.png"
}
```

## 🚀 Запуск

### Разработка

```bash
# Backend API (терминал 1)
npm run dev:api

# Пуллер депозитов (терминал 2)
npm run dev:puller

# Frontend (терминал 3)
npm run web:dev
```

### Продакшн

```bash
# Сборка
npm run build
npm run web:build

# Запуск
npm run start:api
npm run start:puller
```

## 📱 Использование

1. **Telegram Bot**: Создайте бота через @BotFather
2. **WebApp URL**: Укажите URL вашего фронтенда в настройках бота
3. **Деплой**: Разверните на Vercel/Netlify
4. **Тестирование**: Откройте бота и запустите Mini App

## 🔧 API Endpoints

- `GET /api/health` - Проверка состояния
- `GET /api/balance?tg_id=...` - Получить баланс
- `GET /api/ledger?tg_id=...` - История транзакций
- `POST /api/bet` - Сделать ставку
- `POST /api/withdraw` - Вывод средств
- `POST /api/deposit` - Обработка депозитов (внутренний)

## 🎲 Игровая механика

- **Target**: 1-99 (вероятность выигрыша)
- **Коэффициент**: `(100 / target) * 0.98` (2% комиссия)
- **Условие выигрыша**: `roll < target`
- **RNG**: `crypto.randomInt(0, 100)`

## 🔒 Безопасность

- Валидация Telegram ID через заголовки
- Транзакционная обработка ставок
- Проверка дублирования транзакций
- Лимиты на выводы

## 📊 Мониторинг

Пуллер депозитов проверяет транзакции каждые 10 секунд:
- Фильтрует входящие транзакции
- Проверяет формат memo: `GAME:tg_id:nonce`
- Автоматически зачисляет депозиты

## 🐛 Отладка

```bash
# Логи API
npm run dev:api

# Логи пуллера
npm run dev:puller

# Проверка базы данных
npx prisma studio
```

## 📝 Лицензия

MIT License


