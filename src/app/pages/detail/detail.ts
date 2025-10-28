import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, formatDate } from '@angular/common'; // Import needed pipes/functions
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'; // Import MatIconModule
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

// Interfaces
interface User { id: number; name: string; email: string; type: number; }
interface GameDetails {
  GameID: number;
  Title: string;
  ReleaseDate: string;
  Price: number;
  Description: string | null; // Allow null
  ImageUrl: string | null;
  SelectedGenreIDs: number[];
  // Promotion fields (might be null)
  DiscountPercentage: number | null;
  PromotionStartDate: string | null;
  PromotionEndDate: string | null;
}
interface TopSellerGame { GameID: number; Title: string; ImageUrl: string | null; Price: number; DiscountPercentage: number | null; } // Add Price/Discount
interface CartItem { id: number; name: string; price: number; quantity: number; imageUrl: string | null; }
interface AddToCartPayload { userId: number; gameId: number; quantity?: number; }


@Component({
  selector: 'app-game-detail',
  standalone: true,
  // [MODIFIED] Add MatIconModule if not already present implicitly
  imports: [CommonModule, RouterLink, MatIconModule], 
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss']
})
export class Detail implements OnInit, OnDestroy {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly API_BASE_URL = 'http://localhost:3000';
  private readonly CART_STORAGE_KEY = 'shopping_cart';
  private notificationTimer: any = null;

  // --- Component State Signals ---
  game = signal<GameDetails | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  currentUser = signal<User | null>(null);
  isPurchased = signal<boolean>(false);
  topSellers = signal<TopSellerGame[]>([]); // Uses updated interface

  // --- [NEW] Cart State Signals ---
  cartItemIds = signal<number[]>([]);

  // --- [NEW] Notification Signals ---
  isNotificationVisible = signal<boolean>(false);
  notificationMessage = signal<string>('');
  notificationIcon = signal<'check_circle' | 'error_outline' | 'info_outline'>('check_circle');

  // Removed purchase popup signals

  private routeSubscription: Subscription | undefined;
  activeTab: string = 'about';

  ngOnInit(): void {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) this.currentUser.set(JSON.parse(userStr));
    } catch (e) { console.error("Failed to parse user", e); }

    // [MODIFIED] Load cart state on init
    this.loadCartItemIds();

    this.routeSubscription = this.route.paramMap.subscribe(params => {
        const gameId = params.get('id');
        if (gameId) {
            window.scrollTo(0, 0);
            this.isPurchased.set(false); // Reset purchase status
            this.fetchGameDetails(gameId); // Fetch game details
        } else {
            this.error.set('Could not find a Game ID in the URL.');
            this.isLoading.set(false);
        }
    });

    this.fetchTopSellers(); // Fetch top sellers
  }

  ngOnDestroy(): void {
      this.routeSubscription?.unsubscribe();
  }

  // --- Data Fetching ---
  async fetchGameDetails(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      // Fetch game details (include promotion from backend if available)
      const response = await fetch(`${environment.API_BASE_URL}/games/${id}`);
      if (!response.ok) { /* ... error handling ... */ throw new Error('Failed to fetch');}
      const gameData: GameDetails = await response.json();
      const processedGame = {
        ...gameData,
        Description: gameData.Description ?? '', // Handle null
        ImageUrl: gameData.ImageUrl ? `${environment.API_BASE_URL}${gameData.ImageUrl}` : null
      };
      this.game.set(processedGame);

      // Check purchase status after fetching
      if (this.currentUser()) {
          await this.checkPurchaseStatus(this.currentUser()!.id, gameData.GameID);
      }
    } catch (err: any) {
      this.error.set(err.message || 'An unknown error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchTopSellers(): Promise<void> {
    // [MODIFIED] Fetch from the correct top-sellers endpoint
    const apiUrl = `${environment.API_BASE_URL}/games/top-sellers`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Could not load top sellers.');
        const topGames: TopSellerGame[] = await response.json(); // Use TopSellerGame interface

        // Process image URLs
        const processedGames = topGames.map(game => ({
            ...game,
            ImageUrl: game.ImageUrl
                ? `${environment.API_BASE_URL}${game.ImageUrl}`
                : 'https://placehold.co/80x45/eee/333?text=N/A' // Smaller placeholder
        }));
        this.topSellers.set(processedGames);
        console.log("Fetched Top Sellers:", processedGames);
    } catch (error) {
        console.error("Failed to fetch top sellers:", error);
        this.topSellers.set([]);
    }
  }


  async checkPurchaseStatus(userId: number, gameId: number) {
     // ... (implementation remains the same)
      try {
          const response = await fetch(`$${environment.API_BASE_URL}/games/purchased/${userId}`);
          if (!response.ok) return;
          const data = await response.json();
          if (data.purchasedIds && data.purchasedIds.includes(gameId)) {
              this.isPurchased.set(true);
          }
      } catch (error) {
          console.error("Failed to check purchase status:", error);
      }
  }

  // --- Cart Logic ---
  private loadCartItemIds(): void {
    const cart = this.getCartFromStorage();
    const ids = cart.map(item => item.id);
    this.cartItemIds.set(ids);
  }

  private getCartFromStorage(): CartItem[] {
    const cartStr = localStorage.getItem(this.CART_STORAGE_KEY);
    try { return cartStr ? JSON.parse(cartStr) : []; }
    catch (e) { localStorage.removeItem(this.CART_STORAGE_KEY); return []; }
  }

  isGameInCart(gameId: number): boolean {
    return this.cartItemIds().includes(gameId);
  }

  async addToCart(): Promise<void> {
      const game = this.game(); // Get current game details
      const user = this.currentUser();

      if (!user) {
          this.showNotification('Please log in to add items.', 'error_outline');
          this.router.navigate(['/login']); // Redirect to login
          return;
      }
       if (!game) {
            this.showNotification('Game details not loaded.', 'error_outline');
            return;
       }
      if (this.isPurchased()) { // Check purchased status directly
           this.showNotification('You already own this game.', 'error_outline');
          return;
      }
      if (this.isGameInCart(game.GameID)) {
           this.showNotification(`${game.Title} is already in your cart.`, 'info_outline');
          return;
      }

      const payload: AddToCartPayload = { userId: user.id, gameId: game.GameID };
      const apiUrl = `${environment.API_BASE_URL}/cart`;

      try {
          const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || `Error ${response.status}`);

          // Update local state (localStorage and signal)
          const cart = this.getCartFromStorage();
          const newItem: CartItem = {
              id: game.GameID, name: game.Title, price: game.Price, quantity: 1,
              imageUrl: game.ImageUrl // Use the full URL already processed
          };
          cart.push(newItem);
          localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));
          this.cartItemIds.update(ids => [...ids, game.GameID]);

          this.showNotification(`Added ${game.Title} to cart!`, 'check_circle');

      } catch (error) {
          console.error('Error adding to cart API:', error);
          this.showNotification(error instanceof Error ? error.message : 'Could not add item.', 'error_outline');
      }
  }

  // --- Notification ---
  showNotification(message: string, icon: 'check_circle' | 'error_outline' | 'info_outline' = 'check_circle'): void {
      this.notificationMessage.set(message);
      this.notificationIcon.set(icon);
      this.isNotificationVisible.set(true);
      if (this.notificationTimer) clearTimeout(this.notificationTimer);
      this.notificationTimer = setTimeout(() => this.isNotificationVisible.set(false), 3000);
  }

  // --- Navigation & UI ---
  goToGameDetail(gameId: number): void {
      this.router.navigate(['/detail', gameId]);
  }

  selectTab(tabName: string): void {
    this.activeTab = tabName;
  }

   // --- [NEW] Helper for discounted price (copied from main.ts) ---
    calculateDiscountedPrice(price: number, discountPercentage: number | null): number {
        if (discountPercentage === null || discountPercentage <= 0 || price <= 0) {
            return price;
        }
        const discountMultiplier = 1 - (discountPercentage / 100);
        return parseFloat((price * discountMultiplier).toFixed(2));
    }

  // Removed purchase-related functions and popup logic
}

