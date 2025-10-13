import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
// Interfaces
interface User {
  id: number;
  name: string;
  email: string;
  type: number;
}

interface GameDetails {
  GameID: number;
  Title: string;
  ReleaseDate: string;
  Price: number;
  Description: string;
  ImageUrl: string | null;
  SelectedGenreIDs: number[];
}

interface TopSeller {
  title: string;
  imageUrl: string;
}

interface PopupConfig {
  title: 'Confirm' | 'Success' | 'Error';
  message: string;
  showConfirmButton: boolean;
}
interface TopSellerGame {
  GameID: number;
  Title: string;
  ImageUrl: string | null;
}

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss']
})
export class Detail implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';

  // --- Component State Signals ---
  game = signal<GameDetails | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  currentUser = signal<User | null>(null);
  isPurchased = signal<boolean>(false); // Signal to track ownership
  topSellers = signal<TopSellerGame[]>([]);
  // Popup Signals
  isPopupVisible = signal<boolean>(false);
  popupConfig = signal<PopupConfig>({
    title: 'Confirm',
    message: '',
    showConfirmButton: false,
  });

  // Static data
  private routeSubscription: Subscription | undefined;
  activeTab: string = 'about';

  ngOnInit(): void {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) this.currentUser.set(JSON.parse(userStr));
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
    }

    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const gameId = params.get('id');
      if (gameId) {
        window.scrollTo(0, 0); // Scroll to top on new game load
        this.isPurchased.set(false); // Reset purchase status for the new game
        this.fetchGameDetails(gameId);
      } else {
        this.error.set('Could not find a Game ID in the URL.');
        this.isLoading.set(false);
      }
    });

    this.fetchTopSellers();
  }
  // --- [NEW] Function to fetch top seller games ---
  async fetchTopSellers(): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/games`);
      if (!response.ok) {
        throw new Error('Could not load top sellers.');
      }
      const allGames: TopSellerGame[] = await response.json();

      // Take the first 3 games and process their image URLs
      const top3 = allGames.slice(0, 3).map(game => ({
        ...game,
        ImageUrl: game.ImageUrl
          ? `${this.API_BASE_URL}${game.ImageUrl}`
          : 'https://placehold.co/200x120/333/FFF?text=No+Image'
      }));
      this.topSellers.set(top3);

    } catch (error) {
      console.error("Failed to fetch top sellers:", error);
      this.topSellers.set([]); // Set to empty on error
    }
  }
  async fetchGameDetails(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await fetch(`${this.API_BASE_URL}/games/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error fetching data: Status ${response.status}`);
      }
      const gameData: GameDetails = await response.json();
      const processedGame = {
        ...gameData,
        ImageUrl: gameData.ImageUrl ? `${this.API_BASE_URL}${gameData.ImageUrl}` : null
      };
      this.game.set(processedGame);

      // 3. After fetching game, check if user owns it
      if (this.currentUser()) {
        this.checkPurchaseStatus(this.currentUser()!.id, gameData.GameID);
      }

    } catch (err: any) {
      this.error.set(err.message || 'An unknown error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async checkPurchaseStatus(userId: number, gameId: number) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/games/purchased/${userId}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.purchasedIds && data.purchasedIds.includes(gameId)) {
        this.isPurchased.set(true);
      }
    } catch (error) {
      console.error("Failed to check purchase status:", error);
    }
  }

    goToGameDetail(gameId: number): void {
      this.router.navigate(['/detail', gameId]);
  }

  onPurchase(): void {
    const user = this.currentUser();
    const game = this.game();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    if (!game) return;

    this.popupConfig.set({
      title: 'Confirm',
      message: `คุณต้องการซื้อเกม "${game.Title}" ในราคา ${game.Price > 0 ? '$' + game.Price : 'Free'} หรือไม่?`,
      showConfirmButton: true
    });
    this.isPopupVisible.set(true);
  }

  async handlePurchaseConfirmation(): Promise<void> {
    const user = this.currentUser();
    const game = this.game();
    if (!user || !game) return;

    this.isPopupVisible.set(false);

    try {
      const response = await fetch(`${this.API_BASE_URL}/games/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, gameId: game.GameID })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'An error occurred during purchase.');
      }

      this.isPurchased.set(true);
      this.popupConfig.set({
        title: 'Success',
        message: result.message,
        showConfirmButton: false
      });

    } catch (error) {
      this.popupConfig.set({
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unknown error occurred.',
        showConfirmButton: false
      });
    }
    this.isPopupVisible.set(true);
  }

  closePopup(): void {
    this.isPopupVisible.set(false);
  }

  selectTab(tabName: string): void {
    this.activeTab = tabName;
  }
}
