"""Admin API endpoints."""

import os
import json
import uuid
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Depends, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from models.auth import LoginRequest, TokenResponse, UserInfo
from models.restaurant import Restaurant, PaginatedRestaurants, Pagination

# Import hallucination detector
try:
    from hallucination_detector import HallucinationDetector, filter_hallucinations
    HALLUCINATION_DETECTOR_AVAILABLE = True
except ImportError:
    HALLUCINATION_DETECTOR_AVAILABLE = False
    print("[Warning] Hallucination detector not available")

router = APIRouter(prefix="/api/admin", tags=["Admin"])
security = HTTPBearer(auto_error=False)

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Data paths - respect DATABASE_DIR env var for Railway volumes
_db_dir_env = os.getenv("DATABASE_DIR")
DATA_DIR = Path(_db_dir_env) if _db_dir_env else Path(__file__).parent.parent.parent / "data"
RESTAURANTS_DIR = DATA_DIR / "restaurants"
ADMIN_DB_PATH = DATA_DIR / "admin_users.json"


def load_admin_users() -> dict:
    """Load admin users from JSON file."""
    if ADMIN_DB_PATH.exists():
        with open(ADMIN_DB_PATH, "r") as f:
            return json.load(f)
    return {"users": []}


def save_admin_users(data: dict):
    """Save admin users to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(ADMIN_DB_PATH, "w") as f:
        json.dump(data, f, indent=2)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    expire = datetime.now() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Get current authenticated user from JWT token."""
    token = None

    # Try to get token from Authorization header
    if credentials:
        token = credentials.credentials

    # Try to get token from cookie
    if not token:
        token = request.cookies.get("where2eat_admin_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Get user from database
        admin_data = load_admin_users()
        user = next((u for u in admin_data["users"] if u["id"] == user_id), None)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(allowed_roles: List[str]):
    """Dependency to require specific roles."""
    async def check_role(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return check_role


# Auth endpoints
class SetupRequest(BaseModel):
    """First-run setup request."""
    email: str
    password: str
    name: str = "Admin"


@router.post(
    "/auth/setup",
    response_model=TokenResponse,
    summary="First-run admin setup",
    description="Create the initial admin user. Only works when no admin users exist.",
)
async def setup_admin(request: SetupRequest, response: Response):
    """Create the first admin user. Disabled after first use."""
    admin_data = load_admin_users()
    if admin_data.get("users"):
        raise HTTPException(status_code=403, detail="Setup already completed")

    user_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    user = {
        "id": user_id,
        "email": request.email,
        "name": request.name,
        "role": "super_admin",
        "password_hash": get_password_hash(request.password),
        "is_active": True,
        "created_at": now,
    }
    admin_data["users"] = [user]
    save_admin_users(admin_data)

    token = create_access_token({
        "user_id": user_id,
        "email": request.email,
        "role": "super_admin",
    })

    response.set_cookie(
        key="where2eat_admin_token",
        value=token,
        httponly=True,
        secure=os.getenv("NODE_ENV") == "production",
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )

    return TokenResponse(
        token=token,
        user=UserInfo(
            id=user_id,
            email=request.email,
            name=request.name,
            role="super_admin",
            is_active=True,
            created_at=now,
        ),
    )


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Admin login",
    description="Authenticate admin user and get JWT token.",
)
async def login(request: LoginRequest, response: Response):
    """Admin login."""
    admin_data = load_admin_users()
    user = next(
        (u for u in admin_data["users"] if u["email"] == request.email),
        None
    )

    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Update last login
    user["last_login"] = datetime.now().isoformat()
    save_admin_users(admin_data)

    # Create token
    token = create_access_token({
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
    })

    # Set cookie
    response.set_cookie(
        key="where2eat_admin_token",
        value=token,
        httponly=True,
        secure=os.getenv("NODE_ENV") == "production",
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )

    return TokenResponse(
        token=token,
        user=UserInfo(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            is_active=user.get("is_active", True),
            created_at=user.get("created_at"),
            last_login=user.get("last_login"),
        ),
    )


@router.post(
    "/auth/logout",
    summary="Admin logout",
    description="Logout and invalidate session.",
)
async def logout(response: Response, user: dict = Depends(get_current_user)):
    """Admin logout."""
    response.delete_cookie("where2eat_admin_token")
    return {"message": "Logged out successfully"}


@router.get(
    "/auth/me",
    response_model=UserInfo,
    summary="Get current user",
    description="Get currently authenticated user info.",
)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user info."""
    return UserInfo(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        is_active=user.get("is_active", True),
        created_at=user.get("created_at"),
        last_login=user.get("last_login"),
    )


@router.post(
    "/auth/refresh",
    summary="Refresh token",
    description="Refresh JWT token.",
)
async def refresh_token(response: Response, user: dict = Depends(get_current_user)):
    """Refresh JWT token."""
    token = create_access_token({
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
    })

    response.set_cookie(
        key="where2eat_admin_token",
        value=token,
        httponly=True,
        secure=os.getenv("NODE_ENV") == "production",
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )

    return {"token": token}


# Restaurant admin endpoints
def load_all_restaurants() -> List[dict]:
    """Load all restaurants from JSON files."""
    RESTAURANTS_DIR.mkdir(parents=True, exist_ok=True)
    restaurants = []
    for file_path in RESTAURANTS_DIR.glob("*.json"):
        if file_path.name == ".gitkeep":
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                restaurants.append(json.load(f))
        except Exception as e:
            print(f"Warning: Failed to read {file_path}: {e}")
    return restaurants


@router.get(
    "/restaurants",
    response_model=PaginatedRestaurants,
    summary="List restaurants (admin)",
    description="Get paginated list of restaurants with admin filters.",
)
async def list_restaurants_admin(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    sort: str = Query("-created_at"),
    search: Optional[str] = Query(None),
    filter_status: Optional[str] = Query(None, alias="filter[status]"),
    filter_cuisine: Optional[str] = Query(None, alias="filter[cuisine]"),
    filter_city: Optional[str] = Query(None, alias="filter[city]"),
    user: dict = Depends(get_current_user),
):
    """List restaurants with admin filters."""
    restaurants = load_all_restaurants()

    # Apply filters
    if search:
        search_lower = search.lower()
        restaurants = [
            r for r in restaurants
            if search_lower in r.get("name_hebrew", "").lower()
            or search_lower in r.get("name_english", "").lower()
            or search_lower in r.get("location", {}).get("city", "").lower()
            or search_lower in r.get("cuisine_type", "").lower()
        ]

    if filter_status:
        restaurants = [r for r in restaurants if r.get("status") == filter_status]

    if filter_cuisine:
        restaurants = [r for r in restaurants if r.get("cuisine_type") == filter_cuisine]

    if filter_city:
        restaurants = [r for r in restaurants if r.get("location", {}).get("city") == filter_city]

    # Apply sorting
    sort_field = sort[1:] if sort.startswith("-") else sort
    sort_reverse = sort.startswith("-")

    def get_sort_value(r):
        if sort_field == "name":
            return r.get("name_hebrew", "")
        elif sort_field == "city":
            return r.get("location", {}).get("city", "")
        elif sort_field == "cuisine":
            return r.get("cuisine_type", "")
        else:  # created_at
            return r.get("created_at", "")

    restaurants.sort(key=get_sort_value, reverse=sort_reverse)

    # Apply pagination
    total = len(restaurants)
    start_index = (page - 1) * limit
    paginated = restaurants[start_index : start_index + limit]

    return PaginatedRestaurants(
        restaurants=paginated,
        pagination=Pagination(
            page=page,
            limit=limit,
            total=total,
            totalPages=(total + limit - 1) // limit,
        ),
    )


@router.get(
    "/restaurants/{restaurant_id}",
    response_model=Restaurant,
    summary="Get restaurant (admin)",
    description="Get single restaurant by ID.",
)
async def get_restaurant_admin(
    restaurant_id: str,
    user: dict = Depends(get_current_user),
):
    """Get restaurant by ID."""
    file_path = RESTAURANTS_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post(
    "/restaurants",
    response_model=Restaurant,
    status_code=201,
    summary="Create restaurant (admin)",
    description="Create a new restaurant. Requires editor role or higher.",
)
async def create_restaurant_admin(
    restaurant: Restaurant,
    user: dict = Depends(require_role(["editor", "admin", "super_admin"])),
):
    """Create a new restaurant."""
    RESTAURANTS_DIR.mkdir(parents=True, exist_ok=True)
    restaurant_id = restaurant.id or str(uuid.uuid4())
    file_path = RESTAURANTS_DIR / f"{restaurant_id}.json"

    restaurant_data = restaurant.model_dump()
    restaurant_data["id"] = restaurant_id
    restaurant_data["created_at"] = datetime.now().isoformat()
    restaurant_data["updated_at"] = datetime.now().isoformat()

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(restaurant_data, f, ensure_ascii=False, indent=2)

    return restaurant_data


@router.put(
    "/restaurants/{restaurant_id}",
    response_model=Restaurant,
    summary="Update restaurant (admin)",
    description="Update a restaurant. Requires editor role or higher.",
)
async def update_restaurant_admin(
    restaurant_id: str,
    restaurant: Restaurant,
    user: dict = Depends(require_role(["editor", "admin", "super_admin"])),
):
    """Update a restaurant."""
    file_path = RESTAURANTS_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Load existing to preserve created_at
    with open(file_path, "r", encoding="utf-8") as f:
        existing = json.load(f)

    restaurant_data = restaurant.model_dump(exclude_unset=True)
    restaurant_data["id"] = restaurant_id
    restaurant_data["updated_at"] = datetime.now().isoformat()
    restaurant_data["created_at"] = existing.get("created_at")

    existing.update(restaurant_data)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    return existing


@router.delete(
    "/restaurants/{restaurant_id}",
    summary="Delete restaurant (admin)",
    description="Delete a restaurant. Requires admin role or higher.",
)
async def delete_restaurant_admin(
    restaurant_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Delete a restaurant."""
    file_path = RESTAURANTS_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    file_path.unlink()
    return {"message": "Restaurant deleted successfully"}


@router.get(
    "/restaurants/{restaurant_id}/history",
    summary="Get restaurant edit history",
    description="Get edit history for a restaurant.",
)
async def get_restaurant_history(
    restaurant_id: str,
    user: dict = Depends(get_current_user),
):
    """Get restaurant edit history."""
    # Mock response - would be replaced with actual history tracking
    return {
        "history": [
            {
                "id": "1",
                "restaurant_id": restaurant_id,
                "admin_email": user["email"],
                "admin_name": user["name"],
                "edit_type": "update",
                "changes": {"price_range": {"old": "budget", "new": "mid-range"}},
                "timestamp": datetime.now().isoformat(),
            }
        ]
    }


# ==================== Verification Report Endpoints ====================

@router.get(
    "/verification/report",
    summary="Get hallucination verification report",
    description="Get a detailed report of restaurant extraction verification results.",
)
async def get_verification_report(
    user: dict = Depends(get_current_user),
):
    """Get hallucination verification report for all restaurants."""
    if not HALLUCINATION_DETECTOR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Hallucination detector not available"
        )

    restaurants = load_all_restaurants()
    detector = HallucinationDetector(strict_mode=False)

    report = {
        "generated_at": datetime.now().isoformat(),
        "total": len(restaurants),
        "summary": {
            "accepted": 0,
            "rejected": 0,
            "needs_review": 0
        },
        "restaurants": []
    }

    for restaurant in restaurants:
        result = detector.detect(restaurant)

        restaurant_report = {
            "id": restaurant.get("id", restaurant.get("name_english", "")),
            "name_hebrew": restaurant.get("name_hebrew", ""),
            "name_english": restaurant.get("name_english", ""),
            "google_name": restaurant.get("google_places", {}).get("google_name", ""),
            "city": restaurant.get("location", {}).get("city", ""),
            "cuisine_type": restaurant.get("cuisine_type", ""),
            "verification": {
                "is_hallucination": result.is_hallucination,
                "confidence": result.confidence,
                "recommendation": result.recommendation,
                "reasons": result.reasons
            },
            "episode_info": {
                "video_id": restaurant.get("episode_info", {}).get("video_id", ""),
                "video_url": restaurant.get("episode_info", {}).get("video_url", ""),
                "analysis_date": restaurant.get("episode_info", {}).get("analysis_date", "")
            },
            "mention_context": restaurant.get("mention_context", ""),
            "host_comments": restaurant.get("host_comments", ""),
            "data_completeness": {
                "has_location": bool(restaurant.get("location", {}).get("city")),
                "has_cuisine": bool(restaurant.get("cuisine_type") and restaurant.get("cuisine_type") != "לא צוין"),
                "has_google_data": bool(restaurant.get("google_places", {}).get("google_name")),
                "has_photos": bool(restaurant.get("photos")),
                "has_rating": bool(restaurant.get("rating", {}).get("google_rating"))
            }
        }

        report["restaurants"].append(restaurant_report)

        if result.recommendation == "accept":
            report["summary"]["accepted"] += 1
        elif result.recommendation == "reject":
            report["summary"]["rejected"] += 1
        else:
            report["summary"]["needs_review"] += 1

    # Sort by confidence (highest hallucination confidence first)
    report["restaurants"].sort(
        key=lambda r: r["verification"]["confidence"],
        reverse=True
    )

    return report


@router.post(
    "/verification/revalidate",
    summary="Revalidate all restaurants",
    description="Run hallucination detection on all restaurants and update their status.",
)
async def revalidate_restaurants(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Revalidate all restaurants with hallucination detection."""
    if not HALLUCINATION_DETECTOR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Hallucination detector not available"
        )

    restaurants = load_all_restaurants()
    accepted, rejected, needs_review = filter_hallucinations(restaurants, strict_mode=True)

    return {
        "message": "Validation complete",
        "results": {
            "total": len(restaurants),
            "accepted": len(accepted),
            "rejected": len(rejected),
            "needs_review": len(needs_review)
        },
        "rejected_names": [r.get("name_hebrew", "") for r in rejected]
    }


@router.get(
    "/verification/restaurant/{restaurant_id}",
    summary="Get verification details for a restaurant",
    description="Get detailed hallucination detection results for a specific restaurant.",
)
async def get_restaurant_verification(
    restaurant_id: str,
    user: dict = Depends(get_current_user),
):
    """Get verification details for a specific restaurant."""
    if not HALLUCINATION_DETECTOR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Hallucination detector not available"
        )

    file_path = RESTAURANTS_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        # Try to find by searching all restaurants
        restaurants = load_all_restaurants()
        restaurant = next(
            (r for r in restaurants if r.get("name_english", "").lower().replace(" ", "_") == restaurant_id.lower()),
            None
        )
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            restaurant = json.load(f)

    detector = HallucinationDetector(strict_mode=False)
    result = detector.detect(restaurant)

    return {
        "restaurant": {
            "name_hebrew": restaurant.get("name_hebrew", ""),
            "name_english": restaurant.get("name_english", ""),
            "google_name": restaurant.get("google_places", {}).get("google_name", ""),
            "city": restaurant.get("location", {}).get("city", ""),
        },
        "verification": {
            "is_hallucination": result.is_hallucination,
            "confidence": result.confidence,
            "recommendation": result.recommendation,
            "reasons": result.reasons
        },
        "details": {
            "mention_context": restaurant.get("mention_context", ""),
            "host_comments": restaurant.get("host_comments", ""),
            "episode_video_id": restaurant.get("episode_info", {}).get("video_id", ""),
            "analysis_date": restaurant.get("episode_info", {}).get("analysis_date", "")
        }
    }
