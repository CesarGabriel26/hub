import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { DownloadComponent } from './pages/download/download.component';
import { ConfigComponent } from './pages/config/config.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'download', component: DownloadComponent },
  { path: 'config', component: ConfigComponent},
];
