import { Injectable } from '@angular/core';
import { Program } from '../types/Program';

@Injectable({
    providedIn: 'root'
})
export class PostgresService {
    constructor() { }

    async checkStatus(): Promise<{ version?: string; isRunning?: boolean }> {
        const result: { version?: string; isRunning?: boolean } = {};
        try {
            const versionResult = await window.api.postgresVersion();
            if (versionResult.success && versionResult.version) {
                result.version = versionResult.version;
            }

            const runningResult = await window.api.postgresRunning();
            if (runningResult.success) {
                result.isRunning = runningResult.isRunning;
            }
        } catch (error) {
            console.error('Failed to check Postgres status:', error);
        }
        return result;
    }

    async install(): Promise<{ success: boolean; error?: string }> {
        const status = await this.checkStatus();
        if (status.version) {
            console.log('Postgres is already installed');
            return { success: true };
        }

        try {
            return await window.api.postgresInstall();
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async start(): Promise<{ success: boolean; error?: string }> {
        try {
            return await window.api.postgresStart();
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    listenToProgress(callback: (progress: any) => void) {
        if (window.api && window.api.onPostgresProgress) {
            window.api.onPostgresProgress(callback);
        }
    }

    async setup(): Promise<{ success: boolean; error?: string }> {
        try {
            return await window.api.postgresSetup();
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    listenToConfigProgress(callback: (progress: any) => void) {
        if (window.api && window.api.onPostgresConfigProgress) {
            window.api.onPostgresConfigProgress(callback);
        }
    }
}
