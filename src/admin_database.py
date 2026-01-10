"""
Admin database operations for Where2Eat.
Handles admin users, sessions, and audit logging.
"""

import hashlib
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from src.database import Database


class AdminDatabase(Database):
    """Extended database class with admin operations."""

    # ==================== Admin User Operations ====================

    def create_admin_user(self, email: str, password: str, name: str, role: str = 'editor') -> str:
        """Create a new admin user.

        Args:
            email: User email (must be unique)
            password: Plain text password (will be hashed)
            name: User's full name
            role: One of: super_admin, admin, editor, viewer

        Returns:
            User ID

        Raises:
            ValueError: If role is invalid or email already exists
        """
        valid_roles = ['super_admin', 'admin', 'editor', 'viewer']
        if role not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")

        user_id = str(uuid.uuid4())
        password_hash = self._hash_password(password)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('''
                    INSERT INTO admin_users (id, email, password_hash, name, role)
                    VALUES (?, ?, ?, ?, ?)
                ''', (user_id, email, password_hash, name, role))
                return user_id
            except Exception as e:
                if 'UNIQUE constraint failed' in str(e):
                    raise ValueError(f"Email {email} already exists")
                raise

    def get_admin_user(self, user_id: str = None, email: str = None) -> Optional[Dict]:
        """Get admin user by ID or email."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute('SELECT * FROM admin_users WHERE id = ?', (user_id,))
            elif email:
                cursor.execute('SELECT * FROM admin_users WHERE email = ?', (email,))
            else:
                return None

            row = cursor.fetchone()
            return dict(row) if row else None

    def authenticate_admin(self, email: str, password: str) -> Optional[Dict]:
        """Authenticate admin user by email and password.

        Args:
            email: User email
            password: Plain text password

        Returns:
            User dict if authentication successful, None otherwise
        """
        user = self.get_admin_user(email=email)
        if not user:
            return None

        if not user.get('is_active'):
            return None

        password_hash = self._hash_password(password)
        if password_hash == user['password_hash']:
            # Update last login
            self._update_last_login(user['id'])
            return user

        return None

    def update_admin_user(self, user_id: str, **kwargs) -> bool:
        """Update admin user fields.

        Args:
            user_id: User ID
            **kwargs: Fields to update (email, name, role, is_active)

        Returns:
            True if update successful
        """
        allowed_fields = ['email', 'name', 'role', 'is_active']
        update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not update_fields:
            return False

        # Validate role if being updated
        if 'role' in update_fields:
            valid_roles = ['super_admin', 'admin', 'editor', 'viewer']
            if update_fields['role'] not in valid_roles:
                raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")

        set_clause = ', '.join([f"{k} = ?" for k in update_fields.keys()])
        values = list(update_fields.values()) + [user_id]

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'''
                UPDATE admin_users
                SET {set_clause}
                WHERE id = ?
            ''', values)
            return cursor.rowcount > 0

    def change_admin_password(self, user_id: str, new_password: str) -> bool:
        """Change admin user password.

        Args:
            user_id: User ID
            new_password: New plain text password

        Returns:
            True if password changed successfully
        """
        password_hash = self._hash_password(new_password)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE admin_users
                SET password_hash = ?
                WHERE id = ?
            ''', (password_hash, user_id))
            return cursor.rowcount > 0

    def list_admin_users(self, role: str = None, is_active: bool = None) -> List[Dict]:
        """List all admin users with optional filters.

        Args:
            role: Filter by role
            is_active: Filter by active status

        Returns:
            List of user dicts (excluding password_hash)
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = 'SELECT id, email, name, role, is_active, created_at, last_login FROM admin_users WHERE 1=1'
            params = []

            if role:
                query += ' AND role = ?'
                params.append(role)

            if is_active is not None:
                query += ' AND is_active = ?'
                params.append(1 if is_active else 0)

            query += ' ORDER BY created_at DESC'
            cursor.execute(query, params)

            return [dict(row) for row in cursor.fetchall()]

    def delete_admin_user(self, user_id: str) -> bool:
        """Soft delete admin user (set is_active = 0).

        Args:
            user_id: User ID

        Returns:
            True if deleted successfully
        """
        return self.update_admin_user(user_id, is_active=False)

    # ==================== Session Operations ====================

    def create_session(self, user_id: str, ip_address: str = None, user_agent: str = None,
                       expires_in_hours: int = 24) -> tuple[str, str]:
        """Create a new session for admin user.

        Args:
            user_id: User ID
            ip_address: Client IP address
            user_agent: Client user agent
            expires_in_hours: Session expiration in hours

        Returns:
            Tuple of (session_id, token)
        """
        session_id = str(uuid.uuid4())
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = (datetime.now() + timedelta(hours=expires_in_hours)).isoformat()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (session_id, user_id, token_hash, expires_at, ip_address, user_agent))

        return session_id, token

    def validate_session(self, token: str) -> Optional[Dict]:
        """Validate session token and return user data.

        Args:
            token: Session token

        Returns:
            User dict if session valid, None otherwise
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT s.*, u.email, u.name, u.role, u.is_active
                FROM admin_sessions s
                JOIN admin_users u ON s.user_id = u.id
                WHERE s.token_hash = ? AND s.expires_at > ?
            ''', (token_hash, datetime.now().isoformat()))

            row = cursor.fetchone()
            if not row:
                return None

            if not row['is_active']:
                return None

            return dict(row)

    def delete_session(self, token: str) -> bool:
        """Delete session (logout).

        Args:
            token: Session token

        Returns:
            True if session deleted
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM admin_sessions WHERE token_hash = ?', (token_hash,))
            return cursor.rowcount > 0

    def cleanup_expired_sessions(self) -> int:
        """Delete all expired sessions.

        Returns:
            Number of sessions deleted
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM admin_sessions WHERE expires_at <= ?',
                           (datetime.now().isoformat(),))
            return cursor.rowcount

    # ==================== Audit Log Operations ====================

    def log_restaurant_edit(self, restaurant_name: str, admin_user_id: str, edit_type: str,
                           restaurant_id: str = None, changes: Dict = None) -> str:
        """Log a restaurant edit action.

        Args:
            restaurant_name: Name of the restaurant
            admin_user_id: ID of admin who made the edit
            edit_type: One of: create, update, delete, approve, reject
            restaurant_id: Restaurant ID (if available)
            changes: Dict of changes made

        Returns:
            Edit log ID
        """
        valid_types = ['create', 'update', 'delete', 'approve', 'reject']
        if edit_type not in valid_types:
            raise ValueError(f"edit_type must be one of: {', '.join(valid_types)}")

        import json
        log_id = str(uuid.uuid4())
        changes_json = json.dumps(changes) if changes else None

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO restaurant_edits (id, restaurant_name, restaurant_id, admin_user_id, edit_type, changes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (log_id, restaurant_name, restaurant_id, admin_user_id, edit_type, changes_json))

        return log_id

    def get_restaurant_edit_history(self, restaurant_id: str = None, admin_user_id: str = None,
                                    limit: int = 50) -> List[Dict]:
        """Get edit history for a restaurant or admin user.

        Args:
            restaurant_id: Filter by restaurant
            admin_user_id: Filter by admin user
            limit: Max number of records

        Returns:
            List of edit log dicts
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = '''
                SELECT e.*, u.email as admin_email, u.name as admin_name
                FROM restaurant_edits e
                JOIN admin_users u ON e.admin_user_id = u.id
                WHERE 1=1
            '''
            params = []

            if restaurant_id:
                query += ' AND e.restaurant_id = ?'
                params.append(restaurant_id)

            if admin_user_id:
                query += ' AND e.admin_user_id = ?'
                params.append(admin_user_id)

            query += ' ORDER BY e.timestamp DESC LIMIT ?'
            params.append(limit)

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    # ==================== Settings Operations ====================

    def get_setting(self, key: str) -> Optional[str]:
        """Get a system setting value.

        Args:
            key: Setting key

        Returns:
            Setting value or None
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
            row = cursor.fetchone()
            return row['value'] if row else None

    def set_setting(self, key: str, value: str, updated_by: str = None) -> bool:
        """Set a system setting value.

        Args:
            key: Setting key
            value: Setting value
            updated_by: Admin user ID who made the change

        Returns:
            True if setting saved
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO settings (key, value, updated_by, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_by = excluded.updated_by,
                    updated_at = CURRENT_TIMESTAMP
            ''', (key, value, updated_by))
            return cursor.rowcount > 0

    def get_all_settings(self) -> Dict[str, str]:
        """Get all system settings as a dict.

        Returns:
            Dict of key-value pairs
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT key, value FROM settings')
            return {row['key']: row['value'] for row in cursor.fetchall()}

    # ==================== Private Helper Methods ====================

    def _hash_password(self, password: str) -> str:
        """Hash a password using SHA-256.

        Args:
            password: Plain text password

        Returns:
            Hashed password
        """
        return hashlib.sha256(password.encode()).hexdigest()

    def _update_last_login(self, user_id: str):
        """Update user's last login timestamp."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE admin_users
                SET last_login = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (user_id,))
