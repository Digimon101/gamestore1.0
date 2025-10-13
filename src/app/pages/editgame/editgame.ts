import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';

// API Base URL สำหรับเรียก Express Server
const API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';

// Interfaces
interface Genre {
  GenreID: number;
  GenreName: string;
}

interface GameDetail {
  GameID: number;
  Title: string;
  ReleaseDate: string;
  Price: number;
  Description: string;
  ImageUrl: string | null;
  SelectedGenreIDs: number[]; // หมวดหมู่ที่ถูกเลือกไว้ของเกมนี้
}

@Component({
  selector: 'app-editgame',
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
  standalone: true,
  templateUrl: './editgame.html',
  styleUrls: ['./editgame.scss']
})
export class Editgame implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  gameId = signal<number | null>(null);
  gameForm: FormGroup;
  genres = signal<Genre[]>([]); // สำหรับเก็บรายชื่อหมวดหมู่ทั้งหมด

  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | ArrayBuffer | null>(null);

  // สำหรับเก็บ ImageUrl เดิมของเกม (หากไม่มีการเลือกไฟล์ใหม่)
  originalImageUrl = signal<string | null>(null);

  submitStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  isGameLoaded = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute // สำหรับดึง GameID
  ) {
    this.gameForm = this.fb.group({
      Title: ['', Validators.required],
      Price: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]{1,2})?$/)]],
      Description: ['', Validators.required],
      SelectedGenreIDs: [[] as number[], Validators.required],
    });
  }
goHome() {
  this.router.navigate(['/home-admin']); // หรือเปลี่ยน path เป็น '/home-admin' ตามระบบของคุณ
}
  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.gameId.set(parseInt(id, 10));
        this.loadGameData(parseInt(id, 10));
      } else {
        console.error('Game ID not provided in URL.');
        this.isGameLoaded.set(true); // ป้องกัน Loading ค้าง
        // อาจจะนำทางกลับหน้า Home
      }
    });
    this.fetchGenres();
  }

  // ----------------------------------------------------------------------
  // Data Loading
  // ----------------------------------------------------------------------

  async fetchGenres() {
    const apiUrl = `${API_BASE_URL}/genres`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Genre[] = await response.json();
      this.genres.set(data || []);
    } catch (error) {
      console.error('❌ Error fetching genres:', error);
    }
  }

  async loadGameData(id: number) {
    const apiUrl = `${API_BASE_URL}/games/${id}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch game details: ${response.status}`);
      }
      const data: GameDetail = await response.json();

      // ตั้งค่าฟอร์มด้วยข้อมูลที่ดึงมา
      this.gameForm.patchValue({
        Title: data.Title,
        Price: data.Price.toString(),
        Description: data.Description,
        SelectedGenreIDs: data.SelectedGenreIDs || []
      });

      this.originalImageUrl.set(data.ImageUrl); // เก็บ ImageUrl เดิม
      this.imagePreview.set(data.ImageUrl ? `${API_BASE_URL}${data.ImageUrl}` : null);
      this.isGameLoaded.set(true);

    } catch (error) {
      console.error('❌ Error loading game data:', error);
      this.isGameLoaded.set(true);
    }
  }

  // ----------------------------------------------------------------------
  // File Upload Handlers
  // ----------------------------------------------------------------------

  onAddImage() {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    } else {
      console.error('File input element not found.');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFile.set(file);

      // แสดงตัวอย่างรูปภาพ
      const reader = new FileReader();
      reader.onload = e => this.imagePreview.set(reader.result);
      reader.readAsDataURL(file);

    } else {
      this.selectedFile.set(null);
      // ถ้าไม่มีไฟล์ใหม่ถูกเลือก ให้กลับไปใช้รูปเดิม
      this.imagePreview.set(this.originalImageUrl() ? `${API_BASE_URL}${this.originalImageUrl()}` : null);
    }
  }

  // ----------------------------------------------------------------------
  // Submit / Delete Logic
  // ----------------------------------------------------------------------

  async onUpdateGame() {
    if (this.gameForm.invalid || this.gameId() === null) {
      this.gameForm.markAllAsTouched();
      console.error('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง หรือ Game ID ไม่ถูกต้อง');
      return;
    }

    this.submitStatus.set('loading');

    const formData = new FormData();
    const formValue = this.gameForm.value;

    // 1. เพิ่มไฟล์รูปภาพใหม่ (ถ้ามี)
    if (this.selectedFile()) {
      formData.append('gameImage', this.selectedFile() as File, this.selectedFile()!.name);
    }

    // 2. เพิ่มข้อมูลฟอร์ม
    formData.append('Title', formValue.Title);
    formData.append('Price', formValue.Price);
    formData.append('Description', formValue.Description);
    formData.append('SelectedGenreIDs', JSON.stringify(formValue.SelectedGenreIDs));

    // 3. (สำคัญ) ระบุ ImageUrl เดิม หากไม่มีการอัปโหลดไฟล์ใหม่
    // Server จะใช้ค่านี้ในการตัดสินใจว่าต้องอัปเดตพาธรูปภาพหรือไม่
    if (!this.selectedFile() && this.originalImageUrl()) {
      formData.append('OriginalImageUrl', this.originalImageUrl() as string);
    }


    try {
      const response = await fetch(`${API_BASE_URL}/games/${this.gameId()}`, {
        method: 'PUT',
        body: formData
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('Server Error Response:', errorBody);
        throw new Error(`Failed to update game: ${response.status} - ${errorBody.error || 'Unknown error'}`);
      }

      this.submitStatus.set('success');
      console.log('✅ Game updated successfully. Navigating to home.');
      this.router.navigate(['/home-admin']); // นำทางกลับหน้าหลัก

    } catch (error) {
      console.error('❌ Failed to update game:', error);
      this.submitStatus.set('error');
    }
  }

  async onDeleteGame() {
    if (this.gameId() === null || !confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเกมนี้อย่างถาวร?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/games/${this.gameId()}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete game: ${response.status}`);
      }

      console.log('✅ Game deleted successfully. Navigating to home.');
      this.router.navigate(['/home-admin']); // นำทางกลับหน้าหลักหลังจากลบ
    } catch (error) {
      console.error('❌ Failed to delete game:', error);
      alert('เกิดข้อผิดพลาดในการลบเกม');
    }

  }
}