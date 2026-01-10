#!/usr/bin/env python3
"""
Simple seed script to create default admin user for Where2Eat admin dashboard.
This version avoids module import issues by directly executing database operations.
"""

import os
import sys
import sqlite3
import hashlib
import uuid
from datetime import datetime

# Get database path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(project_root, 'data', 'where2eat.db')

print(f"Database path: {db_path}")

# Ensure database file exists
os.makedirs(os.path.dirname(db_path), exist_ok=True)

# Connect to database
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    # Check if admin_users table exists, create if not
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'editor', 'viewer')),
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT
        )
    """)

    # Create index
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)')

    # Default credentials
    email = "admin@where2eat.com"
    password = "admin123"
    name = "Super Admin"
    role = "super_admin"

    # Check if admin already exists
    cursor.execute('SELECT * FROM admin_users WHERE email = ?', (email,))
    existing_user = cursor.fetchone()

    if existing_user:
        print(f"✓ Admin user already exists:")
        print(f"  Email: {email}")
        print(f"  ID: {existing_user['id']}")
        print(f"  Role: {existing_user['role']}")
    else:
        # Create new admin user
        user_id = str(uuid.uuid4())
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        cursor.execute('''
            INSERT INTO admin_users (id, email, password_hash, name, role)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, email, password_hash, name, role))

        conn.commit()

        print(f"✓ Created super admin user:")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        print(f"  Name: {name}")
        print(f"  Role: {role}")
        print(f"  ID: {user_id}")
        print("\n⚠️  IMPORTANT: Change the password after first login!")

except Exception as e:
    print(f"✗ Error creating admin user: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    conn.close()
