import { ipcMain } from "electron";
import TanamaoFoodController from "../programs/tanamao-food/controller.js";
import PostgresController from "../programs/postgresql/controller.js";
import PostgisController from "../programs/postgis/controller.js";
import { setupDatabase } from "../programs/postgresql/db-setup.js";
import { getConfigs, getMigrationsPath } from "../utils/config.js";
import fs from 'fs';
import ConfigController from "../controllers/config.controller.js";
import path from "path";
import { app } from "electron";

export function initTanamaoFoodApi() {
    ipcMain.handle('tanamao-food:is-installed', async () => {
        try {
            const isInstalled = TanamaoFoodController.isFoodInstalled();
            return { success: true, isInstalled };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('tanamao-food:is-running', async () => {
        try {
            const isRunning = TanamaoFoodController.isFoodRunning();
            return { success: true, isRunning };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('tanamao-food:open', async () => {
        try {
            const result = await TanamaoFoodController.openFood();
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('tanamao-food:install', async (event, installDir) => {
        try {
            const result = await TanamaoFoodController.installFood((progress) => {
                event.sender.send('tanamao-food:progress', progress);
            }, installDir);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

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

    ipcMain.handle('tanamao-food:version', async () => {
        try {
            const version = TanamaoFoodController.getFoodVersion();
            return { success: true, version };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('tanamao-food:setup-database', async (event) => {
        try {
            const migrationsPath = getMigrationsPath();
            const migrationFiles = fs.existsSync(migrationsPath)
                ? fs.readdirSync(migrationsPath)
                    .filter(f => f.endsWith('.sql'))
                    .sort()
                    .map(f => path.join(migrationsPath, f))
                : [];
                
            const configs = getConfigs();

            // Usa o setupDatabase do diretório programs que é o mais completo
            await setupDatabase(configs.database, configs.user, configs.password, migrationFiles, (progress) => {
                event.sender.send('tanamao-food:config:progress', progress);
            });

            // O nome da pasta de userData para o Tanamao Food é 'tanamao-food' (conforme seu package.json)
            const foodConfigDir = path.join(app.getPath('userData'), '..', 'tanamao-food');
            
            if (!fs.existsSync(foodConfigDir)) {
                fs.mkdirSync(foodConfigDir, { recursive: true });
            }

            const dbConfig = {
                host: configs.host,
                port: configs.port,
                user: 'local_user', // O setupDatabase cria este usuário
                password: 'sunny1011', // Senha padrão definida no setupDatabase
                database: configs.database
            };

            ConfigController.updateConfig(foodConfigDir, dbConfig);
            
            // Também tenta atualizar na pasta de instalação se for diferente (para o modo dev do Food app)
            if (configs.tanamao_food_path && fs.existsSync(configs.tanamao_food_path)) {
                ConfigController.updateConfig(configs.tanamao_food_path, dbConfig);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}
