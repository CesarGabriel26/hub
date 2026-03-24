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

        try {
            info(PROGRAM_ID, 'Iniciando verificação de atualização para Tanamao Food...');
            // O próprio updateFood já verifica se há uma versão nova antes de baixar
            const result = await TanamaoFoodController.updateFood();
            
            if (result.success && result.message !== 'Já atualizado.') {
                info(PROGRAM_ID, 'Tanamao Food atualizado com sucesso via serviço automático.');
            }
        } catch (err) {
            logError(PROGRAM_ID, `Erro na verificação de atualizações: ${err.message}`);
        }
    }
}

export default new UpdateService();
