import { Component, OnInit, signal, ViewChild, ElementRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, CurrencyPipe, formatDate } from '@angular/common'; // Import formatDate
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../environments/environment';

// API Base URL
const API_BASE_URL = 'http://localhost:3000';

// Interfaces
interface Genre {
  GenreID: number;
  GenreName: string;
}

// [MODIFIED] Updated Interface to include promotion fields from backend
interface GameDetail {
  GameID: number;
  Title: string;
  ReleaseDate: string;
  Price: number;
  Description: string;
  ImageUrl: string | null;
  SelectedGenreIDs: number[];
  PromotionID: number | null; // Added fields from backend response
  DiscountPercentage: number | null;
  PromotionStartDate: string | null; // Dates might come as ISO strings or YYYY-MM-DD
  PromotionEndDate: string | null;
}

@Component({
  selector: 'app-editgame',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
  ],
  templateUrl: './editgame.html',
  styleUrls: ['./editgame.scss']
})
export class Editgame implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  gameId = signal<number | null>(null);
  gameForm: FormGroup;
  genres = signal<Genre[]>([]);

  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | ArrayBuffer | null>(null);
  originalImageUrl = signal<string | null>(null);

  submitStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  isGameLoaded = signal<boolean>(false);

  // Use inject for cleaner dependency injection
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    this.gameForm = this.fb.group({
      Title: ['', Validators.required],
      Price: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]{1,2})?$/)]],
      Description: ['', Validators.required],
      SelectedGenreIDs: [[] as number[], Validators.required],
      // Promotion Form Controls
      discountPercentage: [null as number | null, [Validators.min(1), Validators.max(100)]],
      promotionStartDate: [null as string | null],
      promotionEndDate: [null as string | null]
    }, {
        validators: this.dateValidator // Custom validator for dates
    });
  }

  // Custom validator for dates
  dateValidator(group: FormGroup): { [key: string]: boolean } | null {
      const start = group.controls['promotionStartDate'].value;
      const end = group.controls['promotionEndDate'].value;
      // Check only if both dates are provided
      if (start && end && new Date(end) < new Date(start)) {
          group.controls['promotionEndDate'].setErrors({ dateOrder: true });
          return { dateOrder: true };
      }
      // Clear error if conditions are met or only one date is present
      if (group.controls['promotionEndDate'].hasError('dateOrder') && (!start || !end || new Date(end) >= new Date(start))) {
           group.controls['promotionEndDate'].setErrors(null);
      }
      return null;
  }


  goHome(): void {
    this.router.navigate(['/home-admin']);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.gameId.set(parseInt(id, 10));
        this.loadGameData(parseInt(id, 10)); // Load game data using the ID
      } else {
        console.error('Game ID not provided in URL.');
        this.error.set('Game ID not provided.'); // Set error signal
        this.isGameLoaded.set(true); // Stop loading state
      }
    });
    this.fetchGenres(); // Fetch genres for the dropdown
  }

  async fetchGenres(): Promise<void> {
     const apiUrl = `${environment.API_BASE_URL}/genres`;
     try {
       const response = await fetch(apiUrl);
       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
       const data: Genre[] = await response.json();
       this.genres.set(data || []);
     } catch (error) {
       console.error('❌ Error fetching genres:', error);
       this.genres.set([]); // Set empty on error
     }
  }

  async loadGameData(id: number): Promise<void> {
    const apiUrl = `${environment.API_BASE_URL}/games/${id}`;
    this.isGameLoaded.set(false); // Start loading
    this.error.set(null); // Clear previous errors
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch game details: ${response.status}`);
      }
      const data: GameDetail = await response.json();

      // [MODIFIED] Format dates correctly for <input type="date"> (needs YYYY-MM-DD)
      const startDate = data.PromotionStartDate ? formatDate(data.PromotionStartDate, 'yyyy-MM-dd', 'en-US') : null;
      const endDate = data.PromotionEndDate ? formatDate(data.PromotionEndDate, 'yyyy-MM-dd', 'en-US') : null;

      // [MODIFIED] Set form values including promotion data
      this.gameForm.patchValue({
        Title: data.Title,
        Price: data.Price?.toString() ?? '', // Handle potential null price
        Description: data.Description ?? '', // Handle potential null description
        SelectedGenreIDs: data.SelectedGenreIDs || [],
        discountPercentage: data.DiscountPercentage, // Patch value (might be null)
        promotionStartDate: startDate,               // Patch formatted date
        promotionEndDate: endDate                 // Patch formatted date
      });

      this.originalImageUrl.set(data.ImageUrl);
      this.imagePreview.set(data.ImageUrl ? `${environment.API_BASE_URL}${data.ImageUrl}` : null);


    } catch (error) {
      console.error('❌ Error loading game data:', error);
      this.error.set(error instanceof Error ? error.message : 'Could not load game data.');
    } finally {
        this.isGameLoaded.set(true); // Stop loading regardless of outcome
    }
  }

  onAddImage(): void {
      if (this.fileInput) {
          this.fileInput.nativeElement.click();
      }
  }

  onFileSelected(event: Event): void {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
          const file = input.files[0];
          this.selectedFile.set(file);
          const reader = new FileReader();
          reader.onload = e => this.imagePreview.set(reader.result);
          reader.readAsDataURL(file);
      } else {
          this.selectedFile.set(null);
          this.imagePreview.set(this.originalImageUrl() ? `${environment.API_BASE_URL}${this.originalImageUrl()}` : null);
      }
  }

  async onUpdateGame(): Promise<void> {
    if (this.gameForm.invalid || this.gameId() === null) {
      this.gameForm.markAllAsTouched();
      this.submitStatus.set('error'); // Show error status
      this.error.set('Please correct the errors in the form.'); // Set error message
      console.error('Form is invalid or Game ID is missing.');
      return;
    }

    this.submitStatus.set('loading');
    this.error.set(null); // Clear previous errors
    const formData = new FormData();
    const formValue = this.gameForm.value;

    // Append file or original URL
    if (this.selectedFile()) {
      formData.append('gameImage', this.selectedFile()!, this.selectedFile()!.name);
    } else if (this.originalImageUrl()) {
      formData.append('OriginalImageUrl', this.originalImageUrl()!);
    }

    // Append game data
    formData.append('Title', formValue.Title);
    formData.append('Price', formValue.Price);
    formData.append('Description', formValue.Description);
    formData.append('SelectedGenreIDs', JSON.stringify(formValue.SelectedGenreIDs));

    // Append Promotion Data (only if discountPercentage has a valid value)
    if (formValue.discountPercentage && formValue.discountPercentage > 0) {
        formData.append('discountPercentage', formValue.discountPercentage.toString());
        if (formValue.promotionStartDate) {
            formData.append('promotionStartDate', formValue.promotionStartDate);
        }
        if (formValue.promotionEndDate) {
            formData.append('promotionEndDate', formValue.promotionEndDate);
        }
    } else {
         // Explicitly send null or empty if you want backend to remove promotion
         // Depending on backend logic, maybe send 'discountPercentage': '0'
         formData.append('discountPercentage', '0'); // Example: Send 0 to indicate no promotion
    }


    try {
      const response = await fetch(`${environment.API_BASE_URL}/games/${this.gameId()}`, {
        method: 'PUT',
        body: formData // Send FormData
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Update failed: ${response.status} - ${errorBody.error || 'Unknown error'}`);
      }

      this.submitStatus.set('success');
      console.log('✅ Game and promotion updated successfully.');
      // Optionally show success message briefly before navigating
      setTimeout(() => {
          this.router.navigate(['/home-admin']);
      }, 1000); // Navigate back after 1 second

    } catch (error) {
      console.error('❌ Failed to update game/promotion:', error);
      this.submitStatus.set('error');
      this.error.set(error instanceof Error ? error.message : 'An unexpected error occurred.');
    }
  }

  async onDeleteGame(): Promise<void> {
     if (this.gameId() === null || !confirm('Are you sure you want to permanently delete this game?')) {
       return;
     }
     this.submitStatus.set('loading'); // Show loading state during delete
     this.error.set(null);
     try {
       const response = await fetch(`${environment.API_BASE_URL}/games/${this.gameId()}`, {
         method: 'DELETE'
       });
       if (!response.ok) {
         throw new Error(`Failed to delete game: ${response.status}`);
       }
       console.log('✅ Game deleted successfully.');
       this.router.navigate(['/home-admin']); // Navigate back after delete
     } catch (error) {
       console.error('❌ Failed to delete game:', error);
       this.submitStatus.set('error'); // Show error status
       this.error.set(error instanceof Error ? error.message : 'Could not delete game.');
       alert('เกิดข้อผิดพลาดในการลบเกม'); // Keep alert for immediate feedback
     }
  }

  // Add error signal for general component errors
  error = signal<string | null>(null);

} // End of class

