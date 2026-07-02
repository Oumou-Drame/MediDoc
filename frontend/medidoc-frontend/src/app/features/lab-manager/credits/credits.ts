import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../core/services/admin-service';

interface Transaction {
  id: number;
  type: 'recharge' | 'deduction' | 'adjustment';
  amount: string;
  balance_after: string;
  note: string | null;
  created_at: string;
}

@Component({
  selector: 'app-credits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credits.html',
  styleUrl: './credits.css',
})
export class Credits implements OnInit {
  private adminService = inject(AdminService);

  chargement = true;
  balance = 0;
  transactions: Transaction[] = [];

  ngOnInit(): void {
    this.adminService.getCredits().subscribe({
      next: (res) => {
        this.balance = res.data.balance;
        this.transactions = res.data.transactions;
        this.chargement = false;
      },
      error: () => { this.chargement = false; }
    });
  }
}
