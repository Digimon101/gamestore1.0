import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../environments/environment';

interface Genre {
    GenreID: number;
    GenreName: string;
}

@Component({
    selector: 'app-add-game',
    imports: [
        ReactiveFormsModule,
        CommonModule,
        MatInputModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatChipsModule
    ],
    standalone: true,
    templateUrl: './addgame.html', // ชี้ไปที่ไฟล์ HTML
    styleUrls: ['./addgame.scss'] // ชี้ไปที่ไฟล์ SCSS
})
export class Addgame implements OnInit { // ใช้ชื่อ class 'Addgame' ตามที่ร้องขอ
    // แก้ไข: ย้าย API_BASE_URL เข้ามาเป็น property ของ class
    private readonly API_BASE_URL = 'http://localhost:3000';
    
    @ViewChild('fileInput') fileInput!: ElementRef; // อ้างอิงถึง input type="file" ใน HTML

    gameForm: FormGroup;
    genres = signal<Genre[]>([]); // สำหรับเก็บรายชื่อหมวดหมู่ทั้งหมด
    
    // สำหรับเก็บไฟล์ที่เลือก
    selectedFile = signal<File | null>(null);
    // สำหรับแสดงตัวอย่างรูปภาพ
    imagePreview = signal<string | ArrayBuffer | null>(null);

    // สำหรับแสดงสถานะการเพิ่มข้อมูล
    submitStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

    constructor(private fb: FormBuilder, private router: Router) {
        this.gameForm = this.fb.group({
            Title: ['', Validators.required],
            // ใช้ regex สำหรับราคาที่ถูกต้อง (ตัวเลขที่มีทศนิยม 1-2 ตำแหน่งหรือไม่ก็ได้)
            Price: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]{1,2})?$/)]], 
            Description: ['', Validators.required],
            // SelectedGenreIDs แทนที่ส่วนลด (ต้องเลือกอย่างน้อย 1 รายการ)
            SelectedGenreIDs: [[] as number[], Validators.required], 
        });
    }

    ngOnInit(): void {
        this.fetchGenres();
    }

    // ดึงข้อมูลประเภทเกมจาก Server (ต้องมี endpoint POST /genres)
    async fetchGenres() {
        // แก้ไข: ใช้ this.API_BASE_URL
        const apiUrl = `${environment.API_BASE_URL}/genres`; 
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: Genre[] = await response.json();
            this.genres.set(data || []);
            console.log(`✅ Fetched ${data.length} genres.`);
        } catch (error) {
            console.error('❌ Error fetching genres:', error);
        }
    }

    // ฟังก์ชันสำหรับ Add Game
    async onAddGame() {
        // ตรวจสอบความถูกต้องของฟอร์มและไฟล์
        if (this.gameForm.invalid || !this.selectedFile()) {
            this.gameForm.markAllAsTouched();
            if (!this.selectedFile()) {
                console.error('กรุณาเลือกรูปภาพเกม');
            }
            console.error('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
            return;
        }

        this.submitStatus.set('loading');
        
        // สร้าง FormData สำหรับการส่งไฟล์และข้อมูลอื่นๆ
        const formData = new FormData();
        
        // เพิ่มไฟล์รูปภาพ
        formData.append('gameImage', this.selectedFile() as File, this.selectedFile()!.name);

        // เพิ่มข้อมูลฟอร์มอื่นๆ (ต้องแปลง Array ของ GenreIDs เป็น String ก่อนส่งผ่าน FormData)
        formData.append('Title', this.gameForm.get('Title')?.value);
        formData.append('Price', this.gameForm.get('Price')?.value);
        
        // *** แก้ไข: ทำให้มั่นใจว่า Description เป็น String เสมอ ***
        const descriptionValue = this.gameForm.get('Description')?.value;
        formData.append('Description', String(descriptionValue || '')); 
        // **********************************************************
        
        // ส่ง Genre IDs เป็น JSON String (Server จะต้อง parse กลับ)
        formData.append('SelectedGenreIDs', JSON.stringify(this.gameForm.get('SelectedGenreIDs')?.value)); 

        console.log('Sending FormData to server...');
        
        try {
            const response = await fetch(`${environment.API_BASE_URL}/games`, {
                method: 'POST',
                // *** ไม่ต้องใส่ Content-Type: multipart/form-data ให้ Browser จัดการเอง ***
                body: formData
            });

            if (!response.ok) {
                 const errorBody = await response.json();
                 console.error('Server Error Response:', errorBody);
                 throw new Error(`Failed to add game: ${response.status} - ${errorBody.error || 'Unknown error'}`);
            }

            this.submitStatus.set('success');
            console.log('✅ Game added successfully, redirecting to admin-home.');
            
            // นำทางไปยังหน้า admin-home
            this.router.navigate(['/home-admin']); 

        } catch (error) {
            console.error('❌ Failed to add game:', error);
            this.submitStatus.set('error');
        }
    }

    // ฟังก์ชันที่ถูกเรียกเมื่อคลิกปุ่ม '+' (ใน HTML)
    onAddImage() {
        if (this.fileInput) { // <--- เพิ่มการตรวจสอบ Element
            this.fileInput.nativeElement.click();
        } else {
            console.error('File input element not found. Make sure to add #fileInput in add-game.html');
        }
    }
    
    // ฟังก์ชันที่ถูกเรียกเมื่อมีการเลือกไฟล์ (File input on change)
    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            this.selectedFile.set(file);

            // แสดงตัวอย่างรูปภาพ
            const reader = new FileReader();
            reader.onload = e => this.imagePreview.set(reader.result);
            reader.readAsDataURL(file);

            console.log('File selected:', file.name, file.size);
        } else {
            this.selectedFile.set(null);
            this.imagePreview.set(null);
        }
    }
}
