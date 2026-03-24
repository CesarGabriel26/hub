import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export const gitToken = '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'

export function rootPath() {
    return app.isPackaged
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();
}

export function getConfigPath() {
    const configPath = app.isPackaged
        ? path.join(app.getPath('userData'), 'configs.json')
        : path.join(rootPath(), 'configs.json');

    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'admin',
            database: 'tanamao',
            tanamao_food_path: 'C:\\Program Files\\Tanamao Food',
            auto_start: true,
            auto_update: false,
            backup_enabled: false,
            backup_time: '03:00',
            backup_days: [1, 2, 3, 4, 5], // segunda a sexta
            backup_path: path.join(rootPath(), 'backups')
        }));
    }

    return configPath
}

export function getMigrationsPath() {
    return path.join(rootPath(), 'migrations');
}

export function getConfigs() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
        console.error("Error reading configs.json:", err);
        return {};
    }
}

export function saveConfigs(configs) {
    const configPath = getConfigPath();
    const oldConfigs = getConfigs();
    const newConfigs = { ...oldConfigs, ...configs };
    fs.writeFileSync(configPath, JSON.stringify(newConfigs, null, 2));
}
