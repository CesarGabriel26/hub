import { Component, OnInit, signal } from '@angular/core';
import { DataService } from '../../services/data.service';
import { ModalService } from '../../services/modal.service';
import { Observable } from 'rxjs';
import { AsyncPipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { Program } from '../../types/Program';

@Component({
    selector: 'app-config-modal',
    imports: [AsyncPipe, KeyValuePipe, NgTemplateOutlet],
    templateUrl: './config-modal.html',
})
export class ConfigModal implements OnInit {

    showConfigModal$!: Observable<boolean>;
    program$!: Observable<Program>;

    configs = signal<any>({});

    constructor(
        private dataService: DataService,
        private modalService: ModalService
    ) {
        this.showConfigModal$ = this.modalService.showConfigModal$;
        this.program$ = this.modalService.program$ as Observable<Program>;
    }

    ngOnInit(): void {
        this.showConfigModal$.subscribe((show) => {
            if (show) {
                this.load();
            }
        });
    }

    async load() {
        // buscar config.json no app data, na pasta do programa, pasta tem o mesmo nome do id
        // se existir, abrir em uma modal
        // se não existir, criar um config.json vazio
        // na modal, mostrar os campos do config.json
        // salvar os campos do config.json
        // fechar a modal
        const config = await this.dataService.getProgramConfig(this.modalService.getProgramId()!);
        this.configs.set(config);
    }

    isString(value: any): boolean {
        return typeof value === 'string';
    }

    isNumber(value: any): boolean {
        return typeof value === 'number';
    }

    isBoolean(value: any): boolean {
        return typeof value === 'boolean';
    }

    updateValue(path: string, event: Event) {
        const input = event.target as HTMLInputElement;
        const value = input.value;

        this.configs.update(cfg => {
            const newCfg = structuredClone(cfg);
            this.setValueByPath(newCfg, path, value);
            return newCfg;
        });
    }

    updateCheckbox(path: string, event: Event) {
        const input = event.target as HTMLInputElement;

        this.configs.update(cfg => {
            const newCfg = structuredClone(cfg);
            this.setValueByPath(newCfg, path, input.checked);
            return newCfg;
        });
    }

    getType(value: any): 'string' | 'number' | 'boolean' | 'object' {
        if (value === null) return 'string';
        if (typeof value === 'object') return 'object';
        return typeof value as any;
    }

    buildKey(parent: string, key: any): string {
        const keyStr = String(key);
        return parent ? `${parent}.${keyStr}` : keyStr;
    }

    closeModal() {
        this.modalService.setShowConfigModal(false);
    }

    setValueByPath(obj: any, path: string, value: any) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }

        const lastKey = keys[keys.length - 1];

        // mantém tipo original
        if (typeof current[lastKey] === 'number') {
            current[lastKey] = Number(value);
        } else {
            current[lastKey] = value;
        }
    }

    async saveConfig() {
        await this.dataService.saveProgramConfig(
            this.modalService.getProgramId()!,
            this.configs()
        );

        this.modalService.setShowConfigModal(false);
    }
}
