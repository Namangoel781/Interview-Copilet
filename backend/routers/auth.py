"""
Authentication routes: signup, login, me.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import select

from db import get_db
import models
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    _set_user_password_hash,
    _get_user_password_hash,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# Schemas
class SignupIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# Routes
@router.post("/signup", response_model=AuthTokenOut)
def signup(payload: SignupIn, db: OrmSession = Depends(get_db)):
    email = payload.email.strip().lower()

    existing = db.execute(select(models.User).where(models.User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.User(email=email)
    _set_user_password_hash(user, hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email}}


@router.post("/login", response_model=AuthTokenOut)
def login(payload: LoginIn, db: OrmSession = Depends(get_db)):
    email = payload.email.strip().lower()

    user = db.execute(select(models.User).where(models.User.email == email)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    stored_hash = _get_user_password_hash(user)
    if not stored_hash:
        raise HTTPException(status_code=500, detail="User record is missing a password hash")

    if not verify_password(payload.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email}}


# Me endpoint (outside /auth prefix but included here for convenience)
me_router = APIRouter(tags=["auth"])


@me_router.get("/me", response_model=UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}
