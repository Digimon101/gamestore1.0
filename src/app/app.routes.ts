import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Profile } from './pages/profile/profile';
import { Main } from './pages/main/main';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { HomeAdmin } from './pages/home-admin/home-admin';
import { ViewUser } from './pages/view-user/view-user';

//ของใหม่
import { Editgame } from './pages/editgame/editgame';
import { Addgame } from './pages/addgame/addgame';
import { Search } from './pages/search/search';
import { Wallet } from './pages/wallet/wallet';

import { authGuard, userGuard, adminGuard } from './guards/auth.guard';
import { Detail } from './pages/detail/detail';
import { DetailViewUser } from './pages/detail-veiw-user/detail-veiw-user';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  // --- Grouped Routes (Protected Routes) ---
  // สามารถกำหนด canActivate ให้กับเส้นทางแม่
  {
    path: '', // เส้นทางแม่ไม่มี prefix
    canActivate: [authGuard], // ทุกเส้นทางย่อยต้อง Login ก่อน
    children: [
      { path: 'profile', component: Profile },
      { path: 'edit-profile', component: EditProfile },
      { path: 'search', component: Search }, // เพิ่มหน้า Search (ทุกคนที่ Login แล้วเข้าได้)
      // ถ้ามีเส้นทางอื่นที่ Admin หรือ User เข้าได้
      { path: 'detail/:id', component: Detail },
    ]
  },

  // --- Role-Based Routes (ต้องใช้ Guard เฉพาะทาง) ---
  { path: 'main', component: Main, canActivate: [userGuard] },
  { path: 'wallet', component: Wallet, canActivate: [userGuard] },
  { path: 'home-admin', component: HomeAdmin, canActivate: [adminGuard] },
  { path: 'view-user', component: ViewUser, canActivate: [adminGuard] },
  { path: 'addgame', component: Addgame, canActivate: [adminGuard] },
  { path: 'editgame', component: Editgame, canActivate: [adminGuard] },
  { path: 'view-user/:id', component: DetailViewUser, canActivate: [adminGuard] },


  // --- Default Fallback ---
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];