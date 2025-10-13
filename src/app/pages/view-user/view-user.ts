import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

// Interface for user data from the API
interface User {
  id: number;
  name: string;
  email: string;
  type: number;
  image: string | null;
}

// Interface for the confirmation popup
interface DeleteConfirmPopup {
  isVisible: boolean;
  userToDelete: User | null;
  isDeleting: boolean;
}

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.scss']
})
export class ViewUser implements OnInit {
  private readonly API_BASE_URL = 'https://sqlserverwebgame-main.onrender.com';

  // State Signals
  users = signal<User[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Popup Signal
  deletePopup = signal<DeleteConfirmPopup>({
    isVisible: false,
    userToDelete: null,
    isDeleting: false
  });

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.fetchAllUsers();
  }

  async fetchAllUsers(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      // Assuming admin user is stored in localStorage to exclude them
      const adminUserStr = localStorage.getItem('user');
      const adminId = adminUserStr ? JSON.parse(adminUserStr).id : 0;

      const response = await fetch(`${this.API_BASE_URL}/users?adminId=${adminId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user list.');
      }
      const userList: User[] = await response.json();

      // Process image URLs
      const processedUsers = userList.map(user => ({
        ...user,
        image: user.image
          ? `${this.API_BASE_URL}${user.image.replace('/uploads/profile', '/profile')}`
          : null
      }));

      this.users.set(processedUsers);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Delete Logic ---
  onDeleteUser(user: User): void {
    this.deletePopup.set({ isVisible: true, userToDelete: user, isDeleting: false });
  }

  closeDeletePopup(): void {
    this.deletePopup.set({ isVisible: false, userToDelete: null, isDeleting: false });
  }

  async confirmDelete(): Promise<void> {
    const user = this.deletePopup().userToDelete;
    if (!user) return;

    this.deletePopup.update(p => ({ ...p, isDeleting: true }));

    try {
      const response = await fetch(`${this.API_BASE_URL}/users/${user.id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete user.');
      }

      // Remove the deleted user from the local list
      this.users.update(currentUsers => currentUsers.filter(u => u.id !== user.id));
      this.closeDeletePopup();

    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred.');
      this.deletePopup.update(p => ({ ...p, isDeleting: false }));
    }
  }

  // --- Navigation ---
  onViewProfile(userId: number): void {
    this.router.navigate(['/view-user', userId]);
  }
}
