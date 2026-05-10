import { apiClient } from './client';

export type NotifCount = {
  feed:      number;
  prospek:   number;
  request:   number;
  error_log: number;
  pesan:     number;
};

/** Konstanta model_type sesuai yang disimpan backend di kolom `model_type`
 *  LogAktivitas. Pakai ini saat panggil markRead supaya tidak typo. */
export const NotifModel = {
  Feed:    'App\\Models\\Feed',
  Prospek: 'App\\Models\\Prospek',
  Request: 'App\\Models\\ClientRequest',
  ErrorLog:'App\\Models\\ErrorLog',
} as const;

export const notifApi = {
  count: async (): Promise<NotifCount> => {
    const { data } = await apiClient.get<NotifCount>('/notif-count');
    return data;
  },

  markRead: async (modelType: string, modelId: number): Promise<void> => {
    await apiClient.post('/aktivitas/mark-read', {
      model_type: modelType,
      model_id:   modelId,
    });
  },
};
