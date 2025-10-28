import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs'; // For tabs
import { environment } from '../../environments/environment';

// Interfaces to match backend response
interface UserDetails {
    id: number;
    name: string;
    email: string;
    type: number;
    image: string | null;
    wallet: number;
}
interface PurchaseHistoryItem {
    Title: string;
    ImageUrl: string | null;
    purchase_date: string;
    purchase_price: number;
}
interface TopupHistoryItem {
    amount: number;
    transaction_date: string;
    payment_method: string;
    status: string;
}
interface FullUserDetails {
    user: UserDetails;
    purchaseHistory: PurchaseHistoryItem[];
    topupHistory: TopupHistoryItem[];
}

@Component({
  selector: 'app-detail-view-user',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule
  ],
  templateUrl: './detail-veiw-user.html',
  styleUrls: ['./detail-veiw-user.scss']
})
export class DetailViewUser implements OnInit {
  private readonly API_BASE_URL = 'http://localhost:3000';
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State Signals
  userDetails = signal<FullUserDetails | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.fetchUserDetails(userId);
    } else {
      this.error.set("User ID not found in URL.");
      this.isLoading.set(false);
    }
  }

  async fetchUserDetails(userId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await fetch(`${environment.API_BASE_URL}/users/details/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user details.');
      }
      const data: FullUserDetails = await response.json();

      // Process image URLs
      const processedData = {
        ...data,
        user: {
            ...data.user,
            image: data.user.image ? `${environment.API_BASE_URL}${data.user.image}` : null
        },
        purchaseHistory: data.purchaseHistory.map(item => ({
            ...item,
            ImageUrl: item.ImageUrl ? `${environment.API_BASE_URL}${item.ImageUrl}` : null
        }))
      };

      this.userDetails.set(processedData);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }

  goBackToUserList(): void {
    this.router.navigate(['/view-user']);
  }
}
