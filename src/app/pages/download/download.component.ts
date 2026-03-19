import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download.component.html',
  styleUrl: './download.component.css'
})
export class DownloadComponent {
  private dataService = inject(DataService);
  programs$ = this.dataService.getPrograms();
  // Mock logic to check if any program is downloading/updating
  hasActiveTask$ = new BehaviorSubject<boolean>(false); // In a real app, this would be derived from programs$
}

import { BehaviorSubject } from 'rxjs';
