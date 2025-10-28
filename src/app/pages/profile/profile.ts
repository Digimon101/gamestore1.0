import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

// Interface for a game in the user's library
interface LibraryGame {
  GameID: number;
  Title: string;
  ImageUrl: string | null;
}

// Interface for the logged-in user
interface User {
    id: number;
    name: string;
    email: string;
    type: number;
    image: string | null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit, OnDestroy {

  user: User | null = null;
  
  userGames = signal<LibraryGame[]>([]);
  isLoadingLibrary = signal<boolean>(true);
  libraryError = signal<string | null>(null);

  private userSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser.subscribe((user: any) => {
        if (user) {
            this.user = user as User; 
            this.fetchUserLibrary(user.id);
        } else {
            console.warn('AuthService reported no user. Redirecting to login.');
            this.router.navigate(['/login']);
        }
    });
  }

  ngOnDestroy(): void {
      if (this.userSubscription) {
          this.userSubscription.unsubscribe();
      }
  }

  /**
   * Helper function to process image URLs correctly
   * - If URL is already absolute (http/https), use as-is
   * - If URL is relative path, prepend API_BASE_URL
   */
  private processImageUrl(imageUrl: string | null): string | null {
    if (!imageUrl) {
      return null;
    }

    // Check if it's already an absolute URL (Firebase, Cloudinary, etc.)
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    // It's a relative path, prepend API base URL
    return `${environment.API_BASE_URL}${imageUrl}`;
  }

  async fetchUserLibrary(userId: number) {
    this.isLoadingLibrary.set(true);
    this.libraryError.set(null);
    
    try {
        const response = await fetch(`${environment.API_BASE_URL}/users/${userId}/library`);
        if (!response.ok) {
            throw new Error('Failed to load your game library.');
        }
        const games: LibraryGame[] = await response.json();
        
        console.log("--- My Library Debug ---");
        console.log("Raw data received from API:", games);

        // Process image URLs correctly
        const processedGames = games.map(game => {
            const finalUrl = this.processImageUrl(game.ImageUrl);
            console.log(`[Processing] Game: "${game.Title}"`);
            console.log(`  - Original: ${game.ImageUrl}`);
            console.log(`  - Final URL: ${finalUrl}`);
            return { ...game, ImageUrl: finalUrl };
        });
        
        console.log("Processed games:", processedGames);
        console.log("------------------------");

        this.userGames.set(processedGames);

    } catch (error) {
        this.libraryError.set(error instanceof Error ? error.message : 'An unknown error occurred.');
        console.error("Error fetching library:", error);
    } finally {
        this.isLoadingLibrary.set(false);
    }
  }

  onEdit(): void {
    this.router.navigate(['/edit-profile']);
  }

  onSignOut(): void {
    this.authService.logout();
  } 

  onDownload(game: LibraryGame): void {
    alert(`Starting download for: ${game.Title}`);
  }

  viewGameDetails(gameId: number): void {
    this.router.navigate(['/detail', gameId]);
  }

  /**
   * Helper to get user's profile image URL
   */
  getUserImageUrl(): string {
    if (!this.user?.image) {
      return 'assets/default-avatar.png'; // Default avatar
    }
    return this.processImageUrl(this.user.image) || 'assets/default-avatar.png';
  }

  /**
   * Helper to get fallback image if game image fails to load
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/default-game-cover.png'; // Fallback image
  }
}