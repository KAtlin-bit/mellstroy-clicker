import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse } from 'url';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🔑 ВАШ ТОКЕН
const TELEGRAM_BOT_TOKEN = '8495862584:AAEmqZlLmWsXgsczrv4gOK-xUTPfv2mN53c';

const PORT = 3000;
let database = { users: {} };

// Загрузка базы данных
function loadDatabase() {
    try {
        if (existsSync('database.json')) {
            const data = readFileSync('database.json', 'utf8');
            database = JSON.parse(data);
        }
    } catch (error) {
        console.log('Создаем новую базу данных');
    }
}

// Сохранение базы данных
function saveDatabase() {
    writeFileSync('database.json', JSON.stringify(database, null, 2));
}

// CORS headers
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Парсинг тела запроса
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}

const server = createServer(async (req, res) => {
    const { pathname } = parse(req.url, true);
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(200);
        res.end();
        return;
    }

    setCorsHeaders(res);

    try {
        // API: Инициализация пользователя
        if (pathname === '/api/init' && req.method === 'POST') {
            const body = await parseBody(req);
            
            // Создаем пользователя
            const userId = 'user_' + Date.now();
            const userData = {
                id: userId,
                username: 'player_' + Math.random().toString(36).substr(2, 5),
                coins: 100,
                level: 1,
                tapPower: 1,
                created: Date.now(),
                achievements: [],
                businesses: {},
                evolution: 1,
                totalTaps: 0
            };
            
            database.users[userId] = userData;
            saveDatabase();
            
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                user: userData,
                token: Buffer.from(userId).toString('base64')
            }));
            return;
        }

        // API: Тап
        if (pathname === '/api/tap' && req.method === 'POST') {
            const body = await parseBody(req);
            const { userId } = body;
            
            if (!database.users[userId]) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'User not found' }));
                return;
            }
            
            const user = database.users[userId];
            user.coins += user.tapPower;
            user.totalTaps = (user.totalTaps || 0) + 1;
            user.lastActive = Date.now();
            
            // Проверка ачивок
            checkAchievements(user);
            
            saveDatabase();
            
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                coins: user.coins,
                tapPower: user.tapPower,
                totalTaps: user.totalTaps
            }));
            return;
        }

        // API: Покупка улучшения
        if (pathname === '/api/buy/upgrade' && req.method === 'POST') {
            const body = await parseBody(req);
            const { userId, upgradeId, cost } = body;
            
            const user = database.users[userId];
            if (!user || user.coins < cost) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Not enough coins' }));
                return;
            }
            
            user.coins -= cost;
            
            // Применяем улучшение
            if (upgradeId === 'finger_1') {
                user.tapPower += 1;
            } else if (upgradeId === 'finger_2') {
                user.tapPower += 2;
            }
            
            saveDatabase();
            
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                user: user
            }));
            return;
        }

        // Статические файлы
        if (pathname === '/' || pathname === '/index.html') {
            serveStaticFile(res, '../frontend/index.html', 'text/html');
            return;
        }

        if (pathname === '/game.html') {
            serveStaticFile(res, '../frontend/game.html', 'text/html');
            return;
        }

        if (pathname === '/upgrades.html') {
            serveStaticFile(res, '../frontend/upgrades.html', 'text/html');
            return;
        }

        if (pathname === '/business.html') {
            serveStaticFile(res, '../frontend/business.html', 'text/html');
            return;
        }

        if (pathname === '/style.css') {
            serveStaticFile(res, '../frontend/style.css', 'text/css');
            return;
        }

        // 404
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));

    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Server error' }));
    }
});

function serveStaticFile(res, filePath, contentType) {
    try {
        const fullPath = join(__dirname, filePath);
        const content = readFileSync(fullPath, 'utf8');
        res.setHeader('Content-Type', contentType);
        res.writeHead(200);
        res.end(content);
    } catch (error) {
        res.writeHead(404);
        res.end('File not found');
    }
}

function checkAchievements(user) {
    // Проверяем достижения по тапам
    const tapAchievements = [
        { taps: 10, name: 'Первый шаг' },
        { taps: 50, name: 'Начинающий' },
        { taps: 100, name: 'Опытный тапер' }
    ];
    
    tapAchievements.forEach(ach => {
        if (user.totalTaps >= ach.taps && !user.achievements.includes(ach.name)) {
            user.achievements.push(ach.name);
            console.log(`Достижение получено: ${ach.name}`);
        }
    });
}

// Запуск сервера
server.listen(PORT, () => {
    console.log(`🎮 MellCoin Clicker Server запущен!`);
    console.log(`📱 Откройте: http://localhost:${PORT}`);
    console.log(`🤖 Bot Token: ${TELEGRAM_BOT_TOKEN}`);
    console.log(`🔑 НЕ ЗАБУДЬТЕ ЗАМЕНИТЬ ТОКЕН В КОДЕ!`);
    loadDatabase();
});