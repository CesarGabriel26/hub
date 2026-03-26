import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { rootPath, getWritablePath } from '../../utils/config.js';
import { info, warn, error } from '../../utils/logger.js';
import PostgresController from '../postgresql/controller.js';

const PROGRAM_ID = 'postgis';

class PostgisController {
    checkInstalled() {
        try {
            const pgInstallPath = PostgresController.getInstallPath();
            if (!pgInstallPath) return false;

            // No PostgreSQL portátil, os arquivos ficam no mesmo diretório base
            const postgisPath = path.join(pgInstallPath, 'lib', 'postgis-3.dll');
            return fs.existsSync(postgisPath);
        } catch (e) {
            return false;
        }
    }

    async downloadAndInstall(progressCallback) {
        // ... (existing implementation)
    }

    // ─── Interface Padrão ─────────────────────────────────────────────────────

    isInstalled() {
        return this.checkInstalled();
    }

    getStatus() {
        return {
            status: this.isInstalled() ? 'installed' : 'not-installed',
            isRunning: false, // PostGIS is an extension, not a process
            version: null,
        };
    }

    async install(progressCallback) {
        return this.downloadAndInstall(progressCallback);
    }
}

export default new PostgisController();
