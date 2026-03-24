// Conexão com o banco postgres
import pkg from 'pg'
import { getConfigs } from '../utils/config.js'

const { Pool } = pkg

const configs = getConfigs()

const pool = new Pool({
    host: configs.DB_HOST,
    port: configs.DB_PORT,
    user: configs.DB_USER,
    password: configs.DB_PASSWORD,
    database: configs.DB_NAME
})

export default pool