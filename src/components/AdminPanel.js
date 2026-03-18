import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, KeyRound, Trash2, UserPlus, Users, Shield, BarChart3, Presentation } from 'lucide-react';

const AdminPanel = ({ open, onClose }) => {
  const { getAuthHeaders } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'employee'
  });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:4000/api/admin/users', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:4000/api/admin/stats', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchStats();
    }
  }, [open, fetchUsers, fetchStats]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://localhost:4000/api/admin/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');
      setFormData({ username: '', password: '', role: 'employee' });
      setShowCreateForm(false);
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? All their presentations will be deleted.')) return;
    try {
      const response = await fetch(`http://localhost:4000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangePassword = async (userId) => {
    const newPassword = window.prompt('Enter new password (minimum 6 characters):');
    if (!newPassword) return;
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    try {
      const response = await fetch(`http://localhost:4000/api/auth/change-password/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to change password');
      alert('Password changed successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, accent: 'border-t-primary' },
    { label: 'Employees', value: stats.totalEmployees, icon: Users, accent: 'border-t-emerald-500' },
    { label: 'Admins', value: stats.totalAdmins, icon: Shield, accent: 'border-t-amber-500' },
    { label: 'Presentations', value: stats.totalPresentations, icon: Presentation, accent: 'border-t-rose-500' },
  ] : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Admin Panel
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              {error}
              <button onClick={() => setError('')} className="ml-2 text-xs underline">Dismiss</button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards.map(({ label, value, icon: Icon, accent }) => (
              <Card key={label} className={`bg-secondary border-border border-t-2 ${accent}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create user */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Users</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="gap-2 border-border"
          >
            <UserPlus className="h-4 w-4" />
            {showCreateForm ? 'Cancel' : 'New User'}
          </Button>
        </div>

        {showCreateForm && (
          <Card className="bg-secondary border-border">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm">Create New User</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form onSubmit={handleCreateUser} className="flex flex-wrap gap-2">
                <Input
                  type="text"
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="flex-1 min-w-[120px]"
                />
                <Input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="flex-1 min-w-[140px]"
                />
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" className="gap-2">
                  <UserPlus className="h-4 w-4" /> Create
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users table */}
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading users...</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Presentations</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-border">
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={user.role === 'admin'
                          ? 'border-emerald-500/60 text-emerald-400'
                          : 'border-primary/60 text-primary'}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.presentationCount || 0}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-border"
                          onClick={() => handleChangePassword(user.id)}
                          title="Change Password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-border text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
