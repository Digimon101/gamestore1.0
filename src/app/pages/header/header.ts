import { Component, signal, OnDestroy, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../environments/environment';

const API_BASE_URL = 'http://localhost:3000';

interface GameSearchResult {
  GameID: number;
  Title: string;
  Price: number;
  ImageUrl?: string;
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
    CurrencyPipe,
    MatSelectModule
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header implements OnDestroy, OnInit {
  searchControl = new FormControl('');
  searchResults: GameSearchResult[] = [];
  searchStatus: 'idle' | 'loading' | 'done' | 'error' = 'idle';
  isSearchFocused = false;
  errorMessage = '';

  // ✅ ใช้ตัวแปรธรรมดาสำหรับ isAdmin
  isAdmin = false;

  // ✅ แก้ไข: ใช้ signal สำหรับ genres
  genres = signal<Genre[]>([]);
  selectedGenres: number[] = [];
  isGenreFilterOpen = false;
  
  isCreateCouponModalVisible = signal<boolean>(false);
  couponCreationStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  couponCreationError = signal<string>('');
  newCouponForm: FormGroup;

  private searchSubscription: Subscription;
  private userSubscription!: Subscription;

  constructor(
    private router: Router,
    public authService: AuthService
  ) {
    this.searchSubscription = this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(query => {
        if (query && query.trim().length > 0) {
          this.performSearch(query.trim());
        } else {
          this.searchResults = [];
          this.searchStatus = 'idle';
          this.errorMessage = '';
        }
      });

    this.newCouponForm = new FormGroup({
      code: new FormControl('', [
        Validators.required, 
        Validators.minLength(4), 
        Validators.pattern(/^[a-zA-Z0-9]+$/)
      ]),
      discount_type: new FormControl('percentage', [Validators.required]),
      discount_value: new FormControl(null, [Validators.required, Validators.min(0.01)]),
      expiry_date: new FormControl(null),
      max_uses: new FormControl(null, [Validators.min(1), Validators.pattern(/^[1-9]\d*$/)])
    });
  }

  // ✅ เพิ่ม getter สำหรับ todayDate
  get todayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async ngOnInit(): Promise<void> {
    // Subscribe เพื่อฟัง user changes
    this.userSubscription = this.authService.currentUser.subscribe(user => {
      this.isAdmin = user?.type === 1;
      console.log('👤 User updated in header:', user, '| isAdmin:', this.isAdmin);
    });

    // Load genres
    await this.loadGenres();
  }

  ngOnDestroy() {
    this.searchSubscription.unsubscribe();
    this.userSubscription.unsubscribe();
  }

  openCreateCouponModal(): void {
    this.newCouponForm.reset({ 
      discount_type: 'percentage', 
      max_uses: null, 
      expiry_date: null 
    });
    this.couponCreationStatus.set('idle');
    this.couponCreationError.set('');
    this.isCreateCouponModalVisible.set(true);
  }

  closeCreateCouponModal(): void {
    this.isCreateCouponModalVisible.set(false);
  }

  async handleCreateCouponSubmit(): Promise<void> {
    if (this.newCouponForm.invalid) {
      this.couponCreationError.set('Please fill in all required fields correctly.');
      this.couponCreationStatus.set('error');
      return;
    }

    this.couponCreationStatus.set('loading');
    this.couponCreationError.set('');
    const formData = this.newCouponForm.value;

    // Validate percentage
    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      this.couponCreationError.set('Percentage discount cannot exceed 100.');
      this.couponCreationStatus.set('error');
      return;
    }

    const apiData = {
      ...formData,
      max_uses: formData.max_uses ? Number(formData.max_uses) : null
    };

    try {
      const response = await fetch(`${environment.API_BASE_URL}/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Error ${response.status}`);
      }

      this.couponCreationStatus.set('success');
      setTimeout(() => this.closeCreateCouponModal(), 1500);

    } catch (error) {
      this.couponCreationError.set(
        error instanceof Error ? error.message : 'Could not create coupon.'
      );
      this.couponCreationStatus.set('error');
    }
  }

  // ✅ แก้ไข: อัพเดต signal แทน property
  async loadGenres() {
    try {
      const response = await fetch(`${environment.API_BASE_URL}/genres`);
      if (!response.ok) throw new Error('Failed to load genres');

      const genresData: Genre[] = await response.json();
      this.genres.set(genresData); // ✅ ใช้ .set() สำหรับ signal

    } catch (error) {
      console.error('Error loading genres:', error);
      this.genres.set([]); // ✅ Set empty array on error
    }
  }

  toggleGenreFilter() {
    this.isGenreFilterOpen = !this.isGenreFilterOpen;
  }

  toggleGenre(genreId: number) {
    const index = this.selectedGenres.indexOf(genreId);

    if (index > -1) {
      this.selectedGenres = this.selectedGenres.filter(id => id !== genreId);
    } else {
      this.selectedGenres = [...this.selectedGenres, genreId];
    }
  }

  isGenreSelected(genreId: number): boolean {
    return this.selectedGenres.includes(genreId);
  }

  clearGenreFilter() {
    this.selectedGenres = [];
  }

  applyGenreFilter() {
    if (this.selectedGenres.length > 0) {
      this.router.navigate(['/search'], {
        queryParams: { genres: this.selectedGenres.join(',') }
      });
    }
    this.isGenreFilterOpen = false;
  }

  closeGenreDropdown() {
    setTimeout(() => {
      this.isGenreFilterOpen = false;
    }, 150);
  }

  async performSearch(query: string) {
    this.searchStatus = 'loading';
    this.errorMessage = '';

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${environment.API_BASE_URL}/games/search?query=${encodedQuery}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const results: GameSearchResult[] = await response.json();

      const gamesWithFullUrl = results.map(game => ({
        ...game,
        ImageUrl: game.ImageUrl ? `${environment.API_BASE_URL}${game.ImageUrl}` : undefined
      }));

      this.searchResults = gamesWithFullUrl;
      this.searchStatus = 'done';

    } catch (error) {
      this.searchResults = [];
      this.searchStatus = 'error';
      this.errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    }
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.searchResults = [];
    this.errorMessage = '';
    this.isSearchFocused = true;
  }

  onSearchBlur() {
    setTimeout(() => {
      this.isSearchFocused = false;
    }, 150);
  }

  onResultClick() {
    this.isSearchFocused = false;
    this.searchControl.setValue('');
    this.searchResults = [];
    this.searchStatus = 'idle';
  }

  onProfile() {
    this.router.navigate(['/profile']);
  }

  onEnterSearch(event: Event) {
    (event as KeyboardEvent).preventDefault();
    const query = this.searchControl.value?.trim();
    if (query) {
      this.isSearchFocused = false;
      (event.target as HTMLInputElement).blur();
      this.router.navigate(['/search'], { queryParams: { q: query } });
    }
  }

  onViewUsers() {
    this.router.navigate(['/view-user']);
  }
}