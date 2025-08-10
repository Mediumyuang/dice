import axios from 'axios';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

const TON_API_KEY = process.env.TON_API_KEY;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

if (!TON_API_KEY) {
    console.error('TON_API_KEY not set');
    process.exit(1);
}

if (!TREASURY_ADDRESS) {
    console.error('TREASURY_ADDRESS not set');
    process.exit(1);
}

// Кэш для отслеживания уже обработанных транзакций
const processedTxs = new Set<string>();

async function checkIncomingTransactions() {
    try {
        console.log(`[${new Date().toISOString()}] Checking incoming transactions...`);

        // Получаем последние транзакции через tonapi
        const response = await axios.get(
            `https://toncenter.com/api/v2/getTransactions?address=${TREASURY_ADDRESS}&limit=10`,
            {
                headers: {
                    'X-API-Key': TON_API_KEY
                }
            }
        );

        if (!response.data.ok) {
            console.error('Failed to fetch transactions:', response.data.error);
            return;
        }

        const transactions = response.data.result;

        for (const tx of transactions) {
            // Пропускаем исходящие транзакции
            if (tx.in_msg.source !== '') {
                continue;
            }

            // Пропускаем уже обработанные
            if (processedTxs.has(tx.hash)) {
                continue;
            }

            // Проверяем, что это входящая транзакция с TON
            if (tx.in_msg.value === '0') {
                continue;
            }

            const amount = parseFloat(tx.in_msg.value) / 1000000000; // конвертируем из нанотонов
            const memo = tx.in_msg.message || '';

            // Проверяем формат memo: GAME:tg_id:nonce
            if (!memo.startsWith('GAME:')) {
                console.log(`Skipping transaction ${tx.hash}: invalid memo format`);
                continue;
            }

            console.log(`Processing deposit: ${tx.hash}, amount: ${amount} TON, memo: ${memo}`);

            // Отправляем в наш API для обработки
            try {
                const depositResponse = await axios.post(`${API_BASE}/api/deposit`, {
                    tx_hash: tx.hash,
                    amount: amount,
                    memo: memo,
                    from_address: tx.in_msg.source
                });

                if (depositResponse.status === 200) {
                    console.log(`Deposit processed successfully: ${tx.hash}`);
                    processedTxs.add(tx.hash);

                    // Ограничиваем размер кэша
                    if (processedTxs.size > 1000) {
                        const firstKey = processedTxs.values().next().value;
                        processedTxs.delete(firstKey);
                    }
                } else {
                    console.error(`Failed to process deposit ${tx.hash}:`, depositResponse.data);
                }
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 409) {
                    // Транзакция уже обработана
                    console.log(`Transaction ${tx.hash} already processed`);
                    processedTxs.add(tx.hash);
                } else {
                    console.error(`Error processing deposit ${tx.hash}:`, error);
                }
            }
        }

    } catch (error) {
        console.error('Error checking transactions:', error);
    }
}

// Запускаем пуллер каждые 10 секунд
cron.schedule('*/10 * * * * *', checkIncomingTransactions);

console.log('Deposit puller started. Checking transactions every 10 seconds...');
console.log(`Treasury address: ${TREASURY_ADDRESS}`);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down deposit puller...');
    process.exit(0);
});
