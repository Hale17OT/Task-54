import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentApi } from '@/api/content.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import type { ArticleDto } from '@checc/shared/types/content.types';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { Plus, BookOpen, Image, Mic, Video } from 'lucide-react';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  article: BookOpen,
  gallery: Image,
  audio: Mic,
  video: Video,
};

export function ArticleListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [articles, setArticles] = useState<ArticleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    const fetch = isAdmin ? contentApi.list() : contentApi.listPublished();
    fetch.then((res) => {
      setArticles(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load content');
      setIsLoading(false);
    });
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin ? 'Content Management' : 'Wellness Content'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage articles, galleries, and media' : 'Browse health and wellness content'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/content/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Article
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-3 opacity-30" />
          <p>No content available</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => {
            const Icon = typeIcons[article.contentType] || BookOpen;
            return (
              <Card
                key={article.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/content/${article.slug}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      <Icon className="mr-1 h-3 w-3" />
                      {article.contentType}
                    </Badge>
                    {isAdmin && <StatusBadge status={article.status} />}
                  </div>
                  <CardTitle className="text-lg leading-tight mt-2">{article.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.body.replace(/<[^>]+>/g, '').slice(0, 150)}...
                  </p>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>By {article.authorName}</span>
                    <span>{formatDate(article.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
