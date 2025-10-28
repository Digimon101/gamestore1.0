import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

// --- Interfaces ---
interface CartItem {
  CartItemID: number;
  GameID: number;
  Title: string;
  Price: number;
  ImageUrl: string | null;
  quantity: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  type: number;
}

interface ApplyCouponResponse {
  message: string;
  couponCode: string;
  discountAmount: number;
  originalPrice: number;
  finalPrice: number;
  couponDetails: {
    type: 'percentage' | 'fixed';
    value: number;
  };
}

// --- Component ---
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss']
})
export class Cart implements OnInit {
  private readonly CART_STORAGE_KEY = 'shopping_cart';
  private router = inject(Router);

  // --- State Signals ---
  cartItems = signal<CartItem[]>([]);
  isLoading = signal<boolean>(true);
  isCheckingOut = signal<boolean>(false);
  currentUser = signal<User | null>(null);

  // --- Feedback Signals ---
  error = signal<string | null>(null); // For general page errors
  successMessage = signal<string | null>(null); // For checkout success

  // --- Coupon Signals ---
  couponCodeInput = signal<string>('');
  appliedCoupon = signal<ApplyCouponResponse | null>(null);
  couponError = signal<string | null>(null); // For coupon-specific errors
  isApplyingCoupon = signal<boolean>(false);

  // --- Computed Signals ---
  originalTotalPrice = computed(() => {
    return this.cartItems().reduce((total, item) => total + (item.Price * item.quantity), 0);
  });

  finalPrice = computed(() => {
    const applied = this.appliedCoupon();
    return applied ? applied.finalPrice : this.originalTotalPrice();
  });

  ngOnInit() {
    this.loadInitialData();
  }

  // --- Initialization ---
  async loadInitialData() {
    this.isLoading.set(true);
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.error.set("Please log in to view your cart.");
      this.isLoading.set(false);
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.currentUser.set(JSON.parse(userStr));
    } catch (e) {
      this.error.set("Invalid user data. Please log in again.");
      this.isLoading.set(false);
      localStorage.removeItem('user');
      this.router.navigate(['/login']);
      return;
    }

    if (this.currentUser()) {
      await this.fetchCartItems(this.currentUser()!.id);
    } else {
      this.isLoading.set(false);
    }
  }

  // --- API: Fetch Cart ---
  async fetchCartItems(userId: number) {
    this.isLoading.set(true);
    this.clearAllFeedback(); // Clear all old messages
    const apiUrl = `${environment.API_BASE_URL}/cart/${userId}`;

    try {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        if (response.status === 404) { // 404 is not an error, just empty cart
          this.cartItems.set([]);
          this.updateLocalStorage([]);
          return;
        }
        // Try to parse error message from backend
        await this.throwBackendError(response, 'Failed to fetch cart');
      }

      const items: CartItem[] = await response.json();
      const processedItems = items.map(item => ({
        ...item,
        ImageUrl: item.ImageUrl ? `${environment.API_BASE_URL}${item.ImageUrl}` : null
      }));

      this.cartItems.set(processedItems);
      this.updateLocalStorage(processedItems);

    } catch (err: unknown) {
      this.handleApiError(err, 'Could not load cart data.');
      this.cartItems.set([]); // Ensure cart is empty on failure
      this.updateLocalStorage([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- API: Remove Item ---
  async removeItem(item: CartItem): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    this.clearAllFeedback();
    const apiUrl = `${environment.API_BASE_URL}/cart/${item.CartItemID}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        await this.throwBackendError(response, 'Failed to remove item');
      }

      // Success: Update UI
      this.cartItems.update(items => {
        const updatedItems = items.filter(i => i.CartItemID !== item.CartItemID);
        this.updateLocalStorage(updatedItems);
        return updatedItems;
      });
      console.log('✅ Item removed and localStorage updated');

    } catch (err: unknown) {
      this.handleApiError(err, 'Could not remove item from cart.');
    }
  }

  // --- API: Apply Coupon ---
  async applyCoupon(): Promise<void> {
    const code = this.couponCodeInput().trim().toUpperCase();
    const user = this.currentUser();
    
    if (!code || !user) {
      this.couponError.set('Please enter a coupon code.');
      return;
    }
    if (!this.cartItems().length) {
      this.couponError.set('Your cart is empty.');
      return;
    }

    this.isApplyingCoupon.set(true);
    this.couponError.set(null);
    this.appliedCoupon.set(null);

    try {
      const response = await fetch(`${environment.API_BASE_URL}/cart/apply-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, couponCode: code })
      });

      const result = await response.json(); // Read JSON body once

      if (!response.ok) {
        throw new Error(result.message || `Invalid coupon code (${response.status})`);
      }

      // Success
      this.appliedCoupon.set(result);
      this.couponCodeInput.set(result.couponCode); // Set to the corrected-case code
      this.couponError.set(null);

    } catch (err: unknown) {
      this.handleApiError(err, 'Could not apply coupon.', true); // Use coupon error signal
      this.appliedCoupon.set(null);
    } finally {
      this.isApplyingCoupon.set(false);
    }
  }

  // --- API: Checkout ---
  async proceedToCheckout(): Promise<void> {
    const user = this.currentUser();
    const applied = this.appliedCoupon();
    
    if (!user || this.cartItems().length === 0) return;

    this.isCheckingOut.set(true);
    this.clearAllFeedback();

    const payload = {
      userId: user.id,
      couponCode: applied ? applied.couponCode : null
    };

    try {
      const response = await fetch(`${environment.API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json(); // Read JSON body once

      if (!response.ok) {
        throw new Error(result.message || 'Checkout failed.');
      }

      // --- Checkout Success ---
      this.successMessage.set(`Checkout successful! Final Price: ${result.finalPrice?.toFixed(2)}, New Balance: ${result.newBalance?.toFixed(2)}`);
      
      // Clear cart, localStorage, and coupon
      this.cartItems.set([]);
      this.updateLocalStorage([]);
      this.removeCoupon(); // Clear coupon state

      // Redirect after a short delay so user can see success message
      setTimeout(() => {
        this.router.navigate(['/profile']);
      }, 3000); // 3-second delay

    } catch (err: unknown) {
      this.handleApiError(err, 'An error occurred during checkout.');
    } finally {
      this.isCheckingOut.set(false);
    }
  }

  // --- UI Helpers ---

  removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponCodeInput.set('');
    this.couponError.set(null);
  }

  continueShopping(): void {
    this.router.navigate(['/main']);
  }

  // --- Private Utilities ---

  private updateLocalStorage(items: CartItem[]): void {
    const localCartItems = items.map(item => ({
      id: item.GameID,
      name: item.Title,
      price: item.Price,
      quantity: item.quantity,
      imageUrl: item.ImageUrl
    }));
    localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(localCartItems));
    
    // Trigger storage event for other components (like header cart count)
    window.dispatchEvent(new StorageEvent('storage', {
      key: this.CART_STORAGE_KEY,
      newValue: JSON.stringify(localCartItems),
      url: window.location.href
    }));
    console.log('🔄 localStorage updated:', localCartItems);
  }

  /**
   * Clears all error and success messages from the UI.
   */
  private clearAllFeedback(): void {
    this.error.set(null);
    this.couponError.set(null);
    this.successMessage.set(null);
    this.appliedCoupon.set(null); // Clear coupon on any cart change
  }

  /**
   * Attempts to parse the backend JSON error message from a failed response.
   */
  private async throwBackendError(response: Response, defaultMessage: string): Promise<never> {
    try {
      const errResult = await response.json();
      throw new Error(errResult.message || `${defaultMessage}: ${response.statusText}`);
    } catch (e) {
      // Fallback if .json() fails or if errResult.message doesn't exist
      throw new Error(`${defaultMessage}: ${response.statusText}`);
    }
  }

  /**
   * Centralized error handler to log errors and set the correct UI signal.
   */
  private handleApiError(error: unknown, defaultMessage: string, isCouponError: boolean = false): void {
    console.error('API Error:', error); // Log the raw error
    
    let message = defaultMessage;
    if (error instanceof Error) {
      message = error.message; // This will catch errors thrown from throwBackendError
    }
    
    if (isCouponError) {
      this.couponError.set(message);
    } else {
      this.error.set(message); // Set the general page error signal
    }
  }
}
