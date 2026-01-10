#!/usr/bin/env python3
"""
Seed script to create default admin user for Where2Eat admin dashboard.
"""

import sys
import os

# Add parent directory to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import directly to avoid module init issues
import importlib.util
spec = importlib.util.spec_from_file_location("admin_database", os.path.join(project_root, "src", "admin_database.py"))
admin_database_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin_database_module)
AdminDatabase = admin_database_module.AdminDatabase


def seed_admin_user():
    """Create default super admin user."""
    db = AdminDatabase()

    # Default credentials
    email = "admin@where2eat.com"
    password = "admin123"  # Change this in production!
    name = "Super Admin"
    role = "super_admin"

    # Check if admin already exists
    existing_user = db.get_admin_user(email=email)
    if existing_user:
        print(f"✓ Admin user already exists: {email}")
        print(f"  ID: {existing_user['id']}")
        print(f"  Role: {existing_user['role']}")
        return

    # Create admin user
    try:
        user_id = db.create_admin_user(
            email=email,
            password=password,
            name=name,
            role=role
        )
        print(f"✓ Created super admin user:")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        print(f"  Name: {name}")
        print(f"  Role: {role}")
        print(f"  ID: {user_id}")
        print("\n⚠️  IMPORTANT: Change the password after first login!")
    except Exception as e:
        print(f"✗ Error creating admin user: {e}")
        sys.exit(1)


if __name__ == "__main__":
    seed_admin_user()
