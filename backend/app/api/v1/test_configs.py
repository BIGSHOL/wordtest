"""Test configuration management endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.test_config import (
    CreateTestConfigRequest,
    UpdateTestConfigRequest,
    TestConfigResponse,
)
from app.core.deps import CurrentTeacher, CurrentUser
from app.models.test_config import TestConfig
from app.services.test_config import generate_test_code

router = APIRouter(prefix="/test-configs", tags=["test-configs"])


@router.get("", response_model=list[TestConfigResponse])
async def list_test_configs(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all test configs for the current teacher."""
    query = (
        select(TestConfig)
        .where(TestConfig.teacher_id == teacher.id)
        .order_by(TestConfig.created_at.desc())
    )
    result = await db.execute(query)
    configs = result.scalars().all()
    return [
        TestConfigResponse(
            id=c.id,
            teacher_id=c.teacher_id,
            name=c.name,
            test_code=c.test_code,
            test_type=c.test_type,
            question_count=c.question_count,
            time_limit_seconds=c.time_limit_seconds,
            is_active=c.is_active,
            book_name=c.book_name,
            level_range_min=c.level_range_min,
            level_range_max=c.level_range_max,
            created_at=str(c.created_at),
            updated_at=str(c.updated_at),
        )
        for c in configs
    ]


@router.post("", response_model=TestConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_test_config(
    config_in: CreateTestConfigRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new test config (teacher only)."""
    test_code = await generate_test_code(db)

    new_config = TestConfig(
        teacher_id=teacher.id,
        name=config_in.name,
        test_code=test_code,
        test_type=config_in.test_type,
        question_count=config_in.question_count,
        time_limit_seconds=config_in.time_limit_seconds,
        is_active=config_in.is_active,
        book_name=config_in.book_name,
        level_range_min=config_in.level_range_min,
        level_range_max=config_in.level_range_max,
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)

    return TestConfigResponse(
        id=new_config.id,
        teacher_id=new_config.teacher_id,
        name=new_config.name,
        test_code=new_config.test_code,
        test_type=new_config.test_type,
        question_count=new_config.question_count,
        time_limit_seconds=new_config.time_limit_seconds,
        is_active=new_config.is_active,
        book_name=new_config.book_name,
        level_range_min=new_config.level_range_min,
        level_range_max=new_config.level_range_max,
        created_at=str(new_config.created_at),
        updated_at=str(new_config.updated_at),
    )


@router.patch("/{config_id}", response_model=TestConfigResponse)
async def update_test_config(
    config_id: str,
    config_in: UpdateTestConfigRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a test config (teacher only, own configs)."""
    result = await db.execute(select(TestConfig).where(TestConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found",
        )

    # Verify ownership
    if config.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own test configs",
        )

    # Update fields if provided
    update_data = config_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)

    return TestConfigResponse(
        id=config.id,
        teacher_id=config.teacher_id,
        name=config.name,
        test_code=config.test_code,
        test_type=config.test_type,
        question_count=config.question_count,
        time_limit_seconds=config.time_limit_seconds,
        is_active=config.is_active,
        book_name=config.book_name,
        level_range_min=config.level_range_min,
        level_range_max=config.level_range_max,
        created_at=str(config.created_at),
        updated_at=str(config.updated_at),
    )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_config(
    config_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a test config (teacher only, own configs)."""
    result = await db.execute(select(TestConfig).where(TestConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found",
        )

    # Verify ownership
    if config.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own test configs",
        )

    await db.delete(config)
    await db.commit()
    return None


@router.get("/code/{code}", response_model=TestConfigResponse)
async def get_config_by_code(
    code: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Look up a test config by its 6-digit code (any authenticated user)."""
    result = await db.execute(
        select(TestConfig).where(
            TestConfig.test_code == code.upper(),
            TestConfig.is_active == True,
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found or inactive",
        )

    return TestConfigResponse(
        id=config.id,
        teacher_id=config.teacher_id,
        name=config.name,
        test_code=config.test_code,
        test_type=config.test_type,
        question_count=config.question_count,
        time_limit_seconds=config.time_limit_seconds,
        is_active=config.is_active,
        book_name=config.book_name,
        level_range_min=config.level_range_min,
        level_range_max=config.level_range_max,
        created_at=str(config.created_at),
        updated_at=str(config.updated_at),
    )
