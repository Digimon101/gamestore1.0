import { Component, OnInit, computed, signal, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { environment } from '../../environments/environment';

// Interfaces
interface User {
    id: number;
    name: string;
    email: string;
    type: number; // 0 = user, 1 = admin
}

// Interface for Game data fetched from /games
interface Game {
    GameID: number;
    Title: string;
    ReleaseDate: string;
    Price: number;
    Description: string | null;
    ImageUrl: string | null;
    // Promotion fields (might be null if no active promotion)
    DiscountPercentage: number | null;
    PromotionStartDate: string | null;
    PromotionEndDate: string | null;
}

// Interface for items added to the cart via API
interface AddToCartPayload {
    userId: number;
    gameId: number;
    quantity?: number; // Optional, defaults to 1 on backend
}

interface CartItem {
    id: number; // Should match GameID
    name: string;
    price: number;
    quantity: number;
    imageUrl: string | null;
}

@Component({
    selector: 'app-main', // Changed selector to 'app-main' for clarity
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatCardModule,
        MatInputModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        CommonModule,
        CurrencyPipe
        // Removed Header import as requested
    ],
    templateUrl: './main.html',
    styleUrls: ['./main.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
    private readonly API_BASE_URL = 'http://localhost:3000';
    // [FIX] Added back the missing constant
    private readonly CART_STORAGE_KEY = 'shopping_cart';
    private notificationTimer: any = null;

    constructor(private router: Router) { }

    currentUser: User | null = null;

    cartItemIds = signal<number[]>([]);

    @ViewChild('topSellerScroll') topSellerScroll!: ElementRef;
    allGames = signal<Game[]>([]);
    purchasedGameIds = signal<number[]>([]);

    actualTopSellerGames = signal<Game[]>([]);
    popularGames = computed(() => this.allGames());

    currentDotIndex = signal<number>(0);
    carouselDots = computed(() => {
        const totalGames = this.actualTopSellerGames().length;
        const cardsPerPage = 4;
        const totalPages = Math.ceil(totalGames / cardsPerPage);
        return Array(totalPages > 0 ? totalPages : 0).fill(0);
    });

    isNotificationVisible = signal<boolean>(false);
    notificationMessage = signal<string>('');
    notificationIcon = signal<'check_circle' | 'error_outline' | 'info_outline'>('check_circle');


    ngOnInit() {
        // [MODIFIED] Only call checkUserAuthentication and fetchGames here
        this.checkUserAuthentication();
        this.fetchGames();
        this.fetchTopSellers();
    }

    async checkUserAuthentication() {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            this.router.navigate(['/login']);
            return;
        }
        try {
            this.currentUser = JSON.parse(userStr);
            if (this.currentUser) {
                // Fetch purchased games after checking user
                await this.fetchPurchasedGames(this.currentUser.id);
                // [MODIFIED] Load/Reload cart IDs AFTER fetching purchased games
                this.loadCartItemIds();
            }
            if (this.currentUser?.type === 1) {
                this.router.navigate(['/home-admin']);
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            localStorage.removeItem('user');
            this.router.navigate(['/login']);
        }
    }

    private loadCartItemIds(): void {
        const cart = this.getCartFromStorage();
        const ids = cart.map(item => item.id);
        this.cartItemIds.set(ids);
        console.log('🛒 Cart Item IDs loaded/reloaded:', this.cartItemIds());
    }

    private getCartFromStorage(): CartItem[] {
        const cartStr = localStorage.getItem(this.CART_STORAGE_KEY);
        try {
            return cartStr ? JSON.parse(cartStr) : [];
        } catch (e) {
            console.error('Error parsing cart from localStorage:', e);
            localStorage.removeItem(this.CART_STORAGE_KEY);
            return [];
        }
    }


    isGameInCart(gameId: number): boolean {
        return this.cartItemIds().includes(gameId);
    }

    async fetchGames() {
        const apiUrl = `${environment.API_BASE_URL}/games`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) { this.allGames.set([]); return; }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const games: Game[] = await response.json();
            const processedGames = games.map(game => ({
                ...game,
                Description: game.Description ?? '',
                ImageUrl: game.ImageUrl ? `${environment.API_BASE_URL}${game.ImageUrl}` : null
            }));
            this.allGames.set(processedGames);
        } catch (error) {
            console.error('❌ Error fetching games:', error);
            this.showNotification('Could not load games.', 'error_outline');
        }
    }
    async fetchTopSellers() {
        const apiUrl = `${environment.API_BASE_URL}/games/top-sellers`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const topGames: Game[] = await response.json();
             const processedGames = topGames.map(game => ({
                ...game,
                Description: game.Description ?? '',
                ImageUrl: game.ImageUrl ? `${environment.API_BASE_URL}${game.ImageUrl}` : null
            }));
            this.actualTopSellerGames.set(processedGames);
             console.log('Fetched top sellers:', processedGames);
        } catch (error) {
            console.error('❌ Error fetching top sellers:', error);
            this.actualTopSellerGames.set([]); // Set empty on error
             this.showNotification('Could not load top sellers.', 'error_outline');
        }
    }

    async fetchPurchasedGames(userId: number) {
        const apiUrl = `${environment.API_BASE_URL}/games/purchased/${userId}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                console.warn(`Could not fetch purchased games list: ${response.status}`);
                this.purchasedGameIds.set([]);
                return;
            }
            const data = await response.json();
            this.purchasedGameIds.set(data.purchasedIds || []);
            console.log('🛒 Purchased Game IDs loaded:', this.purchasedGameIds());
        } catch (error) {
            console.error('❌ Error fetching purchased games:', error);
            this.purchasedGameIds.set([]);
        }
    }

    isGamePurchased(gameId: number): boolean {
        return this.purchasedGameIds().includes(gameId);
    }
    calculateDiscountedPrice(price: number, discountPercentage: number | null): number {
        if (discountPercentage === null || discountPercentage <= 0 || price <= 0) {
            return price; // Return original price if no valid discount
        }
        const discountMultiplier = 1 - (discountPercentage / 100);
        return parseFloat((price * discountMultiplier).toFixed(2)); // Calculate and format
    }

    viewGameDetails(game: Game) {
        this.router.navigate(['/detail', game.GameID]);
    }

    async addToCart(game: Game): Promise<void> {
        if (!this.currentUser) {
            this.showNotification('Please log in to add items to your cart.', 'error_outline');
            return;
        }
        if (this.isGamePurchased(game.GameID)) {
            this.showNotification('You already own this game.', 'error_outline');
            return;
        }
        if (this.isGameInCart(game.GameID)) {
            this.showNotification(`${game.Title} is already in your cart.`, 'info_outline');
            return;
        }

        const payload: AddToCartPayload = {
            userId: this.currentUser.id,
            gameId: game.GameID,
        };
        const apiUrl = `${environment.API_BASE_URL}/cart`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `Error ${response.status}`);
            }

            // Update localStorage FIRST
            const cart = this.getCartFromStorage();
            const newItem: CartItem = {
                id: game.GameID,
                name: game.Title,
                price: game.Price,
                quantity: 1,
                imageUrl: game.ImageUrl // Use the already processed URL
            };
            cart.push(newItem);
            localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));

            // THEN update the signal ONCE
            this.cartItemIds.update(ids => [...ids, game.GameID]);

            // Success
            this.showNotification(`Added ${game.Title} to cart!`, 'check_circle');

        } catch (error) {
            console.error('Error adding to cart API:', error);
            this.showNotification(error instanceof Error ? error.message : 'Could not add item to cart.', 'error_outline');
        }
    }

    showNotification(message: string, icon: 'check_circle' | 'error_outline' | 'info_outline' = 'check_circle'): void {
        this.notificationMessage.set(message);
        this.notificationIcon.set(icon);
        this.isNotificationVisible.set(true);

        if (this.notificationTimer) {
            clearTimeout(this.notificationTimer);
        }

        this.notificationTimer = setTimeout(() => {
            this.isNotificationVisible.set(false);
        }, 3000);
    }

    // --- Carousel scroll functions ---
    scrollLeft() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const scrollAmount = container.offsetWidth * 0.8; // Scroll by 80% of visible width
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
    }

    scrollRight() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const scrollAmount = container.offsetWidth * 0.8;
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }

    scrollToPage(pageIndex: number) {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280; // Assuming fixed card width
            const gap = 20;
            const cardsPerPage = 4; // Assuming 4 cards fit
            const scrollAmount = (cardWidth + gap) * cardsPerPage * pageIndex;
            container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
            this.currentDotIndex.set(pageIndex); // Update dot indicator
        }
    }

    onScroll() {
        // Update dot indicator based on scroll position
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280;
            const gap = 20;
            const cardsPerPage = 4;
            const pageWidth = (cardWidth + gap) * cardsPerPage;
            // Use Math.floor or Math.round depending on desired snapping behavior
            const currentPage = Math.round(container.scrollLeft / pageWidth);
            this.currentDotIndex.set(currentPage);
        }
    }
}

