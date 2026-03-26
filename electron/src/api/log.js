/**
 * Logs API — Handlers IPC
 * Registra os canais ipcMain para leitura de logs.
 *
 * Canais disponíveis:
 *   logs:get   (programId) → retorna o conteúdo do arquivo de log do programa
 *   logs:list              → retorna os programas disponíveis no registry
 */

import { ipcMain } from 'electron';
import { getLogs, getLogFile, getLogDir } from '../utils/logger.js';
import { programRegistry } from '../programs/registry.js';
import fs from 'fs';

const watchers = new Map();

export function initLogApi() {
    // ── Retornar conteúdo do log de um programa ──────────────────────────────
    ipcMain.handle('logs:get', (_, programId) => {
        try {
            const content = getLogs(programId);
            return { success: true, content };
        } catch (e) {
            return { success: false, error: e.message, content: '' };
        }
    });

    // ── Listar todos os arquivos de log disponíveis no diretório ─────────────
    ipcMain.handle('logs:list', () => {
        try {
            const logDir = getLogDir();
            const registryMap = new Map(
                programRegistry.map(({ metadata }) => [metadata.id, metadata])
            );

            let programs = [];

            console.log(logDir);
            if (fs.existsSync(logDir)) {
                const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));

                programs = files.map(file => {
                    const id = file.replace(/\.log$/, '');
                    const registryProgram = registryMap.get(id);
                    return {
                        id,
                        name: registryProgram?.name ?? id,
                        icon: registryProgram?.icon ?? null,
                    };
                });
            }

            // Fallback: se o diretório ainda não existe, usa o registry
            if (programs.length === 0) {
                programs = programRegistry.map(({ metadata }) => ({
                    id: metadata.id,
                    name: metadata.name,
                    icon: metadata.icon,
                }));
            }

            return { success: true, programs };
        } catch (e) {
            return { success: false, error: e.message, programs: [] };
        }
    });

    // ── Limpar arquivo de log de um programa ──────────────────────────────────
    ipcMain.handle('logs:clear', (_, programId) => {
        try {
            const logFile = getLogFile(programId);
            fs.writeFileSync(logFile, '');
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // ── Assistir mudanças no log ─────────────────────────────────────────────
    ipcMain.on('logs:watch', (event, programId) => {
        const logFile = getLogFile(programId);

        // Se já estiver assistindo outro programa nesta janela, limpa
        if (watchers.has(event.sender.id)) {
            watchers.get(event.sender.id).close();
        }

        if (fs.existsSync(logFile)) {
            const watcher = fs.watch(logFile, (eventType) => {
                if (eventType === 'change') {
                    try {
                        const content = getLogs(programId);
                        event.sender.send('logs:update', { programId, content });
                    } catch (e) {
                        console.error('Erro ao ler log no watch:', e);
                    }
                }
            });
            watchers.set(event.sender.id, watcher);
        }
    });

    ipcMain.on('logs:unwatch', (event) => {
        if (watchers.has(event.sender.id)) {
            watchers.get(event.sender.id).close();
            watchers.delete(event.sender.id);
        }
    });
}
