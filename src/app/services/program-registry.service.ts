import { Injectable } from '@angular/core';
import { ProgramHandler } from '../types/ProgramHandler';
import { PostgresHandler } from './handlers/postgres.handler';
import { TanamaoFoodHandler } from './handlers/tanamao-food.handler';

@Injectable({
  providedIn: 'root'
})
export class ProgramRegistryService {
  private handlersMap = new Map<string, ProgramHandler>();

  constructor(
    private postgres: PostgresHandler,
    private tanamaoFood: TanamaoFoodHandler,
  ) {
    const registry = [this.postgres, this.tanamaoFood];
    registry.forEach(h => this.handlersMap.set(h.programId, h));
  }

  get handlers(): ProgramHandler[] {
    return Array.from(this.handlersMap.values());
  }

  getHandler(id: string): ProgramHandler | undefined {
    return this.handlersMap.get(id);
  }
}
