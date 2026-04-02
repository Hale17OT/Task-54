import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { contentApi } from '@/api/content.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatDateTime } from '@/lib/utils';
import { getMediaUrl } from '@/lib/media-url';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { ContentStatus } from '@checc/shared/types/content.types';
import type { ArticleDto } from '@checc/shared/types/content.types';
import { CheckCircle, XCircle, Mic, Send, Archive } from 'lucide-react';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthStore((s) => s.user);
  const [article, setArticle] = useState<ArticleDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    contentApi.getBySlug(slug!).then((res) => {
      setArticle(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Article not found');
      setIsLoading(false);
    });
  }, [slug]);

  const handleReview = async (approved: boolean) => {
    if (!article) return;
    try {
      const res = await contentApi.review(article.id, { approved });
      setArticle(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    }
  };

  if (isLoading) return <LoadingSpinner className="h-64" text="Loading article..." />;
  if (error && !article) return <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>;
  if (!article) return <p className="text-destructive">Article not found</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
          <p className="text-muted-foreground">
            By {article.authorName} - {formatDateTime(article.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{article.contentType}</Badge>
          {isAdmin && <StatusBadge status={article.status} />}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardContent className="pt-6 prose prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.body) }} />
        </CardContent>
      </Card>

      {/* Media Assets */}
      {article.mediaAssets && article.mediaAssets.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Media</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {article.mediaAssets
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((asset) => (
                <div key={asset.id} className="rounded-lg border overflow-hidden">
                  {asset.mediaType === 'image' && (
                    <img
                      src={getMediaUrl(asset.filePath)}
                      alt={asset.altText || article.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  {asset.mediaType === 'audio' && (
                    <div className="p-4 flex items-center gap-3">
                      <Mic className="h-8 w-8 text-muted-foreground" />
                      <audio controls className="flex-1">
                        <source src={getMediaUrl(asset.filePath)} type={asset.mimeType} />
                      </audio>
                    </div>
                  )}
                  {asset.mediaType === 'video' && (
                    <video controls className="w-full">
                      <source src={getMediaUrl(asset.filePath)} type={asset.mimeType} />
                    </video>
                  )}
                  {asset.altText && (
                    <p className="px-3 py-2 text-xs text-muted-foreground border-t">{asset.altText}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Author actions — submit for review */}
      {article.status === ContentStatus.DRAFT && (user?.id === article.authorId || isAdmin) && (
        <div className="flex gap-3">
          <Button onClick={async () => {
            try { const res = await contentApi.submitForReview(article.id); setArticle(res.data); }
            catch (err) { setError(err instanceof Error ? err.message : 'Submit failed'); }
          }}>
            <Send className="mr-2 h-4 w-4" />Submit for Review
          </Button>
        </div>
      )}

      {/* Admin review actions — approve/reject */}
      {isAdmin && article.status === ContentStatus.IN_REVIEW && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Review</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={() => handleReview(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />Approve & Publish
            </Button>
            <Button variant="destructive" onClick={() => handleReview(false)}>
              <XCircle className="mr-2 h-4 w-4" />Reject
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin archive action */}
      {isAdmin && article.status === ContentStatus.PUBLISHED && (
        <Button variant="outline" onClick={async () => {
          try { const res = await contentApi.archive(article.id); setArticle(res.data); }
          catch (err) { setError(err instanceof Error ? err.message : 'Archive failed'); }
        }}>
          <Archive className="mr-2 h-4 w-4" />Archive
        </Button>
      )}

      {article.sensitiveWordHits && article.sensitiveWordHits.length > 0 && isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-lg text-warning">Sensitive Word Hits</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {article.sensitiveWordHits.map((hit, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <Badge variant={hit.severity === 'HIGH' ? 'destructive' : 'warning'}>{hit.severity}</Badge>
                  <span className="font-mono">{hit.word}</span>
                  <span className="text-muted-foreground">— {hit.context}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
