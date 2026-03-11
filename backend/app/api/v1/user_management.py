"""User management endpoints (master only)."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentMaster
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.user_management import (
    CreateUserRequest,
    ResetPasswordResponse,
    UpdateUserRequest,
    UserDetailResponse,
    UserDetailSessionItem,
    UserListResponse,
    UserWithActivityResponse,
)
from app.services.user_management import (
    create_any_user,
    generate_temp_password,
    get_user_detail,
    list_all_users_with_activity,
    update_any_user,
)

router = APIRouter(prefix="/user-management", tags=["user-management"])


@router.get("", response_model=UserListResponse)
async def list_users_endpoint(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    """List all users with activity stats (master only)."""
    users, total = await list_all_users_with_activity(
        db,
        page=page,
        page_size=page_size,
        search=search,
        role_filter=role,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    user_responses = [UserWithActivityResponse(**u) for u in users]
    return UserListResponse(
        users=user_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user_detail_endpoint(
    user_id: str,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get user detail with full session history (master only)."""
    detail = await get_user_detail(db, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )

    user_resp = UserWithActivityResponse(**detail["user"])
    session_items = [UserDetailSessionItem(**s) for s in detail["sessions"]]
    return UserDetailResponse(user=user_resp, sessions=session_items)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    user_in: CreateUserRequest,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a user of any role (master only)."""
    # Check username uniqueness
    existing = await db.execute(
        select(User).where(User.username == user_in.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다",
        )

    # Check email uniqueness if provided
    if user_in.email:
        existing_email = await db.execute(
            select(User).where(User.email == user_in.email)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용 중인 이메일입니다",
            )

    user = await create_any_user(
        db,
        username=user_in.username,
        password=user_in.password,
        name=user_in.name,
        role=user_in.role,
        email=user_in.email,
        phone_number=user_in.phone_number,
        school_name=user_in.school_name,
        grade=user_in.grade,
        teacher_id=user_in.teacher_id,
    )
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user_endpoint(
    user_id: str,
    user_in: UpdateUserRequest,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a user (master only). Prevent self role change."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )

    # Prevent master from changing their own role
    if user_id == master.id and user_in.role is not None and user_in.role != master.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자신의 권한은 변경할 수 없습니다",
        )

    updated = await update_any_user(
        db,
        user,
        name=user_in.name,
        email=user_in.email,
        password=user_in.password,
        phone_number=user_in.phone_number,
        school_name=user_in.school_name,
        grade=user_in.grade,
        role=user_in.role,
        teacher_id=user_in.teacher_id,
    )
    return updated


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_endpoint(
    user_id: str,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a user (master only). Prevent self-delete."""
    if user_id == master.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자신의 계정은 삭제할 수 없습니다",
        )

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )

    await db.delete(user)
    await db.commit()
    return None


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password_endpoint(
    user_id: str,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate and set a temporary password for a user (master only)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )

    temp_password = generate_temp_password()
    await update_any_user(db, user, password=temp_password)
    return ResetPasswordResponse(temporary_password=temp_password)
