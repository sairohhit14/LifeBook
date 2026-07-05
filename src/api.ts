import { 
  User, 
  Memory, 
  Milestone, 
  LegacyMessage, 
  FamilyMember, 
  DocumentFile, 
  Notification, 
  ChatMessage, 
  AIStory, 
  DashboardStats 
} from "./types";

const getHeaders = () => {
  const userId = localStorage.getItem("lifebook_userId");
  return {
    "Content-Type": "application/json",
    ...(userId ? { "Authorization": `Bearer ${userId}` } : {})
  };
};

export const api = {
  // Auth
  setSession(userId: string) {
    localStorage.setItem("lifebook_userId", userId);
  },
  
  clearSession() {
    localStorage.removeItem("lifebook_userId");
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem("lifebook_userId");
  },

  getUserId(): string | null {
    return localStorage.getItem("lifebook_userId");
  },

  async register(data: any): Promise<User> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async login(data: any): Promise<User> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch("/api/auth/current-user", {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("Failed to fetch user session");
    }
    return res.json();
  },

  async familyLogin(legacyKey: string, familyMemberName: string): Promise<User & { ownerName: string }> {
    const res = await fetch("/api/auth/family-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legacyKey, familyMemberName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Family member login failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; previewUrl?: string }> {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Password recovery request failed");
    }
    return res.json();
  },

  async confirmLogin(email: string, otp: string): Promise<User> {
    const res = await fetch("/api/auth/confirm-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login confirmation failed");
    }
    const user = await res.json();
    this.setSession(user.id);
    return user;
  },

  // File Upload helper
  async uploadFile(filename: string, base64Data: string, type: 'image' | 'video' | 'audio'): Promise<{ url: string, name: string }> {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ filename, base64Data, type })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "File upload failed");
    }
    return res.json();
  },

  async describeImage(base64Data: string): Promise<{ description: string }> {
    const res = await fetch("/api/describe-image", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ base64Data })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Image description failed");
    }
    return res.json();
  },

  async deliverMessageInstantly(id: string): Promise<LegacyMessage> {
    const res = await fetch(`/api/messages/${id}/deliver`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Instant delivery failed");
    }
    return res.json();
  },

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch("/api/dashboard/stats", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  // Memories
  async getMemories(): Promise<Memory[]> {
    const res = await fetch("/api/memories", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch memories");
    return res.json();
  },

  async createMemory(data: Partial<Memory>): Promise<Memory> {
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to save memory");
    return res.json();
  },

  async updateMemory(id: string, data: Partial<Memory>): Promise<Memory> {
    const res = await fetch(`/api/memories/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update memory");
    return res.json();
  },

  async deleteMemory(id: string): Promise<void> {
    const res = await fetch(`/api/memories/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete memory");
  },

  // Timeline (Milestones)
  async getTimeline(): Promise<Milestone[]> {
    const res = await fetch("/api/timeline", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch timeline");
    return res.json();
  },

  async createMilestone(data: Partial<Milestone>): Promise<Milestone> {
    const res = await fetch("/api/timeline", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create milestone");
    return res.json();
  },

  async updateMilestone(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const res = await fetch(`/api/timeline/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update milestone");
    return res.json();
  },

  async deleteMilestone(id: string): Promise<void> {
    const res = await fetch(`/api/timeline/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete milestone");
  },

  // Legacy Messages
  async getMessages(): Promise<LegacyMessage[]> {
    const res = await fetch("/api/messages", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch legacy messages");
    return res.json();
  },

  async createMessage(data: Partial<LegacyMessage>): Promise<LegacyMessage> {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to schedule legacy message");
    return res.json();
  },

  async updateMessage(id: string, data: Partial<LegacyMessage>): Promise<LegacyMessage> {
    const res = await fetch(`/api/messages/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update message");
    return res.json();
  },

  async deleteMessage(id: string): Promise<void> {
    const res = await fetch(`/api/messages/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete message");
  },

  // Family Management
  async getFamily(): Promise<FamilyMember[]> {
    const res = await fetch("/api/family", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch family circle");
    return res.json();
  },

  async createFamilyMember(data: Partial<FamilyMember>): Promise<FamilyMember> {
    const res = await fetch("/api/family", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to add family member");
    return res.json();
  },

  async updateFamilyMember(id: string, data: Partial<FamilyMember>): Promise<FamilyMember> {
    const res = await fetch(`/api/family/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update family member");
    return res.json();
  },

  async deleteFamilyMember(id: string): Promise<void> {
    const res = await fetch(`/api/family/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to remove family member");
  },

  // Secure Vault (Documents)
  async getDocuments(): Promise<DocumentFile[]> {
    const res = await fetch("/api/documents", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  },

  async createDocument(data: Partial<DocumentFile>): Promise<DocumentFile> {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to secure document");
    return res.json();
  },

  async updateDocument(id: string, data: Partial<DocumentFile>): Promise<DocumentFile> {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to edit document");
    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete document");
  },

  // AI Stories
  async getStories(): Promise<AIStory[]> {
    const res = await fetch("/api/stories", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch legacy biographies");
    return res.json();
  },

  async generateStory(biographyLength: 'short' | 'medium' | 'biography', personalNotes?: string): Promise<AIStory> {
    const res = await fetch("/api/story/generate", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ biographyLength, personalNotes })
    });
    if (!res.ok) throw new Error("Failed to generate biography book");
    return res.json();
  },

  async deleteStory(id: string): Promise<void> {
    const res = await fetch(`/api/stories/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete biography");
  },

  // AI Chat Companion
  async getChatHistory(): Promise<ChatMessage[]> {
    const res = await fetch("/api/chat/history", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch chat history");
    return res.json();
  },

  async sendMessage(message: string): Promise<ChatMessage> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error("Failed to send message to AI companion");
    return res.json();
  },

  async clearChatHistory(): Promise<ChatMessage[]> {
    const res = await fetch("/api/chat/history", {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to clear chat history");
    const data = await res.json();
    return data.history;
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await fetch("/api/notifications", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },

  async markNotificationRead(id: string): Promise<void> {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
  },

  async clearAllNotifications(): Promise<void> {
    const res = await fetch("/api/notifications/clear", {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to clear notifications");
  },

  // Global Search
  async globalSearch(q: string): Promise<{
    memories: Memory[];
    milestones: Milestone[];
    documents: DocumentFile[];
    family: FamilyMember[];
    messages: LegacyMessage[];
  }> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Search request failed");
    return res.json();
  },

  // Settings
  async updateProfile(data: { name: string, email: string, dob: string, phone?: string, profilePhoto?: string }): Promise<User> {
    const res = await fetch("/api/settings/profile", {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Profile update failed");
    }
    return res.json();
  },

  async regenerateLegacyKey(): Promise<{ legacyKey: string }> {
    const res = await fetch("/api/settings/legacy-key/regenerate", {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to regenerate legacy key");
    }
    return res.json();
  },

  async changePassword(data: any): Promise<void> {
    const res = await fetch("/api/settings/password", {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Password change failed");
    }
  },

  async deleteAccount(): Promise<void> {
    const res = await fetch("/api/settings/account", {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete account");
    this.clearSession();
  },

  async getEmailConfig(): Promise<any> {
    const res = await fetch("/api/settings/email-config", {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load email configurations");
    return res.json();
  },

  async updateEmailConfig(config: any): Promise<any> {
    const res = await fetch("/api/settings/email-config", {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(config)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update email configurations");
    }
    return res.json();
  },

  // Google Flow AI Video Generator
  async generateVideoScript(): Promise<{
    title: string;
    musicTrack: string;
    durationSeconds: number;
    scenes: Array<{
      title: string;
      narration: string;
      visualCue: string;
      duration: number;
      mediaUrl?: string;
    }>;
  }> {
    const res = await fetch("/api/video/generate", {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Video script generation failed");
    }
    return res.json();
  }
};
