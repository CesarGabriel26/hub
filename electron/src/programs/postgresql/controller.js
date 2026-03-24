/**
 * PostgreSQL Controller
 * Responsável por: detectar, baixar, instalar e iniciar o PostgreSQL.
 * Setup do banco de dados está em db-setup.js.
 */

import { execSync, spawn } from 'child_process';
import { rootPath } from '../../utils/config.js';
import { info, warn, error as logError } from '../../utils/logger.js';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const PROGRAM_ID = 'postgres';

class PostgresController {

    // ─── Detecção ─────────────────────────────────────────────────────────────

    /**
     * Verifica se o PostgreSQL está instalado no diretório padrão do Windows.
     * Retorna o número da versão maior (ex: 17) ou null se não encontrado.
     */
    checkDefaultDirectory() {
        const baseDir = 'C:\\Program Files\\PostgreSQL';
        if (fs.existsSync(baseDir)) {
            const versions = fs.readdirSync(baseDir);
            const majorVersions = versions.map(v => parseInt(v)).filter(v => !isNaN(v));
            return majorVersions.length > 0 ? Math.max(...majorVersions) : null;
        }
        return null;
    }

    /**
     * Retorna o caminho completo do binário postgres (ex: psql.exe, postgres.exe).
     * @throws {Error} Se o PostgreSQL não for encontrado.
     */
    getBinaryPath(binaryName) {
        const version = this.checkDefaultDirectory();
        if (!version) throw new Error('PostgreSQL não encontrado no diretório padrão.');
        return path.join('C:', 'Program Files', 'PostgreSQL', version.toString(), 'bin', `${binaryName}.exe`);
    }

    /**
     * Retorna a versão instalada do PostgreSQL ou null.
     */
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

    /**
     * Verifica se o processo postgres.exe está ativo.
     */
    isPostgresRunning() {
        try {
            const stdout = execSync('tasklist /FI "IMAGENAME eq postgres.exe" /NH').toString();
            return stdout.toLowerCase().includes('postgres.exe');
        } catch (e) {
            logError(PROGRAM_ID, `Erro ao verificar processo: ${e.message}`);
            return false;
        }
    }

    // ─── Serviço ──────────────────────────────────────────────────────────────

    /**
     * Inicia o serviço do PostgreSQL via Windows Services (net start).
     */
    async startPostgres() {
        try {
            const stdout = execSync('sc query type= service state= all').toString();
            const match = stdout.match(/SERVICE_NAME: (postgresql-x64-\d+)/i);
            if (match && match[1]) {
                const serviceName = match[1];
                info(PROGRAM_ID, `Iniciando serviço: ${serviceName}...`);
                execSync(`net start "${serviceName}"`);
                info(PROGRAM_ID, `Serviço ${serviceName} iniciado com sucesso.`);
                return { success: true };
            }
            error(PROGRAM_ID, 'Serviço PostgreSQL não encontrado nas consultas do sistema.');
            return { success: false, error: 'Serviço PostgreSQL não encontrado.' };
        } catch (e) {
            logError(PROGRAM_ID, `Erro ao iniciar serviço: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Aguarda até que o PostgreSQL esteja pronto para receber conexões.
     * @param {number} retries - Número de tentativas
     * @param {number} delay - Atraso entre tentativas em ms
     */
    async waitForReady(retries = 10, delay = 2000) {
        info(PROGRAM_ID, 'Aguardando PostgreSQL ficar pronto para conexões...');
        for (let i = 0; i < retries; i++) {
            // obeter da config
            const configs = getConfigs();
            const pool = new Pool({
                host: configs.host,
                port: configs.port,
                user: configs.user,
                password: configs.password,
                database: configs.database,
                connectionTimeoutMillis: 2000,
            });

            try {
                await pool.query('SELECT 1');
                await pool.end();
                info(PROGRAM_ID, 'PostgreSQL está pronto!');
                return true;
            } catch (err) {
                await pool.end();
                warn(PROGRAM_ID, `PostgreSQL ainda não está pronto (tentativa ${i + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error('PostgreSQL não ficou pronto após várias tentativas.');
    }

    // ─── Instalação ───────────────────────────────────────────────────────────

    /**
     * Baixa o instalador do PostgreSQL via HTTP com callback de progresso.
     */
    async downloadWithAxios(url, outputPath, progressCallback) {
        const writer = fs.createWriteStream(outputPath);
        const response = await axios({ url, method: 'GET', responseType: 'stream' });

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

    /**
     * Executa o instalador do PostgreSQL em modo silencioso.
     */
    async installPostgres(installerPath, pass, progressCallback) {
        info(PROGRAM_ID, 'Iniciando instalação silenciosa...');
        if (progressCallback) progressCallback({ status: 'installing', percentage: 0 });

        const args = [
            '--mode', 'unattended',
            '--unattendedmodeui', 'none',
            '--postgrespassword', pass,
            '--serverport', '5432'
        ];

        return new Promise((resolve, reject) => {
            const proc = spawn(installerPath, args);
            proc.on('close', (code) => {
                if (code === 0) {
                    if (progressCallback) progressCallback({ status: 'completed', percentage: 100 });
                    info(PROGRAM_ID, 'Instalação concluída com sucesso.');
                    resolve('Instalado com sucesso!');
                } else {
                    const msg = `Erro na instalação. Código: ${code}`;
                    logError(PROGRAM_ID, msg);
                    if (progressCallback) progressCallback({ status: 'error', error: `Código: ${code}` });
                    reject(msg);
                }
            });
        });
    }

    /**
     * Fluxo completo: baixa e instala o PostgreSQL com callback de progresso.
     */
    async downloadAndInstall(progressCallback) {
        try {
            const url = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260118';
            const installersPath = path.join(rootPath(), 'installers');
            if (!fs.existsSync(installersPath)) {
                fs.mkdirSync(installersPath);
            }
            const installerPath = path.join(installersPath, 'postgresql-17.3-1-windows-x64.exe');

            info(PROGRAM_ID, 'Baixando instalador...');
            if (progressCallback) progressCallback({ status: 'downloading', percentage: 0 });
            await this.downloadWithAxios(url, installerPath, progressCallback);

            info(PROGRAM_ID, `Instalador baixado em: ${installerPath}. Iniciando instalação silenciosa...`);
            if (progressCallback) progressCallback({ status: 'installing', percentage: 0 });
            await this.installPostgres(installerPath, 'admin', progressCallback);

            info(PROGRAM_ID, 'Download e instalação do PostgreSQL concluídos com sucesso!');
        } catch (err) {
            logError(PROGRAM_ID, `Erro no download/instalação: ${err.message || err}`);
            if (progressCallback) progressCallback({ status: 'error', error: err.message });
            throw err;
        }
    }

    // ─── Backup e Restore ─────────────────────────────────────────────────────

    /**
     * Realiza o backup de um banco de dados específico.
     * @param {string} dbName - Nome do banco
     * @param {string} backupPath - Caminho onde o arquivo .sql será salvo
     * @param {string} user - Usuário admin
     * @param {string} password - Senha
     */
    async backupDatabase(dbName, backupPath, user = 'postgres', password = 'admin') {
        return new Promise((resolve, reject) => {
            try {
                const pgDumpPath = this.getBinaryPath('pg_dump');
                info(PROGRAM_ID, `Iniciando backup do banco ${dbName} para ${backupPath}...`);

                // pg_dump não aceita senha por argumento direto por segurança
                // Usamos a variável de ambiente PGPASSWORD
                const env = { ...process.env, PGPASSWORD: password };

                const args = [
                    '-U', user,
                    '-h', 'localhost',
                    '-p', '5432',
                    '--clean',
                    '--if-exists',
                    '-f', backupPath,
                    dbName
                ];

                const proc = spawn(`"${pgDumpPath}"`, args, { env, shell: true });

                proc.on('close', (code) => {
                    if (code === 0) {
                        info(PROGRAM_ID, `Backup concluído com sucesso: ${backupPath}`);
                        resolve({ success: true, path: backupPath });
                    } else {
                        const msg = `Erro no backup. Código: ${code}`;
                        logError(PROGRAM_ID, msg);
                        reject(new Error(msg));
                    }
                });

                proc.on('error', (err) => {
                    logError(PROGRAM_ID, `Erro ao iniciar pg_dump: ${err.message}`);
                    reject(err);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Restaura um banco de dados a partir de um backup .sql.
     * @param {string} dbName - Nome do banco (deve existir ou ser recriado)
     * @param {string} backupPath - Caminho do arquivo .sql
     * @param {string} user - Usuário admin
     * @param {string} password - Senha
     */
    async restoreDatabase(dbName, backupPath, user = 'postgres', password = 'admin') {
        return new Promise((resolve, reject) => {
            try {
                const psqlPath = this.getBinaryPath('psql');
                info(PROGRAM_ID, `Restaurando banco ${dbName} a partir de ${backupPath}...`);

                const env = { ...process.env, PGPASSWORD: password };

                // Primeiro, vamos "dropar" o conteúdo se houver erro ou garantir que está limpo
                // Mas psql -f geralmente roda comandos SQL. Se o dump tem CREATE TABLE, pode dar conflito se já existir.
                // O ideal em migrations é que o dump seja um estado seguro.

                const args = [
                    '-U', user,
                    '-h', 'localhost',
                    '-p', '5432',
                    '-d', dbName,
                    '-f', backupPath
                ];

                const proc = spawn(`"${psqlPath}"`, args, { env, shell: true });

                proc.on('close', (code) => {
                    if (code === 0) {
                        info(PROGRAM_ID, `Restauração concluída com sucesso.`);
                        resolve({ success: true });
                    } else {
                        const msg = `Erro na restauração. Código: ${code}`;
                        logError(PROGRAM_ID, msg);
                        reject(new Error(msg));
                    }
                });

                proc.on('error', (err) => {
                    logError(PROGRAM_ID, `Erro ao iniciar psql para restauração: ${err.message}`);
                    reject(err);
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

export default new PostgresController();
