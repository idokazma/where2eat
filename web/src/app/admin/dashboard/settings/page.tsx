'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/admin/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, usersApi, analyticsApi, type AdminUser } from '@/lib/admin/api';
import { queryKeys } from '@/lib/admin/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Badge } from '@/components/admin/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/admin/ui/tabs';
import {
  Save,
  User,
  Shield,
  Database,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const profileMutation = useMutation({
    mutationFn: (data: { name: string }) => authApi.updateProfile(data),
    onSuccess: () => {
      refreshUser?.();
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleSaveProfile = () => {
    if (name.trim()) {
      profileMutation.mutate({ name: name.trim() });
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) return;
    if (newPassword.length < 8) return;
    passwordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const passwordError = newPassword && confirmPassword && newPassword !== confirmPassword
    ? 'Passwords do not match'
    : newPassword && newPassword.length < 8
      ? 'Password must be at least 8 characters'
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={user?.email || ''}
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

          <div className="pt-4 flex items-center gap-3">
            <Button
              onClick={handleSaveProfile}
              disabled={profileMutation.isPending || name === user?.name}
            >
              {profileMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
            {profileMutation.isSuccess && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
            {profileMutation.isError && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {(profileMutation.error as any)?.error || 'Failed to save'}
              </span>
            )}
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
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {passwordError && (
              <p className="text-xs text-red-600 mt-1">{passwordError}</p>
            )}
          </div>

          <div className="pt-4 flex items-center gap-3">
            <Button
              onClick={handleChangePassword}
              disabled={
                passwordMutation.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                !!passwordError
              }
            >
              {passwordMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Update Password
            </Button>
            {passwordMutation.isSuccess && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Password updated
              </span>
            )}
            {passwordMutation.isError && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {(passwordMutation.error as any)?.error || 'Failed to update password'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'editor' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { email: string; password: string; name: string; role: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setShowAddForm(false);
      setNewUser({ email: '', password: '', name: '', role: 'editor' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; is_active?: boolean } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });

  const users: AdminUser[] = data?.users ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Admin Users</CardTitle>
            <CardDescription>Manage admin user accounts and roles</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="border rounded-lg p-4 mb-4 space-y-3">
              <h4 className="font-medium text-sm">New Admin User</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Name</label>
                  <Input
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Password</label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate(newUser)}
                  disabled={createMutation.isPending || !newUser.email || !newUser.password || !newUser.name}
                >
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Create User
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
              {createMutation.isError && (
                <p className="text-xs text-red-600">
                  {(createMutation.error as any)?.error || 'Failed to create user'}
                </p>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">{u.name}</h3>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {u.role?.replace('_', ' ')}
                      </Badge>
                      {u.is_active === false && (
                        <Badge variant="destructive" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {u.is_active !== false ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: u.id, data: { is_active: false } })}
                        disabled={updateMutation.isPending}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: u.id, data: { is_active: true } })}
                        disabled={updateMutation.isPending}
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Permissions hierarchy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: 'Super Admin', desc: 'Full system access', perms: 'All permissions' },
              { role: 'Admin', desc: 'Content + settings management', perms: 'CRUD + Delete' },
              { role: 'Editor', desc: 'Content management', perms: 'Create, Read, Update' },
              { role: 'Viewer', desc: 'Read-only access', perms: 'Read only' },
            ].map((item) => (
              <div key={item.role} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <h4 className="font-medium">{item.role}</h4>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-sm text-muted-foreground">{item.perms}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SystemTab() {
  const { data: healthData, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => analyticsApi.getSystemHealth(),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Database and application status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Database</p>
                <p className="font-medium">{healthData?.database?.type || 'SQLite'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">DB Size</p>
                <p className="font-medium">{healthData?.database?.size || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Records</p>
                <p className="font-medium">{healthData?.database?.records?.toLocaleString() || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Uptime</p>
                <p className="font-medium">{healthData?.uptime || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-medium">1.0.0</p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-medium capitalize">{process.env.NODE_ENV || 'development'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">API Response (p50)</p>
                <p className="font-medium">{healthData?.performance?.p50 || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">API Response (p95)</p>
                <p className="font-medium">{healthData?.performance?.p95 || 'N/A'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="space-y-6 max-w-4xl">
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

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="system">
            <SystemTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
