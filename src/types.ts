export type RelationshipType = 
  | 'Parent' 
  | 'Spouse' 
  | 'Child' 
  | 'Sibling' 
  | 'Grandchild' 
  | 'Grandparent' 
  | 'Friend' 
  | 'Other';

export type PermissionType = 'viewer' | 'contributor' | 'editor' | 'admin';

export type DeliveryOptionType = 
  | 'Specific Date' 
  | 'Birthday' 
  | 'Anniversary' 
  | 'Graduation' 
  | 'Wedding' 
  | 'Custom Event';

export type MilestoneCategoryType =
  | 'Childhood'
  | 'School'
  | 'College'
  | 'Career'
  | 'Marriage'
  | 'Travel'
  | 'Achievement'
  | 'Family'
  | 'Other';

export type DocumentCategoryType =
  | 'Will'
  | 'Insurance'
  | 'Property'
  | 'Medical Records'
  | 'Identity Documents'
  | 'Certificates'
  | 'Financial Documents'
  | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  dob: string;
  phone?: string;
  legacyCompletion: number;
  profilePhoto?: string;
  createdAt: string;
  legacyKey?: string; // Generated legacy key for family access
  ownerName?: string; // If guest, the name of the legacy archive owner
}

export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string; // Base64 or relative server upload URL
  name: string;
}

export interface Memory {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  location: string;
  tags: string[];
  media: MediaFile[];
  createdAt: string;
}

export interface Milestone {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  category: MilestoneCategoryType;
  location: string;
  media?: MediaFile[];
  createdAt: string;
}

export interface LegacyMessage {
  id: string;
  userId: string;
  title: string;
  recipientName: string;
  recipientEmail: string;
  deliveryOption: DeliveryOptionType;
  deliveryDate?: string;
  deliveryTime?: string;
  type: 'text' | 'voice' | 'video';
  content: string; // Message content or voice/video metadata
  mediaUrl?: string; // base64 or path to file
  mediaName?: string;
  status: 'scheduled' | 'delivered' | 'failed';
  error?: string;
  previewUrl?: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  relationship: RelationshipType;
  email: string;
  phone?: string;
  dob?: string;
  permission?: PermissionType;
  role?: string;
  profilePhoto?: string;
  createdAt: string;
}

export interface DocumentFile {
  id: string;
  userId: string;
  name: string;
  category: DocumentCategoryType;
  size: string; // e.g. "1.2 MB"
  uploadDate: string;
  fileUrl: string; // base64 or path
  mimeType: string;
  isEncrypted: boolean;
  title?: string;
  notes?: string;
  fileName?: string;
  fileSize?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  role?: 'user' | 'model';
  sender?: 'user' | 'companion' | 'model';
  text: string;
  date?: string;
  timestamp?: string;
}

export interface AIStoryChapter {
  title: string;
  content: string;
}

export interface AIStory {
  id: string;
  userId: string;
  title: string;
  biographyLength: 'short' | 'medium' | 'biography';
  chapters: AIStoryChapter[];
  generatedAt: string;
}

export interface DashboardStats {
  legacyCompletion: number;
  totalMemories: number;
  photosCount: number;
  videosCount: number;
  voicesCount: number;
  documentsCount: number;
  familyMembersCount: number;
  storiesGeneratedCount: number;
}
