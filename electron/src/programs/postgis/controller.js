import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { rootPath } from '../../utils/config.js';
import { info, warn, error } from '../../utils/logger.js';
import PostgresController from '../postgresql/controller.js';

const PROGRAM_ID = 'postgis';

class PostgisController {
    checkInstalled() {
        try {
            const pgVersion = PostgresController.getPostgresVersion();
            if (!pgVersion) return false;

            const postgisPath = path.join('C:', 'Program Files', 'PostgreSQL', pgVersion.toString(), 'lib', 'postgis-3.dll');
            return fs.existsSync(postgisPath);
        } catch (e) {
            return false;
        }
    }

    async downloadAndInstall(progressCallback) {
        try {
            // URL estável para o PostGIS (versão bundle para PostgreSQL 17)
            const url = 'https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17-3.5.0x64.exe';
            const installersPath = path.join(rootPath(), 'installers');
            if (!fs.existsSync(installersPath)) {
                fs.mkdirSync(installersPath);
            }
            const installerPath = path.join(installersPath, 'postgis-setup.exe');

            info(PROGRAM_ID, 'Baixando instalador do PostGIS...');
            if (progressCallback) progressCallback({ status: 'downloading', percentage: 0 });
            
            await PostgresController.downloadWithAxios(url, installerPath, progressCallback);

            info(PROGRAM_ID, 'Iniciando instalação silenciosa do PostGIS...');
            if (progressCallback) progressCallback({ status: 'installing', percentage: 0 });

            // Argumentos para instalação silenciosa (depende do empacotador, NSIS geralmente /S)
            const args = ['/S'];

            return new Promise((resolve, reject) => {
                const proc = spawn(`"${installerPath}"`, args, { shell: true });
                proc.on('close', (code) => {
                    if (code === 0) {
                        info(PROGRAM_ID, 'PostGIS instalado com sucesso.');
                        if (progressCallback) progressCallback({ status: 'completed', percentage: 100 });
                        resolve(true);
                    } else {
                        error(PROGRAM_ID, `Erro ao instalar PostGIS. Código: ${code}`);
                        if (progressCallback) progressCallback({ status: 'error', error: `Código: ${code}` });
                        reject(new Error(`Erro ${code}`));
                    }
                });
            });
        } catch (err) {
            error(PROGRAM_ID, `Falha no PostGIS: ${err.message}`);
            if (progressCallback) progressCallback({ status: 'error', error: err.message });
            throw err;
        }
    }
}

export default new PostgisController();
