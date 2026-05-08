import { apiClient } from './client';

export type ChatRoom = {
  id: number;
  type: 'private' | 'group';
  nama: string;
  foto: string | null;
  unread: number;
  last_message: {
    id: number;
    pesan: string | null;
    tipe: 'text' | 'image';
    user_id: number;
    created_at: string;
  } | null;
};

export type ChatMessage = {
  id: number;
  room_id: number;
  user_id: number;
  pesan: string | null;
  foto_url: string | null;
  tipe: 'text' | 'image';
  dihapus_at: string | null;
  created_at: string;
  user: {
    id: number;
    nama: string;
    foto: string | null;
  };
};

export type ChatUser = {
  user_id: number;
  nama: string;
  foto: string | null;
  jabatan: string | null;
};

export const chatApi = {
  /** List semua chat room user, sorted by last message */
  rooms: async (): Promise<{ data: ChatRoom[] }> => {
    const { data } = await apiClient.get('/chat/rooms');
    return data;
  },

  /** Detail room + messages list (50 latest) */
  show: async (roomId: number): Promise<{
    room: { data: ChatRoom };
    messages: { data: ChatMessage[] };
    meta: { current_page: number; last_page: number; has_more: boolean };
  }> => {
    const { data } = await apiClient.get(`/chat/rooms/${roomId}`);
    return data;
  },

  /** Send message (text atau dengan foto) */
  send: async (roomId: number, payload: { pesan?: string; foto?: { uri: string; name: string; type: string } }): Promise<{ data: ChatMessage }> => {
    if (payload.foto) {
      const formData = new FormData();
      if (payload.pesan) formData.append('pesan', payload.pesan);
      formData.append('foto', payload.foto as any);

      const { data } = await apiClient.post(`/chat/rooms/${roomId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    }

    const { data } = await apiClient.post(`/chat/rooms/${roomId}/messages`, {
      pesan: payload.pesan,
    });
    return data;
  },

  /** Soft-delete pesan (hanya pengirim) */
  deleteMessage: async (roomId: number, messageId: number): Promise<void> => {
    await apiClient.delete(`/chat/rooms/${roomId}/messages/${messageId}`);
  },

  /** Tandai semua pesan sebagai dibaca */
  markRead: async (roomId: number): Promise<void> => {
    await apiClient.post(`/chat/rooms/${roomId}/read`);
  },

  /** Total unread count semua room */
  unreadCount: async (): Promise<{ total: number }> => {
    const { data } = await apiClient.get('/chat/unread-count');
    return data;
  },

  /** Buka atau buat chat private dengan user lain */
  openPrivate: async (userId: number): Promise<{ data: ChatRoom }> => {
    const { data } = await apiClient.post('/chat/private', { user_id: userId });
    return data;
  },

  /** Search user untuk start new chat */
  searchUsers: async (q: string = ''): Promise<{ data: ChatUser[] }> => {
    const { data } = await apiClient.get('/chat/users/search', { params: { q } });
    return data;
  },
};
