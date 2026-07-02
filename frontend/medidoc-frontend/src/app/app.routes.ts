import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
<<<<<<< HEAD
import { Home } from './features/home/home';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password';
=======
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Home } from './features/home/home';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
import { Dashboard } from './features/admin/dashboard/dashboard';
import { NouveauResultat } from './features/technicien/nouveau-resultat/nouveau-resultat';
import { AdminLayout } from './features/admin/admin-layout/admin-layout';
import { TechnicienLayout } from './features/technicien/technicien-layout/technicien-layout';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { Comptes } from './features/admin/comptes/comptes';
import { Historique } from './features/admin/historique/historique';
import { HistoriqueDetail } from './features/admin/historique-detail/historique-detail';
import { Parametres } from './features/admin/parametres/parametres';
import { Hopitaux } from './features/admin/hopitaux/hopitaux';
import { Demandes } from './features/admin/demandes/demandes';
import { CreditsPlateforme } from './features/admin/credits-plateforme/credits-plateforme';
import { EnvoiConfig } from './features/lab-manager/envoi-config/envoi-config';
import { Credits } from './features/lab-manager/credits/credits';
import { HistoriqueTechnicien } from './features/technicien/historique-technicien/historique-technicien';
import { AccessPatient } from './features/patient/access-patient/access-patient';
<<<<<<< HEAD
import { Profil } from './features/profil/profil';
=======
import { Profile } from './features/profile/profile';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'login', component: Login },
<<<<<<< HEAD
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
=======
    { path: 'forgot-password', component: ForgotPassword },
    { path: 'reset-password/:token', component: ResetPassword },

    // Admin plateforme : aucune donnée patient. Hôpitaux, demandes d'inscription, crédits, paramètres globaux.
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [roleGuard(['admin'])],
        children: [
            { path: 'hopitaux', component: Hopitaux },
            { path: 'demandes', component: Demandes },
            { path: 'credits', component: CreditsPlateforme },
            { path: 'parametres', component: Parametres },
            { path: '', redirectTo: 'hopitaux', pathMatch: 'full' }
        ]
    },

    // Responsable de labo : dashboard, comptes techniciens, historique, config d'envoi, crédits de son hôpital.
    {
        path: 'lab-manager',
        component: AdminLayout,
        canActivate: [roleGuard(['lab_manager'])],
        children: [
            { path: 'dashboard', component: Dashboard },
            { path: 'comptes', component: Comptes },
            { path: 'historique', component: Historique },
            { path: 'historique/:id', component: HistoriqueDetail },
<<<<<<< HEAD
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
=======
            { path: 'envoi', component: EnvoiConfig },
            { path: 'credits', component: Credits },
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
    },

    // Technicien
    {
        path: 'technicien',
        component: AdminLayout,
        canActivate: [roleGuard(['technician'])],
        children: [
            { path: '', component: NouveauResultat },
            { path: 'historique', component: HistoriqueTechnicien }
        ]
    },

    // Profil : commun aux 3 rôles
    {
        path: 'profil',
        component: AdminLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: Profile }
        ]
    },
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

    { path: 'access/:token', component: AccessPatient },
    { path: '**', redirectTo: 'login' }
];
