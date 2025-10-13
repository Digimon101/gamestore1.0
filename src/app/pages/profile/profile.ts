import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

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
  private readonly API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';
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

  async fetchUserLibrary(userId: number) {
    this.isLoadingLibrary.set(true);
    this.libraryError.set(null);
    
    try {
        const response = await fetch(`${this.API_BASE_URL}/users/${userId}/library`);
        if (!response.ok) {
            throw new Error('Failed to load your game library.');
        }
        const games: LibraryGame[] = await response.json();
        
        // [MODIFIED] Added detailed logging to debug image URLs
        console.log("--- My Library Debug ---");
        console.log("Raw data received from API:", games);

        const processedGames = games.map(game => {
            const finalUrl = game.ImageUrl ? `${this.API_BASE_URL}${game.ImageUrl}` : null;
            console.log(`[Processing] Game: "${game.Title}", Path: ${game.ImageUrl}, Final URL: ${finalUrl}`);
            return {
                ...game,
                ImageUrl: finalUrl
            };
        });
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
}

