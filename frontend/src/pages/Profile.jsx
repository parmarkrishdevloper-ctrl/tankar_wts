import { useEffect, useState } from 'react';
import { FiUser, FiLock, FiSave, FiLogOut } from 'react-icons/fi';
import { toast } from 'sonner';
import { profileAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';

export default function Profile() {
  const { user, logout, login } = useAuth();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await profileAPI.me();
        setMe(res.data.data);
        setName(res.data.data.name || '');
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateName = async () => {
    if (!name.trim()) return toast.error('Name cannot be empty');
    setSavingName(true);
    try {
      const res = await profileAPI.update({ name: name.trim() });
      setMe(res.data.data);
      // Reflect new name in auth context everywhere (sidebar / topbar / etc.)
      const token = localStorage.getItem('adminToken');
      login(res.data.data, token);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('New password and confirmation do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setChangingPw(true);
    try {
      await profileAPI.changePassword({ currentPassword, newPassword });
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="center-block">
        <Spinner size="lg" /> Loading profile…
      </div>
    );
  }

  if (!me) return null;

  const initials =
    (me.name || 'A')
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Profile</h1>
          <p>Manage your account and credentials.</p>
        </div>
        <Button variant="secondary" onClick={logout}>
          <FiLogOut /> Sign out
        </Button>
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="Account" subtitle="Public profile details" />
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div className="avatar avatar-lg" style={{ width: 64, height: 64, fontSize: 'var(--text-lg)' }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{me.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text-muted)' }}>Administrator</div>
              </div>
            </div>

            <Field label="Display name">
              <Input icon={FiUser} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <Button onClick={updateName} loading={savingName} disabled={name === me.name}>
                <FiSave /> Save
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security" subtitle="Change your password" />
          <CardBody>
            <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Field label="Current password">
                <Input
                  icon={FiLock}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password" hint="At least 6 characters">
                <Input
                  icon={FiLock}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  icon={FiLock}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" loading={changingPw} disabled={!currentPassword || !newPassword}>
                  Change password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
