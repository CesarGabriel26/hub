import { Injectable } from '@angular/core';
import { ProgramHandler } from '../types/ProgramHandler';
import { PostgresHandler } from './handlers/postgres.handler';
import { TanamaoFoodHandler } from './handlers/tanamao-food.handler';

@Injectable({
  providedIn: 'root'
})
export class ProgramRegistryService {
  readonly handlers: ProgramHandler[];

  constructor(
    private postgres: PostgresHandler,
    private tanamaoFood: TanamaoFoodHandler,
  ) {
    this.handlers = [
      this.postgres,
      this.tanamaoFood,
    ];
  }

  getHandler(id: string): ProgramHandler | undefined {
    return this.handlers.find(h => h.programId === id);
  }
}
