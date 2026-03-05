"""Authentication endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import Token, LoginRequest, LoginResponse, RegisterRequest, RefreshRequest, PasswordChangeRequest
from app.schemas.user import UserResponse
from app.services.auth import (
    authenticate_user, create_user, get_user_by_username, update_password,
    create_auth_token, validate_refresh_token, revoke_refresh_token,
    get_user_by_invite_code,
)
from app.core.security import create_access_token, verify_password_async
from app.core.deps import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user."""
    existing_user = await get_user_by_username(db, user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다"
        )

    if user_in.invite_code:
        inviter = await get_user_by_invite_code(db, user_in.invite_code)
        if not inviter:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않은 초대 코드입니다"
            )

    user = await create_user(db, user_in)
    return user


@router.get("/invite-code/validate")
async def validate_invite_code(
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Validate an invite code and return the inviter's name."""
    inviter = await get_user_by_invite_code(db, code)
    if not inviter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="유효하지 않은 초대 코드입니다"
        )
    return {"valid": True, "inviter_name": inviter.name}



@router.post("/login/json", response_model=LoginResponse)
async def login_json(
    login_data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Login with JSON body and get access token + refresh token + user."""
    user = await authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 틀렸습니다",
        )

    access_token = create_access_token(subject=user.id)
    refresh_token = await create_auth_token(db, user.id)
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Refresh access token using a refresh token (with rotation)."""
    user_id = await validate_refresh_token(db, refresh_data.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Rotate: revoke old, issue new
    await revoke_refresh_token(db, refresh_data.refresh_token)
    access_token = create_access_token(subject=user_id)
    new_refresh_token = await create_auth_token(db, user_id)
    return Token(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout")
async def logout(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_data: RefreshRequest | None = None,
):
    """Logout — revoke the provided refresh token."""
    if refresh_data and refresh_data.refresh_token:
        await revoke_refresh_token(db, refresh_data.refresh_token)
    return {"message": "Successfully logged out"}


@router.post("/invite-code/regenerate")
async def regenerate_invite_code(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Regenerate the current user's invite code."""
    from app.models.user import _generate_invite_code
    current_user.invite_code = _generate_invite_code()
    await db.commit()
    await db.refresh(current_user)
    return {"invite_code": current_user.invite_code}


@router.post("/password/change")
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Change current user's password."""
    if not await verify_password_async(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    await update_password(db, current_user, password_data.new_password)
    return {"message": "Password changed successfully"}
