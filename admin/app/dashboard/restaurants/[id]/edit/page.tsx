'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api';
import { Restaurant } from '@/types/restaurant';
import { restaurantSchema, RestaurantFormData } from '@/lib/validations/restaurant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ArrowLeft } from 'lucide-react';

export default function EditRestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const restaurantId = params.id as string;
  const [activeTab, setActiveTab] = useState('basic');

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
    }
  }, [restaurant, form]);

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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Media upload and Google Places integration coming soon...
              </p>
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
              <p className="text-sm text-muted-foreground">
                Episode information and timestamps will be shown here...
              </p>
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
              <p className="text-sm text-muted-foreground">
                Live card preview coming soon...
              </p>
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
