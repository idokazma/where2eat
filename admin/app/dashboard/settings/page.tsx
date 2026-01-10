'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, User, Shield, Database } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and system configuration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          {isSuperAdmin && (
            <>
              <TabsTrigger value="users">
                <Shield className="h-4 w-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="system">
                <Database className="h-4 w-4 mr-2" />
                System
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  defaultValue={user?.name}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <div className="flex h-10 items-center px-3 py-2 rounded-md border border-input bg-muted text-sm capitalize">
                  {user?.role?.replace('_', ' ')}
                </div>
              </div>

              <div className="pt-4">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <input
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <input
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="pt-4">
                <Button>Update Password</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab (Super Admin Only) */}
        {isSuperAdmin && (
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Admin Users</CardTitle>
                <CardDescription>Manage admin user accounts and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">{user?.name}</h3>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-1 bg-primary/10 text-xs rounded-full capitalize">
                        {user?.role?.replace('_', ' ')}
                      </span>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>

                  <div className="pt-4">
                    <Button>
                      <User className="h-4 w-4 mr-2" />
                      Add New User
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
                <CardDescription>Permissions hierarchy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Super Admin</h4>
                      <p className="text-xs text-muted-foreground">Full system access</p>
                    </div>
                    <span className="text-sm text-muted-foreground">All permissions</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Admin</h4>
                      <p className="text-xs text-muted-foreground">Content + settings management</p>
                    </div>
                    <span className="text-sm text-muted-foreground">CRUD + Delete</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Editor</h4>
                      <p className="text-xs text-muted-foreground">Content management</p>
                    </div>
                    <span className="text-sm text-muted-foreground">Create, Read, Update</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">Viewer</h4>
                      <p className="text-xs text-muted-foreground">Read-only access</p>
                    </div>
                    <span className="text-sm text-muted-foreground">Read only</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* System Tab (Super Admin Only) */}
        {isSuperAdmin && (
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage external service API keys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Google Places API Key</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">OpenAI API Key</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Claude API Key</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="pt-4">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Save API Keys
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Database and application details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Database</p>
                    <p className="font-medium">SQLite</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Version</p>
                    <p className="font-medium">1.0.0</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Environment</p>
                    <p className="font-medium">Development</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Backup</p>
                    <p className="font-medium">Never</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
