import { create } from 'zustand';
import { loginRequest, logoutRequest, meRequest, registerRequest } from '../api/auth.api.js';
import { disconnectSocket } from '../socket/socket.js';

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  initialized: false,
  error: '',

  register: async (payload) => {
    set({ loading: true, error: '' });
    try {
      const { user } = await registerRequest(payload);
      set({ user, loading: false, initialized: true });
      return user;
    } catch (error) {
      set({ error: error.message, loading: false, initialized: true });
      throw error;
    }
  },

  login: async (payload) => {
    set({ loading: true, error: '' });
    try {
      const { user } = await loginRequest(payload);
      set({ user, loading: false, initialized: true });
      return user;
    } catch (error) {
      set({ error: error.message, loading: false, initialized: true });
      throw error;
    }
  },

  checkAuth: async () => {
    set({ loading: true, error: '' });
    try {
      const { user } = await meRequest();
      set({ user, loading: false, initialized: true });
      return user;
    } catch (error) {
      set({ user: null, loading: false, initialized: true });
      return null;
    }
  },

  logout: async () => {
    set({ loading: true, error: '' });
    try {
      await logoutRequest();
    } finally {
      disconnectSocket();
      set({ user: null, loading: false, initialized: true });
    }
  },

  clearError: () => set({ error: '' })
}));
