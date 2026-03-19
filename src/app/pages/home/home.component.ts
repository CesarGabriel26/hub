import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Program } from '../../services/data.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private dataService = inject(DataService);
  programs$ = this.dataService.getPrograms();

  update(program: Program) {
    // Navigate to download page or start update
    console.log('Update started for', program.name);
  }
}
