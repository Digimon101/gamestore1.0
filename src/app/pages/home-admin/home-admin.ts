import { Component, OnInit, computed, signal, ChangeDetectionStrategy, ViewChild, ElementRef, inject } from '@angular/core'; // Import inject
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { environment } from '../../environments/environment'; // Use environment

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
  Description: string | null;
  ImageUrl: string | null;
  DiscountPercentage: number | null;
  PromotionStartDate: string | null;
  PromotionEndDate: string | null;
  // Optional: Add purchase_count if needed for display, though API sorts by it
  purchase_count?: number; 
}

@Component({
  selector: 'app-home-admin',
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
  templateUrl: './home-admin.html',
  styleUrls: ['./home-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAdmin implements OnInit {
    
    // Use inject for Router for cleaner code
    private router = inject(Router); 
    
    currentAdmin: User | null = null;
    
    @ViewChild('topSellerScroll') topSellerScroll!: ElementRef;
    
    allGames = signal<Game[]>([]); // For the "All Games" section
    
    // --- [NEW] Signal specifically for top 5 sellers ---
    actualTopSellerGames = signal<Game[]>([]); 
    
    // --- [REMOVED] Old computed signal based on allGames ---
    // topSellerGames = computed(() => this.allGames().slice(0, 8)); 
    
    // Popular games can now show all games fetched by fetchGames()
    // Or adjust slice if needed, e.g., slice(0, 10) for pagination later
    popularGames = computed(() => this.allGames()); 
    
    // --- [MODIFIED] Carousel dots tracking based on actualTopSellerGames ---
    currentDotIndex = signal<number>(0);
    carouselDots = computed(() => {
        const totalGames = this.actualTopSellerGames().length; // Use actual top sellers count
        if (totalGames === 0) return []; // Handle empty case
        const cardsPerPage = 4; // Or adjust based on your layout needs for 5 items
        // Calculate pages needed for the actual top sellers
        const totalPages = Math.ceil(totalGames / cardsPerPage); 
        return Array(totalPages).fill(0);
    });

    ngOnInit() {
        this.checkAdminAuthentication();
        this.fetchGames(); // Fetch all games for the lower section
        this.fetchTopSellers(); // Fetch the top 5 sellers specifically
    }
    
    // --- Data Fetching ---
    async fetchGames() {
        const apiUrl = `${environment.API_BASE_URL}/games`; // Use environment URL
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
            console.log('Fetched all games successfully:', processedGames.length);
        } catch (error) {
            console.error('Error fetching all games:', error);
            // Optionally show error to admin
        }
    }

    // --- [NEW] Fetch Top 5 Sellers ---
    async fetchTopSellers() {
        const apiUrl = `${environment.API_BASE_URL}/games/top-sellers`; // Use the new endpoint
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const topGames: Game[] = await response.json(); // Data includes promotion
            const processedGames = topGames.map(game => ({
                ...game,
                Description: game.Description ?? '',
                ImageUrl: game.ImageUrl ? `${environment.API_BASE_URL}${game.ImageUrl}` : null
            }));
            this.actualTopSellerGames.set(processedGames);
            console.log('Fetched top sellers successfully:', processedGames);
        } catch (error) {
            console.error('Error fetching top sellers:', error);
            this.actualTopSellerGames.set([]); // Set empty on error
             // Optionally show error to admin
        }
    }


    // Helper to calculate discounted price
    calculateDiscountedPrice(price: number, discountPercentage: number | null): number {
        if (discountPercentage === null || discountPercentage <= 0 || price <= 0) {
            return price; 
        }
        const discountMultiplier = 1 - (discountPercentage / 100);
        return parseFloat((price * discountMultiplier).toFixed(2)); 
    }
    
    // --- Navigation and Authentication ---
    onAddGame() {
        this.router.navigate(['/addgame']);
    }

    onEditGame(gameId: number) {
        this.router.navigate(['/editgame'], { queryParams: { id: gameId } });
    }

    checkAdminAuthentication() {
         const userStr = localStorage.getItem('user');
        if (!userStr) {
            this.router.navigate(['/login']);
            return;
        }
        try {
            this.currentAdmin = JSON.parse(userStr);
            if (this.currentAdmin && this.currentAdmin.type !== 1) {
                this.router.navigate(['/main']);
                return;
            }
             console.log('Admin authenticated:', this.currentAdmin);
        } catch (error) {
            console.error('Error parsing user data:', error);
            localStorage.removeItem('user');
            this.router.navigate(['/login']);
        }
    }

    // --- Carousel Functions ---
    scrollLeft() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const scrollAmount = container.offsetWidth * 0.8; 
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
            // Adjust calculation based on actual card width + gap if needed
            const cardWidth = container.scrollWidth / this.actualTopSellerGames().length; // Estimate card width
            const scrollAmount = cardWidth * 4 * pageIndex; // Scroll by pages of ~4 cards
            container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
            this.currentDotIndex.set(pageIndex);
        }
    }
    onScroll() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
             const cardWidth = container.scrollWidth / this.actualTopSellerGames().length;
             const pageWidth = cardWidth * 4; // Estimate page width
             if (pageWidth > 0) { // Prevent division by zero
                const currentPage = Math.round(container.scrollLeft / pageWidth);
                this.currentDotIndex.set(currentPage);
             }
        }
    }
}

