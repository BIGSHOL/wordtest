"""Word management endpoints."""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.word import (
    CreateWordRequest,
    UpdateWordRequest,
    WordResponse,
    WordListResponse,
)
from app.core.deps import CurrentUser, CurrentTeacher
from app.models.word import Word

router = APIRouter(prefix="/words", tags=["words"])


@router.get("", response_model=WordListResponse)
async def list_words(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    level: Optional[int] = Query(None),
    book_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List words with optional filters."""
    # Build query
    query = select(Word)

    # Apply filters
    conditions = []
    if level is not None:
        conditions.append(Word.level == level)
    if book_name:
        conditions.append(Word.book_name == book_name)
    if search:
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                Word.english.ilike(search_pattern),
                Word.korean.ilike(search_pattern),
            )
        )

    if conditions:
        query = query.where(*conditions)

    # Get total count
    count_query = select(func.count()).select_from(Word)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(Word.level, Word.english)
    result = await db.execute(query)
    words = result.scalars().all()

    return WordListResponse(
        words=[WordResponse.model_validate(w) for w in words],
        total=total,
    )


@router.post("", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
async def create_word(
    word_in: CreateWordRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new word (teacher only)."""
    new_word = Word(
        english=word_in.english,
        korean=word_in.korean,
        level=word_in.level,
        category=word_in.category,
        book_name=word_in.book_name or "",
        lesson=word_in.lesson or "",
        part_of_speech=word_in.part_of_speech,
        example_en=word_in.example_en,
        example_ko=word_in.example_ko,
    )
    db.add(new_word)
    await db.commit()
    await db.refresh(new_word)
    return WordResponse.model_validate(new_word)


@router.patch("/{word_id}", response_model=WordResponse)
async def update_word(
    word_id: str,
    word_in: UpdateWordRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a word (teacher only)."""
    result = await db.execute(select(Word).where(Word.id == word_id))
    word = result.scalar_one_or_none()

    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found",
        )

    # Update fields if provided
    update_data = word_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(word, field, value)

    await db.commit()
    await db.refresh(word)
    return WordResponse.model_validate(word)


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_word(
    word_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a word (teacher only)."""
    result = await db.execute(select(Word).where(Word.id == word_id))
    word = result.scalar_one_or_none()

    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found",
        )

    await db.delete(word)
    await db.commit()
    return None
