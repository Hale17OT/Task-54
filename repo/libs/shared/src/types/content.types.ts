export enum ContentType {
  ARTICLE = 'article',
  GALLERY = 'gallery',
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum ContentStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export interface ArticleDto {
  id: string;
  title: string;
  slug: string;
  body: string;
  contentType: ContentType;
  status: ContentStatus;
  authorId: string;
  authorName: string;
  reviewerId: string | null;
  reviewNotes: string | null;
  sensitiveWordHits: SensitiveWordHit[] | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaAssets: MediaAssetDto[];
}

export interface MediaAssetDto {
  id: string;
  filePath: string;
  mediaType: 'image' | 'audio' | 'video';
  mimeType: string;
  altText: string | null;
  sortOrder: number;
}

export interface SensitiveWordHit {
  word: string;
  position: number;
  context: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CreateArticleRequest {
  title: string;
  body: string;
  contentType: ContentType;
}

export interface UpdateArticleRequest {
  title?: string;
  body?: string;
}
