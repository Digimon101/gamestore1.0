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

@Component({
  selector: 'app-home-admin',
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
  standalone: true,
  templateUrl: './home-admin.html',
  styleUrls: ['./home-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAdmin implements OnInit {
    // API Base URL
    

    constructor(private router: Router) {}
private readonly API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';
    
    currentAdmin: User | null = null;
    
    // ViewChild สำหรับเข้าถึง scroll container
    @ViewChild('topSellerScroll') topSellerScroll!: ElementRef;
    
    allGames = signal<Game[]>([]);
    
    // Top Seller: 5 เกมแรก (เพื่อให้เห็นการเลื่อน)
    topSellerGames = computed(() => this.allGames().slice(0, 8));
    
    // Popular: 10 เกมถัดไป
    popularGames = computed(() => this.allGames().slice(8, 18));
    
    // Carousel dots tracking
    currentDotIndex = signal<number>(0);
    carouselDots = computed(() => {
        const totalGames = this.topSellerGames().length;
        const cardsPerPage = 4;
        const totalPages = Math.ceil(totalGames / cardsPerPage);
        return Array(totalPages).fill(0);
    });
    ngOnInit() {
        this.checkAdminAuthentication();
        this.fetchGames();
    }
    
    // ----------------------------------------------------------------------
    // Scroll Functions
    // ----------------------------------------------------------------------
    
    scrollLeft() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280; // ความกว้างของการ์ด 1 อัน
            const gap = 20; // ระยะห่างระหว่างการ์ด
            const cardsPerPage = 4; // จำนวนการ์ดต่อชุด
            const scrollAmount = (cardWidth + gap) * cardsPerPage;
            
            container.scrollBy({
                left: -scrollAmount, // เลื่อนซ้าย 4 การ์ด
                behavior: 'smooth'
            });
        }
    }

    scrollRight() {
        if (this.topSellerScroll) {
            const container = this.topSellerScroll.nativeElement;
            const cardWidth = 280; // ความกว้างของการ์ด 1 อัน
            const gap = 20; // ระยะห่างระหว่างการ์ด
            const cardsPerPage = 4; // จำนวนการ์ดต่อชุด
            const scrollAmount = (cardWidth + gap) * cardsPerPage;
            
            container.scrollBy({
                left: scrollAmount, // เลื่อนขวา 4 การ์ด
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
    
    // ----------------------------------------------------------------------
    // Data Logic
    // ----------------------------------------------------------------------
    
    async fetchGames() {
        const apiUrl = `${this.API_BASE_URL}/games`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No games found in the database (404)');
                    this.allGames.set([]);
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const games: Game[] = await response.json();

            // Process ImageUrl with API_BASE_URL
            const processedGames = games.map(game => ({
                ...game,
                ImageUrl: game.ImageUrl ? `${this.API_BASE_URL}${game.ImageUrl}` : null
            }));
            
            console.log('Fetched games successfully:', processedGames);
            
            this.allGames.set(processedGames);

        } catch (error) {
            console.error('Error fetching games:', error);
        }
    }
    
    // ----------------------------------------------------------------------
    // Navigation and Authentication Logic
    // ----------------------------------------------------------------------

    onAddGame() {
        this.router.navigate(['/addgame']);
        console.log('Admin is navigating to /addgame');
    }

    onEditGame(gameId: number) {
        this.router.navigate(['/editgame'], { queryParams: { id: gameId } });
        console.log('Admin is navigating to /editgame with GameID:', gameId);
    }

    // ตรวจสอบ Admin Authentication
    checkAdminAuthentication() {
        const userStr = localStorage.getItem('user');
        
        if (!userStr) {
            console.log('No user found, redirecting to login');
            this.router.navigate(['/login']);
            return;
        }

        try {
            this.currentAdmin = JSON.parse(userStr);
            
            if (this.currentAdmin && this.currentAdmin.type !== 1) {
                console.log('Regular user detected, redirecting to main page');
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

    onDeleteGame(gameId: number) {
        // For now, let's just confirm it works with a console log
        console.log('Attempting to delete game with ID:', gameId);

        // You can add a confirmation dialog here before deleting
        const isConfirmed = confirm('Are you sure you want to delete this game? This action cannot be undone.');

        if (isConfirmed) {
            // TODO: Add your API call logic here to delete the game from the database
            alert(`Game with ID: ${gameId} would be deleted.`);
        }
    }

    onProfile() {
        this.router.navigate(['/profile']);
    }

    onViewUsers() {
        this.router.navigate(['/view-user']);
    }

    onLogout() {
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
    }
}