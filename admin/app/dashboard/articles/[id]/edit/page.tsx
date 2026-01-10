'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { articlesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/articles/rich-text-editor';
import { Save, Eye, Send } from 'lucide-react';

interface ArticleFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string;
  status: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  scheduled_for: string;
}

export default function ArticleEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const articleId = params.id as string;
  const isNew = articleId === 'new';

  const [activeTab, setActiveTab] = useState('content');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ArticleFormData>({
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      featured_image: '',
      status: 'draft',
      category: '',
      tags: [],
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      scheduled_for: '',
    },
  });

  const formTags = watch('tags') || [];
  const title = watch('title');

  // Fetch article if editing
  const { data: article } = useQuery({
    queryKey: ['articles', articleId],
    queryFn: () => articlesApi.get(articleId),
    enabled: !isNew,
  });

  // Load article data
  useEffect(() => {
    if (article) {
      setValue('title', article.title);
      setValue('slug', article.slug);
      setValue('excerpt', article.excerpt || '');
      setValue('content', article.content || '');
      setContent(article.content || '');
      setValue('featured_image', article.featured_image || '');
      setValue('status', article.status);
      setValue('category', article.category || '');
      setValue('tags', article.tags || []);
      setValue('seo_title', article.seo_title || '');
      setValue('seo_description', article.seo_description || '');
      setValue('seo_keywords', article.seo_keywords || '');
      setValue('scheduled_for', article.scheduled_for || '');
    }
  }, [article, setValue]);

  // Auto-generate slug from title
  useEffect(() => {
    if (isNew && title) {
      const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
      setValue('slug', slug);
    }
  }, [title, isNew, setValue]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: ArticleFormData) => {
      const payload = {
        ...data,
        content,
        author_id: user?.id,
      };

      if (isNew) {
        return articlesApi.create(payload);
      }
      return articlesApi.update(articleId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      router.push('/dashboard/articles');
    },
  });

  const onSubmit = (data: ArticleFormData) => {
    saveMutation.mutate(data);
  };

  const handleSaveDraft = () => {
    setValue('status', 'draft');
    handleSubmit(onSubmit)();
  };

  const handlePublish = () => {
    setValue('status', 'published');
    handleSubmit(onSubmit)();
  };

  const addTag = () => {
    if (tagInput.trim() && !formTags.includes(tagInput.trim())) {
      setValue('tags', [...formTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', formTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isNew ? 'New Article' : 'Edit Article'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew ? 'Create a new blog post' : 'Edit your article content'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/articles')}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={handlePublish}
            disabled={saveMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Article Content</CardTitle>
                <CardDescription>Write your article content here</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Title <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...register('title', { required: 'Title is required' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Enter article title"
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                  )}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Slug <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...register('slug', { required: 'Slug is required' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="article-url-slug"
                  />
                  {errors.slug && (
                    <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>
                  )}
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium mb-2">Excerpt</label>
                  <textarea
                    {...register('excerpt')}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Brief summary of the article"
                  />
                </div>

                {/* Rich Text Editor */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Content <span className="text-destructive">*</span>
                  </label>
                  <RichTextEditor
                    content={content}
                    onChange={(html) => {
                      setContent(html);
                      setValue('content', html);
                    }}
                    placeholder="Start writing your article..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SEO Settings</CardTitle>
                <CardDescription>Optimize your article for search engines</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">SEO Title</label>
                  <input
                    {...register('seo_title')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Custom title for search engines"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use article title
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">SEO Description</label>
                  <textarea
                    {...register('seo_description')}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Meta description for search results"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: 150-160 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">SEO Keywords</label>
                  <input
                    {...register('seo_keywords')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Article Settings</CardTitle>
                <CardDescription>Configure article metadata and publishing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <input
                    {...register('category')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="e.g., News, Guides, Reviews"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Add a tag"
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Featured Image URL</label>
                  <input
                    {...register('featured_image')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    {...register('status')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {watch('status') === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Schedule For</label>
                    <input
                      type="datetime-local"
                      {...register('scheduled_for')}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}
