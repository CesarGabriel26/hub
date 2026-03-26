import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ProgramManager from './program-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const programRegistry = [];

/**
 * Inicializa o registro de programas escaneando subpastas.
 */
export async function initializeRegistry() {
    const programsPath = __dirname;
    const entries = fs.readdirSync(programsPath, { withFileTypes: true });

    for (const entry of entries) {
        // Ignora arquivos e foca em subdiretórios
        if (entry.isDirectory()) {
            const indexPath = path.join(programsPath, entry.name, 'index.js');
            
            if (fs.existsSync(indexPath)) {
                try {
                    // Importa dinamicamente o index.js do programa
                    // Usamos a sintaxe de importação dinâmica do ESM
                    const modulePath = `./${entry.name}/index.js`;
                    const module = await import(modulePath);
                    const program = module.default;

                    if (program && program.metadata && program.controller) {
                        ProgramManager.register(program.metadata, program.controller);
                        programRegistry.push(program);
                    }
                } catch (err) {
                    console.error(`Falha ao carregar programa "${entry.name}":`, err);
                }
            }
        }
    }
}

export { ProgramManager, programRegistry };
