import api from './axios.js';
import { API_URL } from '../utils/constants.js';

export const listMessagesRequest = (roomId) => api.get(`/chat/room/${roomId}`).then((res) => res.data.data);
export const searchMessagesRequest = (roomId, params) => api.get(`/chat/room/${roomId}/search`, { params }).then((res) => res.data.data);
export const sendVoiceNoteRequest = (roomId, { blob, duration }) => {
  const formData = new FormData();
  formData.append('audio', blob, 'voice-note.webm');
  formData.append('duration', String(duration));

  return fetch(`${API_URL}/chat/room/${roomId}/voice`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || 'Voice note upload failed.');
      error.status = response.status;
      throw error;
    }

    return payload.data;
  });
};

export const editMessageRequest = (messageId, message) => api.patch(`/chat/messages/${messageId}`, { message }).then((res) => res.data.data);
export const deleteMessageRequest = (messageId) => api.delete(`/chat/messages/${messageId}`).then((res) => res.data.data);

