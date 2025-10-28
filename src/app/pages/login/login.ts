import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment'; // <-- [NEW] Import environment

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'], // Corrected styleUrls
})
export class Login {
  loginForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  returnUrl: string = '/main'; // Default return URL

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Get returnUrl from query params if provided by guard
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/main';
  }

  onLogin() {
    if (this.loginForm.invalid) {
      this.showError('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    const loginData = this.loginForm.value;

    // [MODIFIED] Use environment variable for the API URL
    const apiUrl = `${environment.API_BASE_URL}/login`;

    this.http.post(apiUrl, loginData) // <-- Use apiUrl here
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.showSuccess(response.message || 'เข้าสู่ระบบสำเร็จ');

          if (response.user) {
            // Use AuthService to set user and handle redirection
            this.authService.setUser(response.user);

            // Redirect based on returnUrl or user type
            setTimeout(() => {
              if (this.returnUrl && this.returnUrl !== '/login') { // Avoid redirect loop
                this.router.navigateByUrl(this.returnUrl);
                console.log('Redirecting to returnUrl:', this.returnUrl);
              } else {
                this.authService.redirectByUserType(); // Let AuthService decide based on type
              }
            }, 300); // Small delay for user feedback
          } else {
            // Handle case where API response is successful but no user data is returned
            this.showError('Login successful but no user data received.');
          }
        },
        error: (error) => {
          this.isLoading = false;
          const errorMsg = error.error?.message || 'เข้าสู่ระบบไม่สำเร็จ หรืออีเมล/รหัสผ่านผิด';
          this.showError(errorMsg);
          console.error('Login error:', error);
        }
      });
  }

  // Navigate to Register page
  onRegister() {
    this.router.navigate(['/register']);
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  // Show success snackbar
  showSuccess(message: string) {
    this.snackBar.open(message, 'ปิด', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top', panelClass: ['success-snackbar'] });
  }

  // Show error snackbar
  showError(message: string) {
    this.snackBar.open(message, 'ปิด', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top', panelClass: ['error-snackbar'] });
  }

  // Helper method to mark all fields as touched
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
       control.markAsTouched();
       if (control instanceof FormGroup) {
         this.markFormGroupTouched(control);
       }
     });
  }

  // Helper method for displaying error messages in the template
  getErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field || !field.touched) return ''; // Only show errors after interaction
    if (field.hasError('required')) return 'กรุณากรอกข้อมูล';
    if (field.hasError('email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (field.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `ต้องมีอย่างน้อย ${minLength} ตัวอักษร`;
    }
    return '';
  }
}
