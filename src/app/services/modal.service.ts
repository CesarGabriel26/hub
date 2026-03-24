import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Program } from '../types/Program';

@Injectable({ providedIn: 'root' })
export class ModalService {
    private showConfigModal = new BehaviorSubject<boolean>(false);
    showConfigModal$ = this.showConfigModal.asObservable();

    private program = new BehaviorSubject<Program | null>(null);
    program$ = this.program.asObservable();

    setShowConfigModal(value: boolean, program?: Program) {
        this.program.next(program || null);
        this.showConfigModal.next(value);
    }

    getShowConfigModal() {
        return this.showConfigModal.value;
    }

    getProgramId() {
        return this.program.value?.id;
    }

    getProgram() {
        return this.program.value;
    }
}
