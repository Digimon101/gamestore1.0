import { Component, OnInit, computed, signal, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';

// Interfaces
interface User {
    id: number;
    name: string;
    email: string;
    type: number; // 0 = user, 1 = admin
}

interface Game {
    GameID: number;
    Title: string;
    ReleaseDate: string;
    Price: number;
    Description: string;
    DiscountPercentage: number;
    ImageUrl: string | null;
    Developer: string | null;
    Publisher: string | null;
}

interface PopupConfig {
    title: 'Confirm' | 'Success' | 'Error';
    message: string;
    showConfirmButton: boolean;
    gameToPurchase: Game | null;
}


@Component({
    selector: 'app-main',
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
    ],
    templateUrl: './main.html',
    styleUrls: ['./main.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
    private readonly API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';

    constructor(private router: Router) { }

    currentUser: User | null = null;

    @ViewChild('topSellerScroll') topSellerScroll!: ElementRef;
    allGames = signal<Game[]>([]);

    // --- [NEW] Signal to store purchased game IDs ---
    purchasedGameIds = signal<number[]>([]);

 topSellerGames = computed(() => this.allGames().slice(0, 8)); 
    popularGames = computed(() => this.allGames().slice(8, 18));
    currentDotIndex = signal<number>(0);
    carouselDots = computed(() => {
        const totalGames = this.topSellerGames().length;
        const cardsPerPage = 4;
        const totalPages = Math.ceil(totalGames / cardsPerPage);
        return Array(totalPages).fill(0);
    });

    isPopupVisible = signal<boolean>(false);
    popupConfig = signal<PopupConfig>({
        title: 'Success',
        message: '',
        showConfirmButton: false,
        gameToPurchase: null
    });


    ngOnInit() {
        this.checkUserAuthentication();
        this.fetchGames();
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
                // [MODIFIED] Fetch purchased games right after authentication
                this.fetchPurchasedGames(this.currentUser.id);
            }
            if (this.currentUser?.type === 1) {
                this.router.navigate(['/home-admin']);
            }
        } catch (error) {
            localStorage.removeItem('user');
            this.router.navigate(['/login']);
        }
    }

    async fetchGames() {
        const apiUrl = `${this.API_BASE_URL}/games`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) { this.allGames.set([]); return; }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const games: Game[] = await response.json();
            const processedGames = games.map(game => ({
                ...game,
                ImageUrl: game.ImageUrl ? `${this.API_BASE_URL}${game.ImageUrl}` : null
            }));
            this.allGames.set(processedGames);
        } catch (error) {
            console.error('❌ Error fetching games:', error);
        }
    }

    // --- [NEW] Function to fetch purchased game IDs ---
    async fetchPurchasedGames(userId: number) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/games/purchased/${userId}`);
            if (!response.ok) {
                throw new Error('Could not fetch purchased games.');
            }
            const data = await response.json();
            this.purchasedGameIds.set(data.purchasedIds || []);
            console.log('🛒 Purchased Game IDs loaded:', this.purchasedGameIds());
        } catch (error) {
            console.error('❌ Error fetching purchased games:', error);
            this.purchasedGameIds.set([]);
        }
    }

    // --- [NEW] Helper function to check ownership ---
    isGamePurchased(gameId: number): boolean {
        return this.purchasedGameIds().includes(gameId);
    }

    viewGameDetails(game: Game) {
        this.router.navigate(['/detail', game.GameID]);
    }

    onBuyGame(game: Game) {
        if (!this.currentUser) {
            this.popupConfig.set({
                title: 'Error',
                message: 'กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ',
                showConfirmButton: false,
                gameToPurchase: null
            });
            this.isPopupVisible.set(true);
            return;
        }

        this.popupConfig.set({
            title: 'Confirm',
            message: `คุณต้องการซื้อเกม "${game.Title}" ในราคา $${game.Price} หรือไม่?`,
            showConfirmButton: true,
            gameToPurchase: game
        });
        this.isPopupVisible.set(true);
    }

    async handlePurchaseConfirmation() {
        const game = this.popupConfig().gameToPurchase;
        if (!game || !this.currentUser) return;

        this.isPopupVisible.set(false);

        const purchaseData = {
            userId: this.currentUser.id,
            gameId: game.GameID
        };
        const apiUrl = `${this.API_BASE_URL}/games/purchase`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `เกิดข้อผิดพลาด: ${response.statusText}`);
            }

            // [MODIFIED] Update the local list of purchased games instantly
            this.purchasedGameIds.update(currentIds => [...currentIds, game.GameID]);

            this.popupConfig.set({
                title: 'Success',
                message: `✅ ${result.message}\nยอดเงินคงเหลือ: $${result.newBalance.toFixed(2)}`,
                showConfirmButton: false,
                gameToPurchase: null
            });

        } catch (error) {
            console.error('❌ Error purchasing game:', error);
            this.popupConfig.set({
                title: 'Error',
                message: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'ไม่สามารถทำรายการได้'}`,
                showConfirmButton: false,
                gameToPurchase: null
            });
        }

        this.isPopupVisible.set(true);
    }

    closePopup() {
        this.isPopupVisible.set(false);
    }

    // Scroll functions (implementation omitted for brevity)
scrollLeft() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280; // ความกว้างของการ์ด 1 อัน
            const gap = 20; // ระยะห่างระหว่างการ์ด
            const cardsPerPage = 4; // จำนวนการ์ดต่อชุด
            const scrollAmount = (cardWidth + gap) * cardsPerPage;

            container.scrollBy({
                left: -scrollAmount,
                behavior: 'smooth'
            });
        }
    }

    scrollRight() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280;
            const gap = 20;
            const cardsPerPage = 4;
            const scrollAmount = (cardWidth + gap) * cardsPerPage;

            container.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }
    }

    scrollToPage(pageIndex: number) {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280;
            const gap = 20;
            const cardsPerPage = 4;
            const scrollAmount = (cardWidth + gap) * cardsPerPage * pageIndex;

            container.scrollTo({
                left: scrollAmount,
                behavior: 'smooth'
            });

            this.currentDotIndex.set(pageIndex);
        }
    }

    onScroll() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280;
            const gap = 20;
            const cardsPerPage = 4;
            const pageWidth = (cardWidth + gap) * cardsPerPage;
            const currentPage = Math.round(container.scrollLeft / pageWidth);

            this.currentDotIndex.set(currentPage);
        }
    }
}

