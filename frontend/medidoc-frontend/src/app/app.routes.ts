import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Home } from './features/home/home';
import { Dashboard } from './features/admin/dashboard/dashboard';
import { NouveauResultat } from './features/technicien/nouveau-resultat/nouveau-resultat';
import { AdminLayout } from './features/admin/admin-layout/admin-layout';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { SubscriptionGuard } from './core/guards/subscription-guard';
import { Comptes } from './features/admin/comptes/comptes';
import { Historique } from './features/admin/historique/historique';
import { HistoriqueDetail } from './features/admin/historique-detail/historique-detail';
import { Parametres } from './features/admin/parametres/parametres';
import { Hopitaux } from './features/admin/hopitaux/hopitaux';
import { Demandes } from './features/admin/demandes/demandes';
import { DemandesDetail } from './features/admin/demandes-detail/demandes-detail';
import { CreditsPlateforme } from './features/admin/credits-plateforme/credits-plateforme';
import { ResponsablesLabo } from './features/admin/responsables-labo/responsables-labo';
import { Plans } from './features/admin/plans/plans';
import { Subscriptions } from './features/admin/subscriptions/subscriptions';
import { Credits } from './features/lab-manager/credits/credits';
import { HistoriqueTechnicien } from './features/technicien/historique-technicien/historique-technicien';
import { Activite } from './features/admin/activite/activite';
import { AccessPatient } from './features/patient/access-patient/access-patient';
import { Profile } from './features/profile/profile';
import { Inscription } from './features/landing/inscription/inscription';
import { ChoixAbonnement } from './features/subscription/choix-abonnement/choix-abonnement';
import { PaymentCallback } from './features/subscription/payment-callback/payment-callback';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'login', component: Login },
    { path: 'inscription', component: Inscription },
    { path: 'choix-abonnement', component: ChoixAbonnement },
    { path: 'subscription/payment/callback', component: PaymentCallback },
    { path: 'forgot-password', component: ForgotPassword },
    { path: 'reset-password/:token', component: ResetPassword },

    // Admin plateforme : aucune donnée patient. Hôpitaux, demandes d'inscription, crédits, paramètres globaux.
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [roleGuard(['admin'])],
        children: [
            { path: 'hopitaux', component: Hopitaux },
            { path: 'demandes', component: Demandes },
            { path: 'demandes/:id', component: DemandesDetail },
            { path: 'responsables-labo', component: ResponsablesLabo },
            { path: 'credits', component: CreditsPlateforme },
            { path: 'plans', component: Plans },
            { path: 'subscriptions', component: Subscriptions },
            { path: 'parametres', component: Parametres },
            { path: '', redirectTo: 'hopitaux', pathMatch: 'full' }
        ]
    },

    // Responsable de labo : dashboard, comptes techniciens, historique, crédits de son hôpital.
    {
        path: 'lab-manager',
        component: AdminLayout,
        canActivate: [roleGuard(['lab_manager']), SubscriptionGuard],
        children: [
            { path: 'dashboard', component: Dashboard },
            { path: 'comptes', component: Comptes },
            { path: 'historique', component: Historique },
            { path: 'historique/:id', component: HistoriqueDetail },
            { path: 'activite', component: Activite },
            { path: 'credits', component: Credits },
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
    },

    // Technicien
    {
        path: 'technicien',
        component: AdminLayout,
        canActivate: [roleGuard(['technician']), SubscriptionGuard],
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

    { path: 'access/:token', component: AccessPatient },
    { path: '**', redirectTo: 'login' }
];