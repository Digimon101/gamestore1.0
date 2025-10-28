import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

// Interface matching the items returned by GET /cart/:userId API endpoint
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

// Interface for the response from the applyCoupon API
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

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss']
})
export class Cart implements OnInit {
  private readonly API_BASE_URL = 'http://localhost:3000';
  private readonly CART_STORAGE_KEY = 'shopping_cart';
  private router = inject(Router);

  // Cart Signals
  cartItems = signal<CartItem[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  currentUser = signal<User | null>(null);
  isCheckingOut = signal<boolean>(false);

  // Coupon Signals
  couponCodeInput = signal<string>('');
  appliedCoupon = signal<ApplyCouponResponse | null>(null);
  couponError = signal<string | null>(null);
  isApplyingCoupon = signal<boolean>(false);

  // Computed Prices
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

  async loadInitialData() {
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

  async fetchCartItems(userId: number) {
    this.isLoading.set(true);
    this.error.set(null);
    const apiUrl = `${environment.API_BASE_URL}/cart/${userId}`;

    // Clear applied coupon when reloading cart
    this.appliedCoupon.set(null);
    this.couponCodeInput.set('');
    this.couponError.set(null);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        if (response.status === 404) {
          this.cartItems.set([]);
          this.updateLocalStorage([]);
          return;
        }
        throw new Error(`Failed to fetch cart items: ${response.statusText}`);
      }

      const items: CartItem[] = await response.json();

      const processedItems = items.map(item => ({
        ...item,
        ImageUrl: item.ImageUrl ? `${environment.API_BASE_URL}${item.ImageUrl}` : null
      }));

      this.cartItems.set(processedItems);
      this.updateLocalStorage(processedItems);

    } catch (err) {
      console.error('Error fetching cart:', err);
      this.error.set(err instanceof Error ? err.message : 'Could not load cart data.');
      this.cartItems.set([]);
      this.updateLocalStorage([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private updateLocalStorage(items: CartItem[]): void {
    const localCartItems = items.map(item => ({
      id: item.GameID,
      name: item.Title,
      price: item.Price,
      quantity: item.quantity,
      imageUrl: item.ImageUrl
    }));
    localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(localCartItems));
    
    // Trigger storage event for other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: this.CART_STORAGE_KEY,
      newValue: JSON.stringify(localCartItems),
      url: window.location.href
    }));
    console.log('🔄 localStorage updated:', localCartItems);
  }

  async updateQuantity(item: CartItem, change: number) {
    const newQuantity = item.quantity + change;
    if (newQuantity < 0) return;

    const user = this.currentUser();
    if (!user) return;

    const apiUrl = `${environment.API_BASE_URL}/cart/${item.CartItemID}`;

    // Clear applied coupon when cart changes
    this.appliedCoupon.set(null);
    this.couponCodeInput.set('');
    this.couponError.set(null);

    try {
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, quantity: newQuantity })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to update quantity.');
      }

      if (newQuantity === 0) {
        this.cartItems.update(items => {
          const updatedItems = items.filter(i => i.CartItemID !== item.CartItemID);
          this.updateLocalStorage(updatedItems);
          return updatedItems;
        });
      } else {
        this.cartItems.update(items => {
          const updatedItems = items.map(i => 
            i.CartItemID === item.CartItemID ? { ...i, quantity: newQuantity } : i
          );
          this.updateLocalStorage(updatedItems);
          return updatedItems;
        });
      }
    } catch (err) {
      console.error('Error updating quantity:', err);
      alert(err instanceof Error ? err.message : 'Could not update item quantity.');
    }
  }

  increaseQuantity(item: CartItem): void {
    this.updateQuantity(item, 1);
  }

  decreaseQuantity(item: CartItem): void {
    this.updateQuantity(item, -1);
  }

  async removeItem(item: CartItem): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    const apiUrl = `${environment.API_BASE_URL}/cart/${item.CartItemID}`;

    // Clear applied coupon when cart changes
    this.appliedCoupon.set(null);
    this.couponCodeInput.set('');
    this.couponError.set(null);

    try {
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to remove item.');
      }

      this.cartItems.update(items => {
        const updatedItems = items.filter(i => i.CartItemID !== item.CartItemID);
        this.updateLocalStorage(updatedItems);
        return updatedItems;
      });

      console.log('✅ Item removed and localStorage updated');

    } catch (err) {
      console.error('Error removing item:', err);
      alert(err instanceof Error ? err.message : 'Could not remove item from cart.');
    }
  }

  // Apply Coupon Function
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
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Invalid coupon code (${response.status})`);
      }

      // Success
      this.appliedCoupon.set(result);
      this.couponCodeInput.set(result.couponCode);
      this.couponError.set(null);

    } catch (error) {
      console.error('Error applying coupon:', error);
      this.couponError.set(error instanceof Error ? error.message : 'Could not apply coupon.');
      this.appliedCoupon.set(null);
    } finally {
      this.isApplyingCoupon.set(false);
    }
  }

  // Remove Coupon Function
  removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponCodeInput.set('');
    this.couponError.set(null);
  }

  async proceedToCheckout(): Promise<void> {
    const user = this.currentUser();
    const applied = this.appliedCoupon();
    
    if (!user || this.cartItems().length === 0) return;

    const apiUrl = `${environment.API_BASE_URL}/checkout`;
    this.isCheckingOut.set(true);

    const payload = {
      userId: user.id,
      couponCode: applied ? applied.couponCode : null
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Checkout failed.');
      }

      alert(`Checkout successful! Final Price: ${result.finalPrice?.toFixed(2)}, New Balance: ${result.newBalance?.toFixed(2)}`);
      
      // Clear cart, localStorage, and coupon
      this.cartItems.set([]);
      this.updateLocalStorage([]);
      this.appliedCoupon.set(null);
      this.couponCodeInput.set('');
      this.couponError.set(null);

      this.router.navigate(['/profile']);

    } catch (err) {
      console.error('Error during checkout:', err);
      alert(err instanceof Error ? err.message : 'An error occurred during checkout.');
    } finally {
      this.isCheckingOut.set(false);
    }
  }

  continueShopping(): void {
    this.router.navigate(['/main']);
  }
}