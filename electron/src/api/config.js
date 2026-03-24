import { ipcMain } from 'electron';
import { saveConfigs, getConfigs } from '../utils/config.js';

export function initConfigApi() {
    ipcMain.handle('configs:save', async (_, configs) => {
        try {
            saveConfigs(configs);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('configs:get', async () => {
        try {
            const configs = getConfigs();
            return { success: true, configs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}