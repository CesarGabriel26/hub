/**
 * Logs API — Handlers IPC
 * Registra os canais ipcMain para leitura de logs.
 *
 * Canais disponíveis:
 *   logs:get   (programId) → retorna o conteúdo do arquivo de log do programa
 *   logs:list              → retorna os programas disponíveis no registry
 */

import { ipcMain } from 'electron';
import { getLogs } from '../utils/logger.js';
import { programRegistry } from '../programs/registry.js';

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

    // ── Listar programas disponíveis (todos do registry) ─────────────────────
    ipcMain.handle('logs:list', () => {
        try {
            const programs = programRegistry.filter(({ program }) => program.type === 'app').map(({ program }) => ({
                id: program.id,
                name: program.name,
                icon: program.icon,
            }));
            return { success: true, programs };
        } catch (e) {
            return { success: false, error: e.message, programs: [] };
        }
    });
}
