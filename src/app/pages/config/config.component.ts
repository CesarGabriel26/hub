import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Program } from '../../services/data.service';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './config.component.html',
  styleUrl: './config.component.css'
})
export class ConfigComponent {
  private dataService = inject(DataService);
  services$ = inject(DataService).getPrograms().pipe(
    map(programs => programs.filter(p => p.type === 'service'))
  );

  toggle(id: string) {
    this.dataService.toggleService(id);
  }
}

import { map } from 'rxjs';
