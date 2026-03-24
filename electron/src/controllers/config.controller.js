import fs from 'fs';
import path from 'path';

class ConfigController {
    // cria arquivo de config na pasta alvo
    createConfig(rootPath, data) {
        const configPath = path.join(rootPath, 'configs.json');

        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(data));
        }

        return configPath
    }

    // lê arquivo de config na pasta alvo
    readConfig(rootPath) {
        const configPath = path.join(rootPath, 'configs.json');

        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath));
        }

        return null
    }

    // atualiza arquivo de config na pasta alvo
    updateConfig(rootPath, data) {
        const configPath = path.join(rootPath, 'configs.json');

        fs.writeFileSync(configPath, JSON.stringify(data));

        return configPath
    }

    // deleta arquivo de config na pasta alvo
    deleteConfig(rootPath) {
        const configPath = path.join(rootPath, 'configs.json');

        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        return configPath
    }
}

export default new ConfigController();