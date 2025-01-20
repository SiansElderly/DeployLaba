import pg from 'pg';
const { Pool } = pg;

class DBConnector {
    constructor(config) {
        this.pool = new Pool(config);
    }

    async query(queryString, params = []) {
        try {
            const result = await this.pool.query(queryString, params);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при выполнении запроса:', error);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
    }
}

export { DBConnector };
