import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment'; // <-- [NEW] Import environment

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    HttpClientModule
  ],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.scss']
})
export class EditProfile implements OnInit {
  user: any = null;
  profileForm!: FormGroup;
  selectedFile: File | null = null;

  previewUrl: string | null = null;
  currentImageUrl: string | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.user = this.authService.currentUserValue;
    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }

    // [MODIFIED] Use environment.API_BASE_URL for the image path
    this.currentImageUrl = this.user.image
      ? this.user.image.startsWith('http') // Check if it's already an absolute URL (less likely now)
        ? this.user.image
        : `${environment.API_BASE_URL}${this.user.image}` // Prepend base URL
      : null;

    this.initializeForm();
  }

  initializeForm(): void {
    this.profileForm = this.fb.group({
      name: [this.user.name || '', [Validators.required, Validators.minLength(2)]],
      email: [this.user.email, [Validators.required, Validators.email]]
      // Password fields can be added here if needed
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (!file.type.startsWith('image/')) {
        this.snackBar.open('Please select an image file', 'Close', { duration: 3000 });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        this.snackBar.open('Image size must be less than 5MB', 'Close', { duration: 3000 });
        return;
      }

      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    // Reset file input visually if possible (can be tricky)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }


  onSaveProfile(): void {
    if (this.profileForm.invalid || !this.user?.id) {
      this.snackBar.open('Please fill all required fields correctly', 'Close', { duration: 3000 });
      // Mark fields as touched to show errors
      Object.values(this.profileForm.controls).forEach(control => control.markAsTouched());
      return;
    }

    const formData = new FormData();
    formData.append('name', this.profileForm.value.name);
    formData.append('email', this.profileForm.value.email);
    if (this.selectedFile) {
      formData.append('image', this.selectedFile, this.selectedFile.name);
    }
    // Note: No need to send original image URL if backend handles it based on file presence

    // [MODIFIED] Use environment.API_BASE_URL for the update URL
    const updateUrl = `${environment.API_BASE_URL}/update-profile/${this.user.id}`;

    this.http.put<{ updatedData: any }>(updateUrl, formData) // Specify expected response type
      .subscribe({
        next: (res) => {
          // Assuming backend sends back the updated user data or at least the new image path
          const updatedUserInfo = res.updatedData || {
                name: this.profileForm.value.name,
                email: this.profileForm.value.email,
                // Attempt to construct the new image URL if backend doesn't send it fully
                image: res.updatedData?.image || (this.selectedFile ? `/profile/${this.selectedFile.name}` : this.user.image) // Needs careful backend coordination
            };

          const updatedUser = { ...this.user, ...updatedUserInfo };

          this.authService.setUser(updatedUser); // Update AuthService

          // Update local component state
          this.user = updatedUser;
          // Reconstruct currentImageUrl based on potentially new path
          this.currentImageUrl = updatedUser.image
            ? `${environment.API_BASE_URL}${updatedUser.image}`
            : null;

          this.previewUrl = null; // Clear preview
          this.selectedFile = null; // Clear selected file

          this.snackBar.open('✅ Profile updated successfully!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });

          this.router.navigate(['/profile']); // Navigate back to profile page

        },
        error: (err) => {
          console.error('Update profile error:', err);
          this.snackBar.open(`❌ Failed to update profile: ${err.error?.message || 'Server error'}`, 'Close', {
            duration: 4000,
            panelClass: ['error-snackbar']
          });
        }
      });
  }

  // Getter for template to display preview or current image
  get displayedImage(): string | null {
    return this.previewUrl || this.currentImageUrl;
  }

  onCancel(): void {
    this.router.navigate(['/profile']); // Navigate back without saving
  }

  onDeleteAccount(): void {
    // Implement proper account deletion logic here (API call)
    if (confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
        console.warn('Account deletion not implemented yet.');
        // Example API Call (needs backend endpoint):
        // this.http.delete(`${environment.API_BASE_URL}/users/${this.user.id}`).subscribe({ ... });
        // this.authService.logout();
        // this.snackBar.open('Account deleted successfully', 'Close', { duration: 3000 });
        alert('Account deletion feature not yet implemented.');
    }
  }
}
