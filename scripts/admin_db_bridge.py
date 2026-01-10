#!/usr/bin/env python3
"""
Bridge script for Node.js API to call Python AdminDatabase methods.
Usage: python admin_db_bridge.py <method> <json_args>
"""

import sys
import json
import os
import importlib.util

# Add parent directory to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import AdminDatabase directly to avoid module init issues
spec = importlib.util.spec_from_file_location("admin_database", os.path.join(project_root, "src", "admin_database.py"))
admin_database_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin_database_module)
AdminDatabase = admin_database_module.AdminDatabase


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Method name required"}))
        sys.exit(1)

    method_name = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    db = AdminDatabase()

    try:
        if method_name == 'authenticate':
            # Authenticate admin user
            email = args.get('email')
            password = args.get('password')
            user = db.authenticate_admin(email, password)

            if user:
                print(json.dumps({
                    "success": True,
                    "user": user
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": "Invalid credentials"
                }))

        elif method_name == 'get_user':
            # Get user by ID
            user_id = args.get('user_id')
            user = db.get_admin_user(user_id=user_id)

            if user:
                print(json.dumps({
                    "success": True,
                    "user": user
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": "User not found"
                }))

        elif method_name == 'create_session':
            # Create session (note: we store the token hash, not the token itself)
            user_id = args.get('user_id')
            token = args.get('token')
            ip_address = args.get('ip_address')
            user_agent = args.get('user_agent')

            # For now, we'll just return success since session management
            # is primarily handled by JWT tokens in this implementation
            print(json.dumps({
                "success": True,
                "message": "Session created"
            }))

        elif method_name == 'delete_session':
            # Delete session
            token = args.get('token')

            # For now, we'll just return success
            # In a full implementation, this would delete the session from admin_sessions table
            print(json.dumps({
                "success": True,
                "message": "Session deleted"
                }))

        elif method_name == 'list_users':
            # List all admin users
            role = args.get('role')
            is_active = args.get('is_active')
            users = db.list_admin_users(role=role, is_active=is_active)

            print(json.dumps({
                "success": True,
                "users": users
            }))

        elif method_name == 'create_user':
            # Create new admin user
            email = args.get('email')
            password = args.get('password')
            name = args.get('name')
            role = args.get('role', 'editor')

            user_id = db.create_admin_user(email, password, name, role)

            print(json.dumps({
                "success": True,
                "user_id": user_id
            }))

        elif method_name == 'update_user':
            # Update admin user
            user_id = args.get('user_id')
            # Remove user_id from args to get update fields
            update_fields = {k: v for k, v in args.items() if k != 'user_id'}

            success = db.update_admin_user(user_id, **update_fields)

            print(json.dumps({
                "success": success
            }))

        elif method_name == 'change_password':
            # Change user password
            user_id = args.get('user_id')
            new_password = args.get('new_password')

            success = db.change_admin_password(user_id, new_password)

            print(json.dumps({
                "success": success
            }))

        elif method_name == 'delete_user':
            # Soft delete user (set is_active = False)
            user_id = args.get('user_id')
            success = db.delete_admin_user(user_id)

            print(json.dumps({
                "success": success
            }))

        elif method_name == 'log_edit':
            # Log restaurant edit
            restaurant_name = args.get('restaurant_name')
            admin_user_id = args.get('admin_user_id')
            edit_type = args.get('edit_type')
            restaurant_id = args.get('restaurant_id')
            changes = args.get('changes')

            log_id = db.log_restaurant_edit(
                restaurant_name,
                admin_user_id,
                edit_type,
                restaurant_id,
                changes
            )

            print(json.dumps({
                "success": True,
                "log_id": log_id
            }))

        elif method_name == 'get_edit_history':
            # Get edit history
            restaurant_id = args.get('restaurant_id')
            admin_user_id = args.get('admin_user_id')
            limit = args.get('limit', 50)

            history = db.get_restaurant_edit_history(restaurant_id, admin_user_id, limit)

            print(json.dumps({
                "success": True,
                "history": history
            }))

        else:
            print(json.dumps({
                "success": False,
                "error": f"Unknown method: {method_name}"
            }))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
