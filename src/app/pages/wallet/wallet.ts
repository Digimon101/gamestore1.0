import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { MatIconModule } from '@angular/material/icon';

// --- Interface for history items ---
interface TopupHistoryItem {
  id: number;
  amount: number;
  transaction_date: string;
  payment_method: string;
  status: string;
}
interface PurchaseHistoryItem {
  Title: string;
  ImageUrl: string | null;
  purchase_date: string;
  purchase_price: number;
}

interface User {
  id: number;
  name: string;
  wallet: number;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule,MatIconModule], // Add FormsModule
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss'
})
export class Wallet implements OnInit {
  private readonly API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';
  private router = inject(Router);

  currentUser = signal<User | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  // --- Signal for top-up history ---
  topupHistory = signal<TopupHistoryItem[]>([]);
  isHistoryLoading = signal<boolean>(true);

  // --- [NEW] Signals for Purchase History ---
  purchaseHistory = signal<PurchaseHistoryItem[]>([]);
  isPurchaseHistoryLoading = signal<boolean>(true);

  activeHistoryTab = signal<'topup' | 'purchase'>('topup');
  // Modal states
  isAddFundsModalVisible = signal<boolean>(false);
  addFundsAmount = signal<number | null>(null);
  isUpdatingBalance = signal<boolean>(false);

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      await Promise.all([
        this.fetchWalletData(userData.id),
        this.fetchTopupHistory(userData.id),
        this.fetchPurchaseHistory(userData.id) // [NEW] Fetch purchase history
      ]); // Fetch history after user data
    } catch {
      this.router.navigate(['/login']);
    }
  }

  async fetchWalletData(userId: string) {
    this.isLoading.set(true);
    try {
      const response = await fetch(`${this.API_BASE_URL}/wallet/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch wallet data.');
      const data: User = await response.json();
      this.currentUser.set(data);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.isLoading.set(false);
    }

  }

  // --- Function to fetch top-up history ---
  async fetchTopupHistory(userId: string) {
    this.isHistoryLoading.set(true);
    try {
      const response = await fetch(`${this.API_BASE_URL}/wallet/history/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch history.');
      const history: TopupHistoryItem[] = await response.json();
      this.topupHistory.set(history);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      this.isHistoryLoading.set(false);
    }
  }

  async fetchPurchaseHistory(userId: string) {
    this.isPurchaseHistoryLoading.set(true);
    try {
      const response = await fetch(`${this.API_BASE_URL}/wallet/purchase-history/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch purchase history.');

      const history: PurchaseHistoryItem[] = await response.json();

      // Process image URLs
      const processedHistory = history.map(item => ({
        ...item,
        ImageUrl: item.ImageUrl ? `${this.API_BASE_URL}${item.ImageUrl}` : null
      }));

      this.purchaseHistory.set(processedHistory);
    } catch (err) {
      console.error("Purchase history fetch error:", err);
    } finally {
      this.isPurchaseHistoryLoading.set(false);
    }
  }
  selectHistoryTab(tab: 'topup' | 'purchase') {
    this.activeHistoryTab.set(tab);
  }

  showAddFundsModal() {
    this.addFundsAmount.set(null);
    this.isAddFundsModalVisible.set(true);
  }

  async confirmAddFunds() {
    const amount = this.addFundsAmount();
    const user = this.currentUser();
    if (!amount || amount <= 0 || !user) return;

    this.isUpdatingBalance.set(true);
    try {
      const response = await fetch(`${this.API_BASE_URL}/wallet/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      // Refresh wallet and history data
      await this.fetchWalletData(user.id.toString());
      await this.fetchTopupHistory(user.id.toString());

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      this.isUpdatingBalance.set(false);
      this.isAddFundsModalVisible.set(false);
    }
  }

  closeModal() {
    this.isAddFundsModalVisible.set(false);
  }

  goHome() {
    this.router.navigate(['/main']);
  }
}

