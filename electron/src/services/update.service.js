import { getConfigs, gitToken } from '../utils/config.js';
import TanamaoFoodController from '../programs/tanamao-food/controller.js';
import { info, error as logError } from '../utils/logger.js';

const PROGRAM_ID = 'update-service';

class UpdateService {
    constructor() {
        this.interval = null;
        this.updateStatus = {
            'tanamao-food': { hasUpdate: false, version: '0.0.0', latestVersion: '0.0.0' }
        };
    }

    /**
     * Inicia o serviço de verificação periódica de atualizações.
     */
    start() {
        if (this.interval) return;
        if (!TanamaoFoodController.isFoodInstalled()) return;

        info(PROGRAM_ID, 'Serviço de atualização automática iniciado.');

        // Verifica a cada 1 hora
        this.interval = setInterval(() => {
            this.checkUpdates();
        }, 60 * 60 * 1000);

        // Verifica imediatamente ao iniciar se o auto_update estiver ligado
        this.checkUpdates();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /**
     * Verifica e aplica atualizações para programas compatíveis.
     */
    async checkUpdates() {
        const configs = getConfigs();

        // Só prossegue se a opção de atualização automática estiver ligada no Hub
        if (!configs.auto_update) return;

        info(PROGRAM_ID, 'Iniciando verificação de atualizações automáticas...');

        try {
            const assets = await TanamaoFoodController.getLatestAssets(gitToken);
            const currentVersion = TanamaoFoodController.getFoodVersion();
            const hasUpdate = TanamaoFoodController.compareVersions(assets.version, currentVersion) > 0;

            this.updateStatus['tanamao-food'] = {
                hasUpdate,
                version: currentVersion,
                latestVersion: assets.version
            };

            if (hasUpdate) {
                info(PROGRAM_ID, `Nova versão do Tanamao Food detectada: ${assets.version}`);
                // Se o auto_update estiver on, já tenta baixar e instalar
                await TanamaoFoodController.updateFood();
            }
        } catch (err) {
            logError(PROGRAM_ID, `Erro na verificação de atualizações: ${err.message}`);
        }
    }
}

export default new UpdateService();
