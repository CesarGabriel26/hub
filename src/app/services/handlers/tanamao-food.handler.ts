import { Injectable } from '@angular/core';
import { BaseHandler } from './base.handler';
import { Program } from '../../types/Program';

@Injectable({ providedIn: 'root' })
export class TanamaoFoodHandler extends BaseHandler {
    readonly programId = 'tanamao-food';

    override init(onProgress: (id: string, status: Program['status'], progress?: number, message?: string) => void): void {
        if (window.api?.onTanamaoFoodProgress) {
            window.api.onTanamaoFoodProgress((progress) => {
                if (progress.status === 'installing') {
                    onProgress(this.programId, 'installing', progress.percentage, (progress as any).message);
                } else if (progress.status !== 'completed' && !progress.error) {
                    onProgress(this.programId, 'downloading', progress.percentage, (progress as any).message);
                }
            });
        }

        if (window.api?.onTanamaoFoodConfigProgress) {
            window.api.onTanamaoFoodConfigProgress((progress) => {
                if (progress.status === 'migrating') {
                    onProgress(this.programId, 'installing', progress.percentage, `Configurando banco: ${(progress as any).file || '...'}`);
                }
            });
        }
    }

    override async install(): Promise<{ success: boolean; error?: string }> {
        try {
            const configResult = await window.api.configsGet();
            const installPath = configResult.success ? configResult.configs?.tanamao_food_path : undefined;
            return await window.api.programAction(this.programId, 'install', installPath);
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    override async update(): Promise<{ success: boolean; error?: string }> {
        try {
            return await window.api.programAction(this.programId, 'update');
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async testConnection(config: any): Promise<{ success: boolean; error?: string }> {
        try {
            return await window.api.programAction('postgresql', 'testConnection', config);
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}
