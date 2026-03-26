import { Injectable } from '@angular/core';
import { BaseHandler } from './base.handler';
import { Program } from '../../types/Program';

@Injectable({ providedIn: 'root' })
export class PostgresHandler extends BaseHandler {
    readonly programId = 'postgresql';

    override init(onProgress: (id: string, status: Program['status'], progress?: number, message?: string) => void): void {
        if (window.api?.onPostgresProgress) {
            window.api.onPostgresProgress((progress) => {
                if (progress.error) {
                    onProgress(this.programId, 'not-installed');
                } else if (progress.status === 'completed') {
                    onProgress(this.programId, 'installed', 100);
                } else if (progress.status === 'installing') {
                    onProgress(this.programId, 'installing', progress.percentage);
                } else {
                    onProgress(this.programId, 'downloading', progress.percentage);
                }
            });
        }

        if (window.api?.onPostgresConfigProgress) {
            window.api.onPostgresConfigProgress((progress) => {
                if (progress.error) {
                    onProgress(this.programId, 'not-installed');
                } else if (progress.status === 'completed') {
                    onProgress(this.programId, 'installed', 100);
                } else if (progress.status === 'installing') {
                    onProgress(this.programId, 'installing', progress.percentage);
                } else {
                    onProgress(this.programId, 'downloading', progress.percentage);
                }
            });
        }
    }

    async testConnection(config: any): Promise<{ success: boolean; error?: string }> {
        try {
            return await window.api.postgresTestConnection(config);
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}
