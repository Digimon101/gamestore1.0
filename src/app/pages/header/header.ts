import { Component, signal, OnDestroy, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

const API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';

interface GameSearchResult {
  GameID: number;
  Title: string;
  Price: number;
  ImageUrl?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  type: number;
}

interface Genre {
  GenreID: number;
  GenreName: string;
}

@Component({
  selector: 'app-header-outlet',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    CommonModule,
    CurrencyPipe
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header implements OnDestroy, OnInit {
  searchControl = new FormControl('');
  searchResults = signal<GameSearchResult[]>([]);
  searchStatus = signal<'idle' | 'loading' | 'done' | 'error'>('idle');
  isSearchFocused = signal<boolean>(false);
  errorMessage = signal<string>('');

  currentUser = signal<User | null>(null);
  isAdmin = computed(() => this.currentUser()?.type === 1);

  // Genre filter properties
  genres = signal<Genre[]>([]);
  selectedGenres = signal<number[]>([]);
  isGenreFilterOpen = signal<boolean>(false);

  private searchSubscription: Subscription;

  constructor(private router: Router) {
    this.searchSubscription = this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(query => {
        if (query && query.trim().length > 0) {
          this.performSearch(query.trim());
        } else {
          this.searchResults.set([]);
          this.searchStatus.set('idle');
          this.errorMessage.set('');
        }
      });
  }

  async ngOnInit(): Promise<void> {
    // Load user data
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        this.currentUser.set(JSON.parse(userStr));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      this.currentUser.set(null);
    }

    // Load genres
    await this.loadGenres();
  }

  ngOnDestroy() {
    this.searchSubscription.unsubscribe();
  }

  async loadGenres() {
    try {
      const response = await fetch(`${API_BASE_URL}/genres`);
      if (!response.ok) throw new Error('Failed to load genres');
      
      const genresData: Genre[] = await response.json();
      this.genres.set(genresData);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  }

  toggleGenreFilter() {
    this.isGenreFilterOpen.update(val => !val);
  }

  toggleGenre(genreId: number) {
    const current = this.selectedGenres();
    const index = current.indexOf(genreId);
    
    if (index > -1) {
      // Remove genre
      this.selectedGenres.set(current.filter(id => id !== genreId));
    } else {
      // Add genre
      this.selectedGenres.set([...current, genreId]);
    }
  }

  isGenreSelected(genreId: number): boolean {
    return this.selectedGenres().includes(genreId);
  }

  clearGenreFilter() {
    this.selectedGenres.set([]);
  }

  applyGenreFilter() {
    const selected = this.selectedGenres();
    if (selected.length > 0) {
      // Navigate to search page with genre filter
      this.router.navigate(['/search'], { 
        queryParams: { genres: selected.join(',') } 
      });
    }
    this.isGenreFilterOpen.set(false);
  }

  closeGenreDropdown() {
    setTimeout(() => {
      this.isGenreFilterOpen.set(false);
    }, 150);
  }

  async performSearch(query: string) {
    this.searchStatus.set('loading');
    this.errorMessage.set('');

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${API_BASE_URL}/games/search?query=${encodedQuery}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const results: GameSearchResult[] = await response.json();

      const gamesWithFullUrl = results.map(game => ({
        ...game,
        ImageUrl: game.ImageUrl ? `${API_BASE_URL}${game.ImageUrl}` : undefined
      }));

      this.searchResults.set(gamesWithFullUrl);
      this.searchStatus.set('done');

    } catch (error) {
      this.searchResults.set([]);
      this.searchStatus.set('error');
      this.errorMessage.set(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.searchResults.set([]);
    this.errorMessage.set('');
    this.isSearchFocused.set(true);
  }

  onSearchBlur() {
    setTimeout(() => {
      this.isSearchFocused.set(false);
    }, 150);
  }

onResultClick() {
  // 1. ซ่อน Dropdown ทันที
  this.isSearchFocused.set(false);
  // 2. เคลียร์ช่องค้นหา (เพื่อให้ช่องค้นหาว่างเมื่อผู้ใช้กลับมาที่หน้านี้)
  this.searchControl.setValue(''); 
  // 3. เคลียร์ผลลัพธ์
  this.searchResults.set([]);
  this.searchStatus.set('idle');
}

  onProfile() {
    this.router.navigate(['/profile']);
  }

  onEnterSearch(event: Event) {
    (event as KeyboardEvent).preventDefault();
    const query = this.searchControl.value?.trim();
    if (query) {
      this.isSearchFocused.set(false);
      (event.target as HTMLInputElement).blur();
      this.router.navigate(['/search'], { queryParams: { q: query } });
    }
  }

  onViewUsers() {
    this.router.navigate(['/view-user']);
  }
}