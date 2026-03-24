import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class TanamaoFoodService {
    constructor() { }

    async checkStatus(): Promise<{ isInstalled?: boolean; isRunning?: boolean; version?: string }> {
        const result: { isInstalled?: boolean; isRunning?: boolean; version?: string } = {};
        try {
            const installedResult = await window.api.tanamaoFoodIsInstalled();
            if (installedResult.success) {
                result.isInstalled = installedResult.isInstalled;
            }

            const runningResult = await window.api.tanamaoFoodIsRunning();
            if (runningResult.success) {
                result.isRunning = runningResult.isRunning;
            }

            const versionResult = await window.api.tanamaoFoodVersion();
            if (versionResult.success) {
                result.version = versionResult.version;
            }
        } catch (error) {
            console.error('Failed to check Tanamao Food status:', error);
        }
        return result;
    }

    async install(installPath?: string): Promise<{ success: boolean; error?: string }> {
        try {
            await window.api.tanamaoFoodInstall(installPath)
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async open(): Promise<void> {
        try {
            await window.api.tanamaoFoodOpen();
        } catch (error) {
            console.error('Failed to open Tanamao Food:', error);
        }
    }

    listenToProgress(callback: (progress: { status: string; percentage?: number; error?: string }) => void): void {
        if (window.api && window.api.onTanamaoFoodProgress) {
            window.api.onTanamaoFoodProgress(callback);
        }
    }

    async setupDatabase(): Promise<{ success: boolean; error?: string }> {
        try {
            return await window.api.tanamaoFoodSetupDatabase();
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    listenToConfigProgress(callback: (progress: any) => void) {
        if (window.api && window.api.onTanamaoFoodConfigProgress) {
            window.api.onTanamaoFoodConfigProgress(callback);
        }
    }
}
