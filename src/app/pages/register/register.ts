import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment'; // <-- [NEW] Import environment

@Component({
  selector: 'app-register',
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
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  registerForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  // Password match validator
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    // Clear the error if passwords match
    if (confirmPassword?.hasError('passwordMismatch')) {
        confirmPassword.setErrors(null);
    }
    return null;
  }


  // Register function
  onRegister() {
    if (this.registerForm.invalid) {
      this.showError('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
      this.markFormGroupTouched(this.registerForm);
      return;
    }

    this.isLoading = true;

    const { name, email, password } = this.registerForm.value;
    const registerData = { name, email, password };

    // [MODIFIED] Use environment variable for the API URL
    const apiUrl = `${environment.API_BASE_URL}/register`;

    this.http.post(apiUrl, registerData) // <-- Use apiUrl here
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.showSuccess(response.message || 'สมัครสมาชิกสำเร็จ');

          // Navigate to login after success
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500);
        },
        error: (error) => {
          this.isLoading = false;
          const errorMsg = error.error?.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
          this.showError(errorMsg);
          console.error('Register error:', error);
        }
      });
  }

  // Navigate to Login page
  goToLogin() {
    this.router.navigate(['/login']);
  }

  // Show success snackbar
  showSuccess(message: string) {
    this.snackBar.open(message, 'ปิด', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }

  // Show error snackbar
  showError(message: string) {
    this.snackBar.open(message, 'ปิด', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
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


  // Helper methods for displaying error messages in the template
  getErrorMessage(fieldName: string): string {
    const field = this.registerForm.get(fieldName);

    if (!field || !field.touched) {
        return ''; // Don't show errors until touched
    }
    if (field.hasError('required')) {
      return 'กรุณากรอกข้อมูล';
    }
    if (field.hasError('email')) {
      return 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    if (field.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `ต้องมีอย่างน้อย ${minLength} ตัวอักษร`;
    }
    if (fieldName === 'confirmPassword' && field.hasError('passwordMismatch')) {
      return 'รหัสผ่านไม่ตรงกัน';
    }

    return '';
  }
}
