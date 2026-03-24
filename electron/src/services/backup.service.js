import { getConfigs, rootPath } from '../utils/config.js';
import PostgresController from '../programs/postgresql/controller.js';
import { info, warn, error } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const PROGRAM_ID = 'backup-service';
let intervalId = null;

class BackupService {
    start() {
        if (intervalId) return;

        info(PROGRAM_ID, 'Iniciando serviço de backup...');
        
        // Verifica a cada minuto
        intervalId = setInterval(() => this.checkAndRun(), 60 * 1000);
        
        // Também executa imediatamente no início
        this.checkAndRun();
    }

    stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            info(PROGRAM_ID, 'Serviço de backup parado.');
        }
    }

    async checkAndRun() {
        const configs = getConfigs();
        
        if (!configs.backup_enabled) {
            return;
        }

        const now = new Date();
        const currentDay = now.getDay(); // 0 (domingo) a 6 (sábado)
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Ajusta domingo de 0 para 7 se a UI usar 1-7 (segunda-domingo)
        // Mas o padrão JS é 0-6. Vamos assumir que backup_days segue esse padrão (0-6).
        if (!configs.backup_days || !configs.backup_days.includes(currentDay)) {
            return;
        }

        const [configHour, configMinute] = configs.backup_time.split(':').map(Number);
        
        // Verifica se é o horário configurado
        if (currentHour === configHour && currentMinute === configMinute) {
            await this.performBackup(configs);
        }
    }

    async performBackup(configs) {
        try {
            const backupsDir = configs.backup_path || path.join(rootPath(), 'backups');
            if (!fs.existsSync(backupsDir)) {
                fs.mkdirSync(backupsDir, { recursive: true });
            }

            const dbName = configs.database || 'tanamao';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const dayName = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][new Date().getDay()];
            
            // Backup rotativo por dia da semana
            const filename = `${dbName}_${dayName}_backup.sql`;
            const backupPath = path.join(backupsDir, filename);

            info(PROGRAM_ID, `Iniciando backup automático de ${dbName} para ${backupPath}...`);
            
            await PostgresController.backupDatabase(
                dbName, 
                backupPath, 
                configs.user, 
                configs.password
            );

            info(PROGRAM_ID, `Backup automático concluído com sucesso: ${filename}`);
        } catch (err) {
            error(PROGRAM_ID, `Falha no backup automático: ${err.message}`);
        }
    }
}

export default new BackupService();
