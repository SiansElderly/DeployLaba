import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { DBConnector } from './modules/DBConnector.js';
import { groupId, accessToken, version } from './modules/consts.js';
import pg from 'pg';
const { Pool } = pg;

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const dbConfig = {
    user: 'SiansDB',
    host: 'webb-sians.db-msk0.amvera.tech', // Внешнее доменное имя
    database: 'vk_members',
    password: 'loveDB',
    port: 5432,
    ssl: {
        rejectUnauthorized: false, // или true, в зависимости от настроек SSL
    },
};

const pool = new Pool(dbConfig);
const db = new DBConnector(dbConfig);

const vkRequest = async (method, params = {}) => {
    const urlParams = new URLSearchParams({
        access_token: accessToken,
        v: version,
        ...params,
    });
    const url = `https://api.vk.com/method/${method}?${urlParams}`;
    console.log(`VK API запрос: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(`VK API Error: ${data.error.error_msg}`);
    }

    return data.response;
};

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка:', err);
    res.status(500).send({ error: 'Внутренняя ошибка сервера', details: err.message });
});

// API для проверки подключения к базе данных
app.get('/api/check-connection', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT 1');
        res.send({ message: 'Подключение к БД установлено' });
    } catch (error) {
        next(error); // Передайте ошибку в middleware для обработки ошибок
    }
});

// API для создания таблицы в БД
app.get('/api/create-table', async (req, res, next) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS members (
                vk_id INTEGER PRIMARY KEY,
                first_name VARCHAR(255),
                last_name VARCHAR(255)
            );
        `);
        res.send({ message: 'Таблица создана' });
    } catch (error) {
        next(error);
    }
});

// API для получения участников группы VK
app.get('/api/vk/members', async (req, res) => {
    try {
        const members = [];
        let offset = 0;
        const count = 1000;

        while (true) {
            const data = await vkRequest('groups.getMembers', {
                group_id: groupId,
                fields: 'first_name,last_name',
                count,
                offset,
            });

            if (!data || !data.items) {
                throw new Error('Ошибка при получении данных от VK API');
            }

            members.push(...data.items);

            if (data.count < count) {
                break; // Если участников меньше count, значит это последняя страница
            }

            offset += count;
        }

        res.send(members);
    } catch (error) {
        console.error('Ошибка при запросе к VK API:', error);
        res.status(500).send({ error: error.message });
    }
});

// API для сохранения участников группы в БД
app.get('/api/save-members', async (req, res) => {
    try {
        const members = [];
        let offset = 0;
        const count = 1000; // Максимальное количество участников за запрос

        while (true) {
            const data = await vkRequest('groups.getMembers', {
                group_id: groupId,
                fields: 'first_name,last_name',
                count,
                offset,
            });

            if (!data || !data.items) {
                throw new Error('Ошибка при получении данных от VK API');
            }

            members.push(...data.items);

            if (data.count < count) {
                break; // Если участников меньше count, значит это последняя страница
            }

            offset += count;
        }

        for (const member of members) {
            const vk_id = member.id;
            const first_name = member.first_name ?? null;
            const last_name = member.last_name ?? null;

            await db.query(
                `INSERT INTO members (vk_id, first_name, last_name) VALUES ($1, $2, $3) 
                 ON CONFLICT (vk_id) DO UPDATE 
                 SET first_name = EXCLUDED.first_name, 
                     last_name = EXCLUDED.last_name`,
                [vk_id, first_name, last_name]
            );
        }

        res.send({ message: 'Данные сохранены в БД', members: members });
    } catch (error) {
        console.error('Ошибка при сохранении участников:', error);
        res.status(500).send({ error: 'Ошибка при сохранении данных' });
    }
});

// API для получения участников из БД
app.get('/api/members-db', async (req, res, next) => {
    try {
        const members = await pool.query('SELECT * FROM members');
        res.send(members.rows);
    } catch (error) {
        next(error); // Передайте ошибку в middleware для обработки ошибок
    }
});

// API для выполнения произвольных запросов к VK API
app.post('/api/vk', async (req, res, next) => {
    const { method, params } = req.body;

    if (!method) {
        return res.status(400).send({ error: 'Не указан метод VK API' });
    }

    try {
        const response = await vkRequest(method, params);
        res.send(response);
    } catch (error) {
        next(error); // Передайте ошибку в middleware для обработки ошибок
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
