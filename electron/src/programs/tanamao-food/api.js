/**
 * Tanamao Food API — Handlers IPC
 * Registra todos os canais ipcMain relacionados ao Tanamao Food.
 *
 * Canais disponíveis:
 *   tanamao-food:is-installed        → verifica se está instalado
 *   tanamao-food:is-running          → verifica se está rodando
 *   tanamao-food:open                → abre o app
 *   tanamao-food:install             → instala o app (com instalação prévia do postgres se necessário)
 *   tanamao-food:version             → retorna a versão instalada
 *   tanamao-food:setup-database      → cria banco, usuário local e roda migrations
 *   [event] tanamao-food:progress         → progresso de instalação
 *   [event] tanamao-food:config:progress  → progresso do setup do banco
 */

import { ipcMain } from 'electron';
import TanamaoFoodController from './controller.js';
import { setupDatabase } from '../postgresql/db-setup.js';
import { getConfigs, getMigrationsPath } from '../../utils/config.js';
import { info, error as logError } from '../../utils/logger.js';
import ConfigController from '../../controllers/config.controller.js';
import fs from 'fs';
import path from 'path';

export function initTanamaoFoodApi() {
    // ── Verificar instalação ─────────────────────────────────────────────────
    ipcMain.handle('tanamao-food:is-installed', async () => {
        try {
            const isInstalled = TanamaoFoodController.isFoodInstalled();
            return { success: true, isInstalled };
        } catch (error) {
            logError('tanamao-food', `Erro ao verificar instalação: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // ── Verificar se está rodando ────────────────────────────────────────────
    ipcMain.handle('tanamao-food:is-running', async () => {
        try {
            const isRunning = TanamaoFoodController.isFoodRunning();
            return { success: true, isRunning };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Abrir o app ──────────────────────────────────────────────────────────
    ipcMain.handle('tanamao-food:open', async () => {
        try {
            return await TanamaoFoodController.openFood();
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Instalar o app ───────────────────────────────────────────────────────
    ipcMain.handle('tanamao-food:install', async (event, installDir) => {
        try {
            info('tanamao-food', 'Recebido comando para instalar Tanamao Food.');
            const result = await TanamaoFoodController.installFood((progress) => {
                event.sender.send('tanamao-food:progress', progress);
            }, installDir);
            info('tanamao-food', `Sucesso na instalação: ${result.success}`);
            return result;
        } catch (error) {
            logError('tanamao-food', `Erro no IPC tanamao-food:install: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // ── Versão instalada ─────────────────────────────────────────────────────
    ipcMain.handle('tanamao-food:version', async () => {
        try {
            const version = TanamaoFoodController.getFoodVersion();
            return { success: true, version };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Setup do banco de dados do Tanamao Food ──────────────────────────────
    // Lê as configs do hub, cria o banco/user/migrations e grava o configs.json
    // dentro da pasta do Tanamao Food (para ele se conectar ao banco correto).
    ipcMain.handle('tanamao-food:setup-database', async (event) => {
        try {
            info('tanamao-food', 'Recebido comando para setup do banco de dados.');
            const configs = getConfigs();
            const migrationsPath = getMigrationsPath();
            const migrationFiles = fs.existsSync(migrationsPath)
                ? fs.readdirSync(migrationsPath)
                    .filter(f => f.endsWith('.sql'))
                    .sort()
                    .map(f => path.join(migrationsPath, f))
                : [];

            info('tanamao-food', `Migrations: ${JSON.stringify(migrationFiles)}`);

            // Cria/atualiza banco e roda migrations
            await setupDatabase(
                configs.database,
                'postgres',
                configs.password,
                migrationFiles,
                (progress) => event.sender.send('tanamao-food:config:progress', progress)
            );

            // Grava o arquivo de configs para o Tanamao Food usar
            const foodConfigDir = path.join(process.env.APPDATA, 'tanamao-food');
            info('tanamao-food', `Gravando configs em: ${foodConfigDir}`);
            if (!fs.existsSync(foodConfigDir)) {
                fs.mkdirSync(foodConfigDir, { recursive: true });
            }

            ConfigController.updateConfig(foodConfigDir, {
                db: {
                    port: configs.port,
                    host: configs.host,
                    database: configs.database,
                    password: configs.password
                }
            });

            info('tanamao-food', 'Setup do banco de dados concluído com sucesso (IPC).');
            return { success: true };
        } catch (error) {
            logError('tanamao-food', `Erro no IPC tanamao-food:setup-database: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    // ── Atualizar o app ──────────────────────────────────────────────────────
    ipcMain.handle('tanamao-food:update', async (event, installDir) => {
        try {
            const result = await TanamaoFoodController.updateFood((progress) => {
                event.sender.send('tanamao-food:progress', progress);
            }, installDir);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}
