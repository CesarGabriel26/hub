/**
 * Tanamao Food Controller
 * Responsável por: detectar instalação, abrir o app, instalar (com setup do banco).
 * Nota: instala o PostgreSQL automaticamente se necessário (via PostgresController).
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConfigs, gitToken, rootPath } from '../../utils/config.js';
import { info, warn, error as logError } from '../../utils/logger.js';
import axios from 'axios';
import PostgresController from '../postgresql/controller.js';
import PostgisController from '../postgis/controller.js';
import { setupDatabase } from '../postgresql/db-setup.js';
import { getMigrationsPath } from '../../utils/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRAM_ID = 'tanamao-food';

class TanamaoFoodController {

    // ─── Detecção ─────────────────────────────────────────────────────────────

    async getLatestAssets(token) {
        const url = `https://api.github.com/repos/Sunny-Soft/Gecom-web-food-desktop/releases/latest`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        const latest = response.data;
        if (!latest) throw new Error("Nenhum release encontrado.");

        info(PROGRAM_ID, `Release encontrado: ${JSON.stringify(latest, null, 2)}`);

        // Busca o asset que termina com .exe (seu setup)
        // Mais robusto: tenta encontrar Tanamao-Food-Setup, ou qualquer .exe que contenha 'Setup' ou 'Tanamao'
        let setupAsset = latest.assets.find(a => a.name.toLowerCase().endsWith('.exe') && a.name.includes('Tanamao-Food-Setup'));
        
        if (!setupAsset) {
            setupAsset = latest.assets.find(a => a.name.toLowerCase().endsWith('.exe') && a.name.toLowerCase().includes('setup'));
        }
        
        if (!setupAsset) {
            setupAsset = latest.assets.find(a => a.name.toLowerCase().endsWith('.exe'));
        }

        // Busca o asset migrations.zip
        const migrationsAsset = latest.assets.find(a => a.name.toLowerCase().includes('migrations') && a.name.toLowerCase().endsWith('.zip'));

        return {
            version: latest.tag_name,
            setup: setupAsset ? { url: setupAsset.url, name: setupAsset.name } : null,
            migrations: migrationsAsset ? { url: migrationsAsset.url, name: migrationsAsset.name } : null
        };
    }

    async downloadInstaller(assetUrl, token, targetPath, progressCallback) {
        const writer = fs.createWriteStream(targetPath);

        const response = await axios({
            url: assetUrl,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/octet-stream'
            }
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
            writer.on('error', (err) => {
                fs.unlink(targetPath, () => reject(err));
            });
        });
    }

    /**
     * Retorna o caminho do executável do Tanamao Food.
     * Usa o caminho da config ou o padrão em Program Files.
     */
    getInstallPath() {
        const configs = getConfigs();
        if (configs && configs.tanamao_food_path) {
            return path.join(configs.tanamao_food_path, 'Tanamao Food.exe');
        }
        return path.join('C:', 'Program Files', 'Tanamao Food', 'Tanamao Food.exe');
    }

    /**
     * Verifica se o executável do Tanamao Food existe.
     */
    isFoodInstalled() {
        return fs.existsSync(this.getInstallPath());
    }

    /**
     * Verifica se o processo do Tanamao Food está rodando.
     */
    isFoodRunning() {
        try {
            const exeName = path.basename(this.getInstallPath());
            const stdout = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`).toString();
            return stdout.toLowerCase().includes(exeName.toLowerCase());
        } catch (e) {
            logError(PROGRAM_ID, `Erro ao verificar processo: ${e.message}`);
            return false;
        }
    }

    /**
     * Lê a versão do Tanamao Food a partir do package.json do app instalado.
     */
    getFoodVersion() {
        try {
            const installPath = this.getInstallPath();
            const packageJsonPath = path.join(path.dirname(installPath), 'resources', 'app', 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                return pkg.version;
            }
        } catch (e) {
            logError(PROGRAM_ID, `Erro ao ler versão: ${e.message}`);
        }
        return '0.0.0';
    }

    // ─── Ações ────────────────────────────────────────────────────────────────

    /**
     * Abre o Tanamao Food em processo separado (detached).
     */
    async openFood() {
        const installPath = this.getInstallPath();
        if (!fs.existsSync(installPath)) {
            warn(PROGRAM_ID, 'Tentativa de abrir o app, mas não está instalado.');
            return { success: false, error: 'Tanamao Food não está instalado.' };
        }
        try {
            info(PROGRAM_ID, `Abrindo app: ${installPath}`);
            spawn(`"${installPath}"`, [], { detached: true, stdio: 'ignore', shell: true }).unref();
            return { success: true };
        } catch (e) {
            logError(PROGRAM_ID, `Erro ao abrir app: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    // ─── Instalação ───────────────────────────────────────────────────────────

    /**
     * Instala o Tanamao Food.
     * Se o PostgreSQL não estiver instalado, instala-o primeiro (dependência).
     *
     * @param {Function} progressCallback - Callback de progresso
     * @param {string|null} installDir - Diretório de instalação personalizado (opcional)
     */
    async installFood(progressCallback, installDir = null) {
        try {
            info(PROGRAM_ID, 'Iniciando processo de instalação do Tanamao Food...');
            // 1. Verifica e instala dependência (PostgreSQL) se necessário
            const postgresInstalled = PostgresController.checkDefaultDirectory();
            if (!postgresInstalled) {
                info(PROGRAM_ID, 'PostgreSQL não encontrado. Instalando dependência...');
                if (progressCallback) progressCallback({ status: 'info', message: 'Instalando PostgreSQL (dependência)...' });

                await PostgresController.downloadAndInstall((progress) => {
                    if (progressCallback) {
                        progressCallback({
                            ...progress,
                            app: 'postgresql',
                            message: `PostgreSQL: ${progress.status === 'downloading' ? 'Baixando' : 'Instalando'}...`
                        });
                    }
                });
            }

            // 1.1 Verifica e instala dependência (PostGIS) se necessário
            const postgisInstalled = PostgisController.checkInstalled();
            if (!postgisInstalled) {
                info(PROGRAM_ID, 'PostGIS não encontrado. Instalando dependência...');
                if (progressCallback) progressCallback({ status: 'info', message: 'Instalando PostGIS (dependência)...' });

                await PostgisController.downloadAndInstall((progress) => {
                    if (progressCallback) {
                        progressCallback({
                            ...progress,
                            app: 'postgis',
                            message: `PostGIS: ${progress.status === 'downloading' ? 'Baixando' : 'Instalando'}...`
                        });
                    }
                });
            }

            // 2. Buscar informações do release mais recente
            if (progressCallback) progressCallback({ status: 'checking', message: 'Buscando versão mais recente...' });
            const assets = await this.getLatestAssets(gitToken);

            if (!assets.setup) throw new Error("Instalador .exe não encontrado no release.");

            // 3. Baixar migrations se existirem
            if (assets.migrations) {
                const migrationsZipPath = path.join(rootPath(), assets.migrations.name);
                if (progressCallback) progressCallback({ status: 'downloading', message: 'Baixando novas migrations...' });
                await this.downloadInstaller(assets.migrations.url, gitToken, migrationsZipPath);

                info(PROGRAM_ID, 'Extraindo migrations...');
                await this.extractMigrations(migrationsZipPath);
                fs.unlinkSync(migrationsZipPath);
            }

            // 4. Baixar o instalador para uma pasta temporária
            const tempInstallerPath = path.join(rootPath(), assets.setup.name);
            if (progressCallback) progressCallback({ status: 'downloading', message: `Baixando ${assets.version}...` });

            await this.downloadInstaller(assets.setup.url, gitToken, tempInstallerPath, (progress) => {
                if (progressCallback) {
                    progressCallback({
                        ...progress,
                        app: 'tanamao-food',
                        message: `Tanamao Food: ${progress.status === 'downloading' ? 'Baixando' : 'Instalando'}...`
                    });
                }
            });

            if (progressCallback) progressCallback({ status: 'installing', percentage: 0, message: 'Instalando Tanamao Food...' });

            // Argumentos para instalador do electron-builder (NSIS)
            const args = ['/S'];

            if (installDir) {
                // Para NSIS, /D deve ser o último argumento e sem aspas internas
                args.push(`/D=${installDir}`);
            }

            info(PROGRAM_ID, `Iniciando instalador: "${tempInstallerPath}" ${args.join(' ')}`);

            return new Promise((resolve, reject) => {
                const proc = spawn(`"${tempInstallerPath}"`, args, {
                    shell: true,
                    windowsVerbatimArguments: true
                });

                proc.on('close', async (code) => {
                    if (code === 0) {
                        if (progressCallback) progressCallback({ status: 'completed', percentage: 100 });
                        info(PROGRAM_ID, 'Instalação do executável concluída com sucesso. Iniciando configuração do banco de dados...');

                        // Após instalar o executável, rodamos o setup do banco
                        try {
                            const configs = getConfigs();
                            const migrationsPath = getMigrationsPath();
                            const migrationFiles = fs.existsSync(migrationsPath)
                                ? fs.readdirSync(migrationsPath)
                                    .filter(f => f.endsWith('.sql'))
                                    .sort()
                                    .map(f => path.join(migrationsPath, f))
                                : [];

                            info(PROGRAM_ID, `Configurando banco de dados ${configs.database} para o Tanamao Food...`);
                            await setupDatabase(
                                configs.database,
                                configs.user,
                                configs.password,
                                migrationFiles,
                                (progress) => {
                                    if (progressCallback) progressCallback({ ...progress, message: `Banco: ${progress.status}...` });
                                }
                            );
                            info(PROGRAM_ID, 'Configuração do banco de dados concluída.');
                        } catch (dbError) {
                            logError(PROGRAM_ID, `Erro ao configurar banco de dados: ${dbError.message}`);
                            // Mesmo com erro no banco, o executável foi instalado, mas avisamos o erro
                        }

                        resolve({ success: true });
                    } else {
                        const msg = `Erro na instalação. Código: ${code}`;
                        logError(PROGRAM_ID, msg);
                        if (progressCallback) progressCallback({ status: 'error', error: `Código: ${code}` });
                        reject(new Error(msg));
                    }
                });

                proc.on('error', (err) => {
                    logError(PROGRAM_ID, `Erro ao iniciar instalador: ${err.message}`);
                    if (progressCallback) progressCallback({ status: 'error', error: err.message });
                    reject(err);
                });
            });
        } catch (e) {
            logError(PROGRAM_ID, `Erro no processo de instalação: ${e.message}`);
            if (progressCallback) progressCallback({ status: 'error', error: e.message });
            return { success: false, error: e.message };
        }
    }

    /**
     * Atualiza o Tanamao Food se houver uma nova versão disponível.
     */
    async updateFood(progressCallback) {
        try {
            info(PROGRAM_ID, 'Verificando atualizações...');
            const assets = await this.getLatestAssets(gitToken);
            const currentVersion = this.getFoodVersion();

            if (this.compareVersions(assets.version, currentVersion) <= 0) {
                info(PROGRAM_ID, `Já está na versão mais recente (${currentVersion}).`);
                return { success: true, message: 'Já atualizado.' };
            }

            info(PROGRAM_ID, `Nova versão encontrada: ${assets.version}. Iniciando atualização...`);

            if (this.isFoodRunning()) {
                info(PROGRAM_ID, 'O app está rodando. Encerrando para atualizar...');
                const exeName = path.basename(this.getInstallPath());
                try {
                    execSync(`taskkill /F /IM "${exeName}"`);
                } catch (e) {
                    warn(PROGRAM_ID, `Falha ao encerrar app (pode já estar fechado): ${e.message}`);
                }
            }

            // O installFood já faz o download do setup e instala.
            // Mas precisamos garantir que ele também baixe as migrations se existirem.
            return await this.installFood(progressCallback);

        } catch (e) {
            logError(PROGRAM_ID, `Erro durante atualização: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Compara duas strings de versão (ex: v1.0.0 vs 0.9.9)
     * Retorna 1 se v1 > v2, -1 se v1 < v2, 0 se iguais.
     */
    compareVersions(v1, v2) {
        const p1 = v1.replace(/^v/, '').split('.').map(Number);
        const p2 = v2.replace(/^v/, '').split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }

    /**
     * Extrai o arquivo migrations.zip para a pasta de migrations do hub.
     */
    async extractMigrations(zipPath) {
        const { getMigrationsPath } = await import('../../utils/config.js');
        const migrationsDir = getMigrationsPath();

        if (!fs.existsSync(migrationsDir)) {
            fs.mkdirSync(migrationsDir, { recursive: true });
        }

        info(PROGRAM_ID, `Extraindo migrations para ${migrationsDir}...`);
        const extractCmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${migrationsDir}' -Force"`;
        execSync(extractCmd);
    }
}

export default new TanamaoFoodController();