import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Program {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  status: 'installed' | 'not-installed' | 'updating' | 'downloading';
  progress?: number;
  hasUpdate: boolean;
  newVersion?: string;
  type: 'app' | 'service';
  isRunning?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private programsSubject = new BehaviorSubject<Program[]>([
    {
      id: 'tanamao-food',
      name: 'Tanamao Food',
      version: '1.2.0',
      description: 'Gestão completa para restaurantes e delivery.',
      icon: 'restaurant',
      status: 'installed',
      hasUpdate: true,
      newVersion: '1.3.0',
      type: 'app'
    },
    {
      id: 'postgres',
      name: 'PostgreSQL',
      version: '18.0',
      description: 'Banco de dados relacional com suporte espacial.',
      icon: 'storage',
      status: 'installed',
      hasUpdate: false,
      type: 'service',
      isRunning: true
    }
  ]);

  getPrograms(): Observable<Program[]> {
    return this.programsSubject.asObservable();
  }

  updateProgramStatus(id: string, status: Program['status'], progress?: number) {
    const programs = this.programsSubject.value.map(p => 
      p.id === id ? { ...p, status, progress } : p
    );
    this.programsSubject.next(programs);
  }

  toggleService(id: string) {
    const programs = this.programsSubject.value.map(p => 
      p.id === id ? { ...p, isRunning: !p.isRunning } : p
    );
    this.programsSubject.next(programs);
  }
}
