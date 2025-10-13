import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

interface User {
  type: number; // 0 = user, 1 = admin
}

// ฟังก์ชันหลักในการตรวจสอบการเข้าสู่ระบบและสิทธิ์
const checkAuthAndRole = (allowedType: number | null): boolean => {
  const router = inject(Router);
  const userStr = localStorage.getItem('user');

  console.log('🔍 Guard Check:', { allowedType, userStr }); // 👈 Debug

  // 1. ตรวจสอบการเข้าสู่ระบบ (Authentication)
  if (!userStr) {
    console.log('❌ Not authenticated, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  // 2. ตรวจสอบสิทธิ์ (Authorization) หากมีการกำหนด allowedType
  if (allowedType !== null) {
    try {
      const user: User = JSON.parse(userStr);
      console.log('👤 User type:', user.type, '| Required:', allowedType); // 👈 Debug

      if (user.type !== allowedType) {
        const redirectPath = user.type === 1 ? '/home-admin' : '/main';
        console.log(`❌ Access denied (Type ${user.type}), redirecting to ${redirectPath}`);
        router.navigate([redirectPath]);
        return false;
      }

      console.log('✅ Access granted'); // 👈 Debug
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
      localStorage.removeItem('user');
      router.navigate(['/login']);
      return false;
    }
  }

  return true;
};

// Guard สำหรับตรวจสอบว่า login แล้วหรือยัง (Authentication Only)
export const authGuard: CanActivateFn = () => {
  console.log('🛡️ authGuard called');
  return checkAuthAndRole(null);
};

// Guard สำหรับ User (type = 0) เท่านั้น
export const userGuard: CanActivateFn = () => {
  console.log('🛡️ userGuard called');
  return checkAuthAndRole(0);
};

// Guard สำหรับ Admin (type = 1) เท่านั้น
export const adminGuard: CanActivateFn = () => {
  console.log('🛡️ adminGuard called');
  return checkAuthAndRole(1);
};