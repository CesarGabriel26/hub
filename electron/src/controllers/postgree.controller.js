import { execSync, spawn } from 'child_process';
import { rootPath } from '../utils/config.js';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

class PostgresController {
    async downloadWithAxios(url, outputPath, progressCallback) {
        const writer = fs.createWriteStream(outputPath);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        const totalLength = response.headers['content-length'];
        let downloadedLength = 0;

        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            if (totalLength && progressCallback) {
                const percentage = Math.round((downloadedLength / totalLength) * 100);
                progressCallback({ status: 'downloading', percentage });
            }
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    async installPostgres(installerPath, pass, progressCallback) {
        console.log("Iniciando instalação do PostgreSQL...");
        if (progressCallback) progressCallback({ status: 'installing', percentage: 0 });

        const args = [
            '--mode', 'unattended',
            '--unattendedmodeui', 'none',
            '--postgrespassword', pass,
            '--serverport', '5432'
        ];

        return new Promise((resolve, reject) => {
            const process = spawn(installerPath, args);
            process.on('close', (code) => {
                if (code === 0) {
                    if (progressCallback) progressCallback({ status: 'completed', percentage: 100 });
                    resolve("Instalado com sucesso!");
                }
                else {
                    if (progressCallback) progressCallback({ status: 'error', error: `Código: ${code}` });
                    reject(`Erro na instalação. Código: ${code}`);
                }
            });
        });
    }

    async setupDatabase(dbName = 'dados', user = 'postgres', password = 'admin', migrationFiles = [], callback) {
        console.log(`Configurando banco: ${dbName}...`);
        if (callback) callback({ status: 'initializing', percentage: 0 });

        const adminPool = new Pool({
            user: user, // usually 'postgres'
            host: 'localhost',
            database: 'postgres', // Connect to default postgres DB first
            password: password,
            port: 5432,
        });

        try {
            // 1. Ensure database exists
            const dbCheck = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
            if (dbCheck.rowCount === 0) {
                console.log(`Criando banco de dados: ${dbName}...`);
                await adminPool.query(`CREATE DATABASE ${dbName}`);
            }

            // Close admin pool to reconnect to the correct database
            await adminPool.end();

            // Reconnect to the target database as admin
            const dbAdminPool = new Pool({
                user: user,
                host: 'localhost',
                database: dbName,
                password: password,
                port: 5432,
            });

            // 2. Setup local user
            await this.setupLocalUser(dbAdminPool, dbName, callback);

            // 3. Run migrations
            await this.runMigrations(dbAdminPool, dbName, migrationFiles, callback);

            await dbAdminPool.end();
            console.log("Banco de dados e migrações concluídos!");
        } catch (error) {
            console.error("Erro no setup do banco:", error.message);
            if (callback) callback({ status: 'error', error: error.message });
            throw error;
        }
    }

    async setupLocalUser(pool, dbName, callback) {
        console.log('Ensuring local_user exists...');
        if (callback) callback({ status: 'setup_user', percentage: 10 });

        const users = await pool.query(`SELECT usename FROM pg_user WHERE usename = 'local_user';`);
        if (users.rowCount === 0) {
            console.log('Creating local_user...');
            await pool.query(`CREATE USER local_user WITH PASSWORD 'sunny1011';`);
        } else {
            await pool.query(`ALTER USER local_user WITH PASSWORD 'sunny1011';`);
        }

        await this.grantPermissions(pool, dbName);
    }

    async revokePermissions(pool, dbName) {
        console.log(`Revoking permissions for local_user on ${dbName}...`);
        await pool.query(`REVOKE CONNECT ON DATABASE ${dbName} FROM local_user;`);

        // Terminate existing connections
        await pool.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = $1
              AND usename = 'local_user'
              AND pid <> pg_backend_pid();
        `, [dbName]);
    }

    async grantPermissions(pool, dbName) {
        console.log(`Granting permissions to local_user on ${dbName}...`);
        await pool.query(`GRANT CONNECT ON DATABASE ${dbName} TO local_user;`);
        await pool.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO local_user;`);
        await pool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO local_user;`);
        await pool.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO local_user;`);
        await pool.query(`GRANT USAGE ON SCHEMA public TO local_user;`);
    }

    async runMigrations(pool, dbName, migrationFiles, callback) {
        console.log('--- STARTING MIGRATIONS ---');
        if (callback) callback({ status: 'migrating', percentage: 20 });

        try {
            await this.revokePermissions(pool, dbName);

            // Setup migrations tracking table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS migrations_history (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) UNIQUE NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // If migrationFiles is not provided, read from default directory
            let filesToRun = migrationFiles;
            if (!filesToRun || filesToRun.length === 0) {
                const migrationsDir = path.join(rootPath(), 'migrations');
                if (fs.existsSync(migrationsDir)) {
                    filesToRun = fs.readdirSync(migrationsDir)
                        .filter(f => f.endsWith('.sql'))
                        .sort()
                        .map(f => path.join(migrationsDir, f));
                } else {
                    console.log('No migration files found.');
                    return;
                }
            }

            for (let i = 0; i < filesToRun.length; i++) {
                const filePath = filesToRun[i];
                const fileName = path.basename(filePath);

                // Check if already executed
                const alreadyRun = await pool.query(`SELECT id FROM migrations_history WHERE filename = $1`, [fileName]);

                if (alreadyRun.rowCount > 0) {
                    console.log(`Migration already executed: ${fileName}`);
                    continue;
                }

                console.log(`Executing migration: ${fileName}`);
                const sql = fs.readFileSync(filePath, 'utf8');

                // Execute the SQL
                await pool.query(sql);

                // Record execution
                await pool.query(`INSERT INTO migrations_history (filename) VALUES ($1)`, [fileName]);
                console.log(`Migration completed: ${fileName}`);

                if (callback) {
                    const percentage = 20 + ((i + 1) / filesToRun.length * 80);
                    callback({ status: 'migrating', percentage, file: fileName });
                }
            }

            console.log('--- MIGRATIONS COMPLETED SUCCESSFULLY ---');
        } finally {
            await this.grantPermissions(pool, dbName);
        }
    }

    getBinaryPath(binaryName) {
        const version = this.checkDefaultDirectory();
        if (!version) throw new Error("PostgreSQL não encontrado no diretório padrão.");

        return path.join('C:', 'Program Files', 'PostgreSQL', version.toString(), 'bin', `${binaryName}.exe`);
    }

    getPostgresVersion() {
        try {
            const postgresPath = this.getBinaryPath('postgres');
            const versionOutput = execSync(`"${postgresPath}" -V`).toString();

            const match = versionOutput.match(/\d+/);
            return match ? parseInt(match[0]) : null;
        } catch (e) {
            return this.checkDefaultDirectory();
        }
    }

    checkDefaultDirectory() {
        const baseDir = 'C:\\Program Files\\PostgreSQL';
        if (fs.existsSync(baseDir)) {
            const versions = fs.readdirSync(baseDir);
            const majorVersions = versions.map(v => parseInt(v)).filter(v => !isNaN(v));
            return majorVersions.length > 0 ? Math.max(...majorVersions) : null;
        }
        return null;
    }

    isPostgresRunning() {
        try {
            // O comando tasklist lista processos. O filtro /FI filtra pelo nome.
            const stdout = execSync('tasklist /FI "IMAGENAME eq postgres.exe" /NH').toString();

            // Se o output contiver "postgres.exe", ele está rodando.
            return stdout.toLowerCase().includes('postgres.exe');
        } catch (e) {
            console.error("Erro ao verificar processo:", e.message);
            return false;
        }
    }

    async startPostgres() {
        try {
            const stdout = execSync('sc query type= service state= all').toString();
            // Find the service name
            const match = stdout.match(/SERVICE_NAME: (postgresql-x64-\d+)/i);
            if (match && match[1]) {
                const serviceName = match[1];
                console.log(`Iniciando serviço: ${serviceName}...`);
                execSync(`net start "${serviceName}"`);
                return { success: true };
            }
            return { success: false, error: 'Serviço PostgreSQL não encontrado.' };
        } catch (e) {
            console.error("Erro ao iniciar Postgres:", e.message);
            return { success: false, error: e.message };
        }
    }

    async downloadAndInstall(progressCallback) {
        try {
            const url = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260118';
            const installersPath = path.join(rootPath(), 'installers');
            if (!fs.existsSync(installersPath)) {
                fs.mkdirSync(installersPath);
            }
            const installerPath = path.join(installersPath, 'postgresql-17.3-1-windows-x64.exe');

            console.log("Baixando instalador...");
            if (progressCallback) progressCallback({ status: 'starting_download', percentage: 0 });
            await this.downloadWithAxios(url, installerPath, progressCallback);

            // console.log("Instalador baixado. Iniciando instalação...");
            // await this.installPostgres(installerPath, 'admin', progressCallback);

            console.log("Instalação concluída!");
        } catch (error) {
            console.error("Erro no download ou instalação:", error);
            if (progressCallback) progressCallback({ status: 'error', error: error.message });
        }
    }
}

export default new PostgresController();
