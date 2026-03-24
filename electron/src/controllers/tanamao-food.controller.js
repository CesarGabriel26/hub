import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConfigs } from '../utils/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class TanamaoFoodController {
    getInstallPath() {
        const configs = getConfigs();
        if (configs && configs.tanamao_food_path) {
            return path.join(configs.tanamao_food_path, 'Tanamao Food.exe');
        }
        return path.join('C:', 'Program Files', 'Tanamao Food', 'Tanamao Food.exe');
    }

    isFoodInstalled() {
        return fs.existsSync(this.getInstallPath());
    }

    isFoodRunning() {
        try {
            const exeName = path.basename(this.getInstallPath());
            const stdout = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`).toString();
            return stdout.toLowerCase().includes(exeName.toLowerCase());
        } catch (e) {
            console.error("Erro ao verificar processo Tanamao Food:", e.message);
            return false;
        }
    }

    getFoodVersion() {
        try {
            const installPath = this.getInstallPath();
            const packageJsonPath = path.join(path.dirname(installPath), 'resources', 'app', 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                return pkg.version;
            }
        } catch (e) {
            console.error("Erro ao ler versão do Tanamao Food:", e.message);
        }
        return '0.0.0';
    }

    async openFood() {
        const installPath = this.getInstallPath();
        if (!fs.existsSync(installPath)) {
            return { success: false, error: 'Tanamao Food não está instalado.' };
        }
        try {
            spawn(`"${installPath}"`, [], { detached: true, stdio: 'ignore', shell: true }).unref();
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    installFood(progressCallback, installDir = null) {
        try {
            const installerPath = path.join(path.dirname(__dirname), '..', '..', 'public', 'assets', 'installers', 'Tanamao Food Setup.exe');

            const args = [
                '--mode', 'unattended',
                '--unattendedmodeui', 'none',
            ];

            if (installDir) {
                // NSIS installer uses /D= to set installation directory. 
                // Note: it must be the last parameter and NO quotes around the path.
                args.push(`/D=${installDir}`);
            }

            console.log(`Iniciando instalador: "${installerPath}" ${args.join(' ')}`);

            return new Promise((resolve, reject) => {
                // Using shell: true and proper quoting to avoid EACCES and handle spaces
                const process = spawn(`"${installerPath}"`, args, {
                    shell: true,
                    windowsVerbatimArguments: true
                });

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

                process.on('error', (err) => {
                    console.error("Erro ao iniciar instalador:", err);
                    if (progressCallback) progressCallback({ status: 'error', error: err.message });
                    reject(err.message);
                });
            });
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

export default new TanamaoFoodController();
