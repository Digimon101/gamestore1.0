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
  styleUrls: ['./login.scss'], // แก้เป็น styleUrls
})
export class Login {
  loginForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  returnUrl: string = '/main';

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

    // อ่าน returnUrl จาก query params ของ Guard
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

    this.http.post('https://sqlserverwebgame-main.onrender.com/login', loginData)
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.showSuccess(response.message || 'เข้าสู่ระบบสำเร็จ');

          if (response.user) {
            // เก็บ session
            this.authService.setUser(response.user);

            // ✅ redirect ตาม returnUrl หรือ user type
            setTimeout(() => {
              if (this.returnUrl) {
                this.router.navigateByUrl(this.returnUrl);
                console.log('Redirecting to returnUrl:', this.returnUrl);
              } else {
                this.authService.redirectByUserType();
              }
            }, 300);
          }
        },
        error: (error) => {
          this.isLoading = false;
          const errorMsg = error.error?.message || 'เข้าสู่ระบบไม่สำเร็จ';
          this.showError(errorMsg);
          console.error('Login error:', error);
        }
      });
  }

  onRegister() {
    this.router.navigate(['/register']);
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  showSuccess(message: string) {
    this.snackBar.open(message, 'ปิด', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top', panelClass: ['success-snackbar'] });
  }

  showError(message: string) {
    this.snackBar.open(message, 'ปิด', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top', panelClass: ['error-snackbar'] });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.hasError('required')) return 'กรุณากรอกข้อมูล';
    if (field?.hasError('email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (field?.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `ต้องมีอย่างน้อย ${minLength} ตัวอักษร`;
    }
    return '';
  }
}
