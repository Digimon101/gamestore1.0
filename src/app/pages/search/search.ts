import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

const API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';

interface Game {
  GameID: number;
  Title: string;
  Price: number;
  Description?: string;
  ImageUrl?: string;
  ReleaseDate?: string;
}

interface Genre {
  GenreID: number;
  GenreName: string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class Search implements OnInit {
  searchQuery = signal<string>('');
  selectedGenres = signal<number[]>([]);
  searchResults = signal<Game[]>([]);
  genresList = signal<Genre[]>([]);
  isLoading = signal<boolean>(false);
  hasSearched = signal<boolean>(false);
  errorMessage = signal<string>('');

  resultsCount = computed(() => this.searchResults().length);
  
  // สร้าง computed สำหรับแสดงชื่อ genres ที่เลือก
  selectedGenreNames = computed(() => {
    const selected = this.selectedGenres();
    const genres = this.genresList();
    return selected
      .map(id => genres.find(g => g.GenreID === id)?.GenreName)
      .filter(name => name !== undefined);
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    // โหลด genres list
    await this.loadGenres();

    // รับ query parameters จาก URL
    this.route.queryParams.subscribe(params => {
      const query = params['q'] || '';
      const genresParam = params['genres'] || '';

      // ตั้งค่า search query
      if (query.trim()) {
        this.searchQuery.set(query.trim());
      }

      // ตั้งค่า selected genres
      if (genresParam) {
        const genreIds = genresParam.split(',').map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id));
        this.selectedGenres.set(genreIds);
      }

      // เริ่มค้นหา
      if (query.trim() || genresParam) {
        this.performSearch();
      }
    });
  }

  async loadGenres() {
    try {
      const response = await fetch(`${API_BASE_URL}/genres`);
      if (!response.ok) throw new Error('Failed to load genres');
      
      const genres: Genre[] = await response.json();
      this.genresList.set(genres);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  }

  async performSearch() {
    this.isLoading.set(true);
    this.hasSearched.set(true);
    this.errorMessage.set('');

    try {
      const query = this.searchQuery();
      const genreIds = this.selectedGenres();

      let url = `${API_BASE_URL}/games`;
      const params = new URLSearchParams();

      // ถ้ามี search query ใช้ search endpoint
      if (query) {
        console.log('🔍 Searching for:', query);
        url = `${API_BASE_URL}/games/search`;
        params.append('query', query);
      }

      // เพิ่ม genre filter
      if (genreIds.length > 0) {
        console.log('🎮 Filtering by genres:', genreIds);
        params.append('genres', genreIds.join(','));
      }

      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
      console.log('📡 Request URL:', fullUrl);

      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch games`);
      }

      const results: Game[] = await response.json();
      console.log('✅ Results:', results.length, 'games found');

      // กรอง results ตาม genres (client-side filtering ถ้า backend ยังไม่รองรับ)
      let filteredResults = results;
      if (genreIds.length > 0 && !query) {
        filteredResults = await this.filterGamesByGenres(results, genreIds);
      }

      // เพิ่ม full URL ให้กับรูปภาพ
      const gamesWithFullUrl = filteredResults.map(game => ({
        ...game,
        ImageUrl: game.ImageUrl ? `${API_BASE_URL}${game.ImageUrl}` : undefined
      }));

      this.searchResults.set(gamesWithFullUrl);

    } catch (error) {
      console.error('❌ Error searching games:', error);
      this.errorMessage.set('Failed to search games. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Client-side filtering (ใช้ถ้า backend ยังไม่มี genre filter)
  async filterGamesByGenres(games: Game[], genreIds: number[]): Promise<Game[]> {
    try {
      // ดึงข้อมูล genre ของแต่ละเกม
      const gamesWithGenres = await Promise.all(
        games.map(async game => {
          const response = await fetch(`${API_BASE_URL}/games/${game.GameID}/genres`);
          if (response.ok) {
            const gameGenres = await response.json();
            const gameGenreIds = gameGenres.map((g: Genre) => g.GenreID);
            // เช็คว่าเกมมี genre ที่เลือกไว้หรือไม่
            const hasSelectedGenre = genreIds.some(id => gameGenreIds.includes(id));
            return hasSelectedGenre ? game : null;
          }
          return null;
        })
      );

      return gamesWithGenres.filter(game => game !== null) as Game[];
    } catch (error) {
      console.error('Error filtering games by genres:', error);
      return games; // ถ้า error ให้คืนค่าเกมทั้งหมด
    }
  }

  removeGenreFilter(genreId: number) {
    const current = this.selectedGenres();
    const updated = current.filter(id => id !== genreId);
    this.selectedGenres.set(updated);
    
    // อัพเดท URL และค้นหาใหม่
    const queryParams: any = {};
    if (this.searchQuery()) {
      queryParams.q = this.searchQuery();
    }
    if (updated.length > 0) {
      queryParams.genres = updated.join(',');
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }

  clearAllFilters() {
    this.selectedGenres.set([]);
    
    const queryParams: any = {};
    if (this.searchQuery()) {
      queryParams.q = this.searchQuery();
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams
    });
  }

  onGameClick(gameId: number) {
    console.log('Navigating to game:', gameId);
    this.router.navigate(['/detail', gameId]);
  }

  onBuyGame(game: Game, event: Event) {
    event.stopPropagation();
    console.log('Buying game:', game.Title);
    // TODO: Implement buy logic
    alert(`Preparing to buy: ${game.Title} for ${game.Price}`);
  }

  goBack() {
    this.router.navigate(['/main']);
  }
}