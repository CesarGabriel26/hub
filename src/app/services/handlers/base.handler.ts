import { Program } from '../../types/Program';
import { ProgramHandler } from '../../types/ProgramHandler';

export abstract class BaseHandler implements ProgramHandler {
    abstract readonly programId: string;

    init(onProgress: (id: string, status: Program['status'], progress?: number, message?: string) => void): void {
        // Default implementation (can be overridden)
    }

    async checkStatus(): Promise<Partial<Program>> {
        const programs = await window.api.getPrograms();
        const program = programs.find(p => p.id === this.programId);
        return program || { status: 'not-installed' };
    }

    async install(): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'install');
    }

    async uninstall(): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'uninstall');
    }

    async open(): Promise<void> {
        return await window.api.programAction(this.programId, 'open');
    }

    async setup(): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'setup');
    }

    async update(): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'update');
    }

    async config(): Promise<{ success: boolean; config?: any }> {
        return await window.api.programAction(this.programId, 'config');
    }

    async configSave(config: any): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'configSave', config);
    }

    async start(): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'start');
    }

    async stop(): Promise<{ success: boolean; error?: string }> {
        return await window.api.programAction(this.programId, 'stop');
    }
}
