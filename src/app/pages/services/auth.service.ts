import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

interface User {
  id: number;
  name: string;
  email: string;
  type: number; // 0 = user, 1 = admin
  loginTime?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor(private router: Router) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    this.currentUserSubject = new BehaviorSubject<User | null>(user);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    return this.currentUserValue !== null;
  }

  public isAdmin(): boolean {
    return this.currentUserValue?.type === 1;
  }

  public isRegularUser(): boolean {
    return this.currentUserValue?.type === 0;
  }

  public setUser(user: User): void {
    // เพิ่ม loginTime เมื่อ set user
    const userWithTime = { 
      ...user, 
      loginTime: Date.now() 
    };
    localStorage.setItem('user', JSON.stringify(userWithTime));
    this.currentUserSubject.next(userWithTime);
  }

  public logout(): void {
    // ลบข้อมูล user
    localStorage.removeItem('user');
    
    // ลบข้อมูลอื่นๆ ที่เกี่ยวข้อง (ถ้ามี)
    // localStorage.removeItem('token');
    // localStorage.removeItem('refreshToken');
    
    // หรือ clear ทั้งหมด
    localStorage.clear();
    
    // Reset BehaviorSubject
    this.currentUserSubject.next(null);
    
    // Redirect ไป login
    this.router.navigate(['/login']);
    
    console.log('✅ User logged out, localStorage cleared');
  }

  public getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error parsing user data:', error);
      this.logout();
      return null;
    }
  }

  public redirectByUserType(): void {
    const user = this.currentUserValue;
    
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    if (user.type === 0) {
      this.router.navigate(['/main']);
    } else if (user.type === 1) {
      this.router.navigate(['/home-admin']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}