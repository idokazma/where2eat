'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi, mentionsApi, patchRestaurant, type EpisodeMention } from '@/lib/admin/api';
import { Restaurant } from '@/types/admin/restaurant';
import { RestaurantPhoto } from '@/types/restaurant';
import { restaurantSchema, RestaurantFormData } from '@/lib/admin/validations/restaurant';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/admin/ui/tabs';
import { Save, ArrowLeft, EyeOff, Star, Loader2 } from 'lucide-react';

export default function EditRestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const restaurantId = params.id as string;
  const [activeTab, setActiveTab] = useState(new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') || 'basic');
  const [isHidden, setIsHidden] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [woltUrl, setWoltUrl] = useState('');
  const [ontopoUrl, setOntopoUrl] = useState('');
  const [photos, setPhotos] = useState<RestaurantPhoto[]>([]);

  const patchMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) => patchRestaurant(restaurantId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
    },
  });

  const makeMainPhoto = (index: number) => {
    if (index <= 0 || index >= photos.length) return;
    const reordered = [photos[index], ...photos.slice(0, index), ...photos.slice(index + 1)];
    patchMutation.mutate({ photos: reordered });
  };


  // Fetch restaurant data
  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => restaurantsApi.get(restaurantId),
    enabled: restaurantId !== 'new',
  });

  // Form setup
  const form = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name_hebrew: '',
      name_english: null,
      location: {
        city: null,
        neighborhood: null,
        address: null,
        region: null,
      },
      cuisine_type: '',
      status: 'open',
      price_range: 'not_mentioned',
      host_opinion: 'neutral',
      host_comments: '',
      menu_items: [],
      special_features: [],
      contact_info: {
        hours: null,
        phone: null,
        website: null,
      },
      business_news: null,
      mention_context: 'review',
      food_trends: [],
    },
  });

  // Load restaurant data into form
  useEffect(() => {
    if (restaurant) {
      setInstagramUrl(restaurant.instagram_url || '');
      setWoltUrl(restaurant.wolt_url || '');
      setOntopoUrl(restaurant.ontopo_url || '');
      setImageUrl(restaurant.image_url || '');
      setPhotos(Array.isArray(restaurant.photos) ? restaurant.photos : []);
      form.reset({
        name_hebrew: restaurant.name_hebrew,
        name_english: restaurant.name_english,
        location: restaurant.location,
        cuisine_type: restaurant.cuisine_type,
        status: restaurant.status,
        price_range: restaurant.price_range,
        host_opinion: restaurant.host_opinion,
        host_comments: restaurant.host_comments,
        menu_items: restaurant.menu_items || [],
        special_features: restaurant.special_features || [],
        contact_info: restaurant.contact_info,
        business_news: restaurant.business_news,
        mention_context: restaurant.mention_context,
        food_trends: restaurant.food_trends || [],
      });
      setIsHidden(!!restaurant.is_hidden);
    }
  }, [restaurant, form]);

  const toggleVisibility = useMutation({
    mutationFn: (hidden: boolean) =>
      restaurantsApi.toggleVisibility(restaurantId, hidden),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: RestaurantFormData) => {
      if (restaurantId === 'new') {
        return restaurantsApi.create(data);
      }
      return restaurantsApi.update(restaurantId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      router.push('/dashboard/restaurants');
    },
  });

  const onSubmit = (data: RestaurantFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading && restaurantId !== 'new') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/restaurants')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {restaurantId === 'new' ? 'Add Restaurant' : 'Edit Restaurant'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {restaurantId === 'new'
                ? 'Create a new restaurant entry'
                : 'Update restaurant information'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {restaurantId !== 'new' && (
            <Button
              variant={isHidden ? 'destructive' : 'outline'}
              onClick={() => {
                const newVal = !isHidden;
                setIsHidden(newVal);
                toggleVisibility.mutate(newVal);
              }}
              disabled={toggleVisibility.isPending}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              {isHidden ? 'Hidden' : 'Hide'}
            </Button>
          )}
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
        </div>
      </div>

      {/* Form Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Restaurant name, cuisine, and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name_hebrew">Hebrew Name *</Label>
                  <Input
                    id="name_hebrew"
                    {...form.register('name_hebrew')}
                    placeholder="שם המסעדה בעברית"
                  />
                  {form.formState.errors.name_hebrew && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name_hebrew.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_english">English Name</Label>
                  <Input
                    id="name_english"
                    {...form.register('name_english')}
                    placeholder="Restaurant Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cuisine_type">Cuisine Type *</Label>
                  <Input
                    id="cuisine_type"
                    {...form.register('cuisine_type')}
                    placeholder="e.g. Italian, Mediterranean"
                  />
                  {form.formState.errors.cuisine_type && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.cuisine_type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    {...form.register('status')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="new_opening">New Opening</option>
                    <option value="closing_soon">Closing Soon</option>
                    <option value="reopening">Reopening</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_range">Price Range</Label>
                  <select
                    id="price_range"
                    {...form.register('price_range')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="budget">Budget (₪)</option>
                    <option value="mid-range">Mid-range (₪₪)</option>
                    <option value="expensive">Expensive (₪₪₪)</option>
                    <option value="not_mentioned">Not Mentioned</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host_opinion">Host Opinion</Label>
                  <select
                    id="host_opinion"
                    {...form.register('host_opinion')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="positive">Positive 😍</option>
                    <option value="negative">Negative 😞</option>
                    <option value="mixed">Mixed 🤔</option>
                    <option value="neutral">Neutral 😐</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mention_context">Mention Context</Label>
                  <select
                    id="mention_context"
                    {...form.register('mention_context')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="review">Review</option>
                    <option value="new_opening">New Opening</option>
                    <option value="news">News</option>
                    <option value="recommendation">Recommendation</option>
                    <option value="comparison">Comparison</option>
                    <option value="business_news">Business News</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location.city">City</Label>
                  <Input
                    id="location.city"
                    {...form.register('location.city')}
                    placeholder="Tel Aviv"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location.neighborhood">Neighborhood</Label>
                  <Input
                    id="location.neighborhood"
                    {...form.register('location.neighborhood')}
                    placeholder="Florentin"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location.address">Address</Label>
                  <Input
                    id="location.address"
                    {...form.register('location.address')}
                    placeholder="123 Main St"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location.region">Region</Label>
                  <select
                    id="location.region"
                    {...form.register('location.region')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Not specified</option>
                    <option value="North">North</option>
                    <option value="Center">Center</option>
                    <option value="South">South</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="host_comments">Host Comments</Label>
                <textarea
                  id="host_comments"
                  {...form.register('host_comments')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="What did the host say about this restaurant?"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Menu items, special features, and trends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Menu Items</Label>
                <p className="text-sm text-muted-foreground">
                  Add notable menu items mentioned in the podcast
                </p>
                {/* TODO: Implement dynamic menu items array */}
                <p className="text-sm text-muted-foreground italic">
                  Menu items editor coming soon...
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_news">Business News</Label>
                <textarea
                  id="business_news"
                  {...form.register('business_news')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Any recent news about the restaurant?"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Hours, phone, and website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact_info.phone">Phone</Label>
                <Input
                  id="contact_info.phone"
                  {...form.register('contact_info.phone')}
                  placeholder="+972-3-1234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_info.website">Website</Label>
                <Input
                  id="contact_info.website"
                  {...form.register('contact_info.website')}
                  placeholder="https://restaurant.com"
                  type="url"
                />
                {form.formState.errors.contact_info?.website && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.contact_info.website.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_info.hours">Operating Hours</Label>
                <textarea
                  id="contact_info.hours"
                  {...form.register('contact_info.hours')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Mon-Fri: 12:00-23:00&#10;Sat: 18:00-00:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_url">אינסטגרם (URL)</Label>
                <Input
                  id="instagram_url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://www.instagram.com/restaurant/"
                  type="url"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={patchMutation.isPending}
                  onClick={() => patchMutation.mutate({ instagram_url: instagramUrl })}
                >
                  שמירת אינסטגרם
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wolt_url">Wolt (URL)</Label>
                <Input
                  id="wolt_url"
                  value={woltUrl}
                  onChange={(e) => setWoltUrl(e.target.value)}
                  placeholder="https://wolt.com/..."
                  type="url"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={patchMutation.isPending}
                  onClick={() => patchMutation.mutate({ wolt_url: woltUrl })}
                >
                  שמירת Wolt
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ontopo_url">Ontopo (URL)</Label>
                <Input
                  id="ontopo_url"
                  value={ontopoUrl}
                  onChange={(e) => setOntopoUrl(e.target.value)}
                  placeholder="https://ontopo.co.il/..."
                  type="url"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={patchMutation.isPending}
                  onClick={() => patchMutation.mutate({ ontopo_url: ontopoUrl })}
                >
                  שמירת Ontopo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>Media & Photos</CardTitle>
              <CardDescription>Restaurant images and Google Places data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="image_url">תמונה ראשית — כתובת https</Label>
                <Input
                  id="image_url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  משמשת כשאין תמונות גוגל, או אחרי ניקוי התמונות. ריק = מחיקה.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={patchMutation.isPending}
                  onClick={() => patchMutation.mutate({ image_url: imageUrl })}
                >
                  שמירת תמונה ראשית
                </Button>
              </div>

              <div className="space-y-2">
                <Label>תמונות גוגל ({photos.length})</Label>
                <p className="text-xs text-muted-foreground">
                  התמונה הראשונה היא מה שמוצג בכרטיסים. אפשר לבחור תמונה ראשית או לנקות ולחזור לכתובת התמונה הראשית.
                </p>
                {photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין תמונות גוגל שמורות.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((ph, i: number) => (
                      <button
                        key={ph.photo_reference || ph.photo_url || i}
                        type="button"
                        disabled={patchMutation.isPending}
                        onClick={() => makeMainPhoto(i)}
                        className={`relative rounded-md overflow-hidden border-2 ${i === 0 ? 'border-green-500' : 'border-transparent'}`}
                        title={i === 0 ? 'תמונה ראשית' : 'הפיכה לראשית'}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ph.photo_url || `/api/photos/${ph.photo_reference}`}
                          alt=""
                          className="w-full h-20 object-cover"
                        />
                        {i === 0 && (
                          <span className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-0.5">
                            <Star className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {photos.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ photos: [] })}
                  >
                    ניקוי תמונות גוגל
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  העלאת קבצי תמונה חדשים עדיין לא נתמכת — מדביקים כתובת https למעלה.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source Tab */}
        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle>Source Information</CardTitle>
              <CardDescription>Episode and mention details</CardDescription>
            </CardHeader>
            <CardContent>
              <MentionsEditor restaurantId={restaurantId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Card Preview</CardTitle>
              <CardDescription>See how the restaurant card will appear</CardDescription>
            </CardHeader>
            <CardContent>
              {restaurant && (
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Name:</span> {restaurant.name_hebrew} {restaurant.name_english ? `/ ${restaurant.name_english}` : ''}</p>
                  <p><span className="font-medium">City:</span> {restaurant.location?.city || '-'}</p>
                  <p><span className="font-medium">Status:</span> {restaurant.status}</p>
                  <p><span className="font-medium">Quote:</span> {restaurant.engaging_quote || '-'}</p>
                  <p><span className="font-medium">Instagram:</span> {restaurant.instagram_url || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    תצוגה מקדימה ויזואלית מלאה עדיין לא כלולה; אפשר לפתוח את עמוד המסעדה הציבורי לראות את הכרטיס החי.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {updateMutation.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to save restaurant. Please try again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function MentionsEditor({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-mentions', restaurantId],
    queryFn: () => mentionsApi.listForRestaurant(restaurantId),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, quote }: { id: string; quote: string }) =>
      mentionsApi.update(id, { host_quotes: quote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-mentions', restaurantId] });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const quoteText = (q: unknown): string => {
    if (Array.isArray(q)) return q.filter(Boolean).join('\n');
    return typeof q === 'string' ? q : '';
  };

  const mentions = data?.mentions ?? [];
  if (mentions.length === 0) {
    return <p className="text-sm text-muted-foreground">אין אזכורים בפרקים המקושרים למסעדה הזו.</p>;
  }

  return (
    <div className="space-y-4">
      {mentions.map((mn: EpisodeMention) => (
        <div key={mn.id} className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {mn.episode_title || mn.video_id}
              {mn.timestamp_display ? ` · ${mn.timestamp_display}` : ''}
            </span>
            <span className="text-xs text-muted-foreground">{mn.mention_level || mn.verdict}</span>
          </div>
          <textarea
            className="w-full min-h-[70px] px-3 py-2 border rounded-md bg-background text-sm"
            value={edits[mn.id] ?? quoteText(mn.host_quotes)}
            onChange={(e) => setEdits({ ...edits, [mn.id]: e.target.value })}
            placeholder="ציטוט המערכת שמוצג בכרטיס"
          />
          {mn.mention_context && (
            <p className="text-xs text-muted-foreground">Context: {mn.mention_context}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveMutation.isPending || (edits[mn.id] ?? quoteText(mn.host_quotes)) === quoteText(mn.host_quotes)}
            onClick={() => saveMutation.mutate({ id: mn.id, quote: edits[mn.id] ?? '' })}
          >
            שמירת ציטוט
          </Button>
        </div>
      ))}
    </div>
  );
}
