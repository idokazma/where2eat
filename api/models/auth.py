"""Pydantic models for authentication."""

from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token response after login."""
    token: str
    user: "UserInfo"


class UserInfo(BaseModel):
    """Public user information."""
    id: str
    email: str
    name: str
    role: str
    is_active: Optional[bool] = True
    created_at: Optional[str] = None
    last_login: Optional[str] = None


class TokenData(BaseModel):
    """Data extracted from JWT token."""
    user_id: str
    email: str
    role: str


TokenResponse.model_rebuild()
