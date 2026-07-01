import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Dashboard } from './features/admin/dashboard/dashboard';
import { NouveauResultat } from './features/technicien/nouveau-resultat/nouveau-resultat';
import { AdminLayout } from './features/admin/admin-layout/admin-layout';
import { TechnicienLayout } from './features/technicien/technicien-layout/technicien-layout';
import { authGuard } from './core/guards/auth-guard';
import { Comptes } from './features/admin/comptes/comptes';
import { Historique } from './features/admin/historique/historique';
import { HistoriqueDetail } from './features/admin/historique-detail/historique-detail';
import { Parametres } from './features/admin/parametres/parametres';
import { HistoriqueTechnicien } from './features/technicien/historique-technicien/historique-technicien';
import { AccessPatient } from './features/patient/access-patient/access-patient';
import { Profil } from './features/profil/profil';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: Login },
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', component: Dashboard },
            { path: 'comptes', component: Comptes },
            { path: 'historique', component: Historique },
            { path: 'historique/:id', component: HistoriqueDetail },
            { path: 'parametres', component: Parametres },
            { path: 'profil', component: Profil }
        ]
    },
    {
        path: 'technicien',
        component: TechnicienLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: NouveauResultat },
            { path: 'historique', component: HistoriqueTechnicien },
            { path: 'profil', component: Profil }
        ]
    },
    { path: 'profil', component: Profil, canActivate: [authGuard] },

    { path: 'access/:token', component: AccessPatient },
    { path: '**', redirectTo: 'login' }
];
