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
    EngineAuditResponse,
    EngineAuditRefreshResponse,
    EngineCoverage,
    ProblemWord,
)
from app.core.deps import CurrentUser, CurrentTeacher
from app.models.word import Word
from app.services.question_engines import ENGINES, compute_compatible_engines

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


@router.get("/books", response_model=list[str])
async def list_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """Return distinct book names."""
    result = await db.execute(
        select(Word.book_name)
        .where(Word.book_name.isnot(None), Word.book_name != "")
        .distinct()
        .order_by(Word.book_name)
    )
    return [row[0] for row in result.all()]


@router.get("/lessons")
async def list_lessons(
    book_name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """Return distinct lessons with word count for a given book."""
    result = await db.execute(
        select(Word.lesson, func.count().label("word_count"))
        .where(Word.book_name == book_name, Word.lesson != "")
        .group_by(Word.lesson)
        .order_by(Word.lesson)
    )
    return [{"lesson": row[0], "word_count": row[1]} for row in result.all()]


@router.get("/count-range")
async def count_words_in_range(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
    book_start: str = Query(...),
    book_end: str = Query(...),
    lesson_start: str = Query(""),
    lesson_end: str = Query(""),
):
    """Count words in a book/lesson range (supports cross-book)."""
    from sqlalchemy import and_ as sa_and

    is_cross_book = book_start != book_end

    if is_cross_book:
        query = select(func.count()).select_from(Word).where(
            Word.is_excluded == False,
            or_(
                sa_and(Word.book_name == book_start, Word.lesson >= lesson_start) if lesson_start else (Word.book_name == book_start),
                sa_and(Word.book_name > book_start, Word.book_name < book_end),
                sa_and(Word.book_name == book_end, Word.lesson <= lesson_end) if lesson_end else (Word.book_name == book_end),
            ),
        )
    else:
        conditions = [Word.book_name == book_start, Word.is_excluded == False]
        if lesson_start:
            conditions.append(Word.lesson >= lesson_start)
        if lesson_end:
            conditions.append(Word.lesson <= lesson_end)
        query = select(func.count()).select_from(Word).where(*conditions)

    result = await db.execute(query)
    count = result.scalar() or 0
    return {"count": count}


@router.get("/engine-audit", response_model=EngineAuditResponse)
async def engine_audit(
    db: Annotated[AsyncSession, Depends(get_db)],
    teacher: CurrentTeacher,
):
    """Return engine compatibility audit report based on stored compatible_engines."""
    result = await db.execute(select(Word).where(Word.is_excluded == False))
    words = result.scalars().all()

    total = len(words)
    engine_names = list(ENGINES.keys())

    # Count per-engine coverage
    counts: dict[str, int] = {name: 0 for name in engine_names}
    problem_words: list[ProblemWord] = []
    unmapped = 0

    for w in words:
        if not w.compatible_engines:
            unmapped += 1
            continue

        engines = [e.strip() for e in w.compatible_engines.split(",") if e.strip()]
        for name in engines:
            if name in counts:
                counts[name] += 1

        if len(engines) <= 2:
            # Determine issue
            issues = []
            if not w.korean:
                issues.append("korean 누락")
            if not w.example_en:
                issues.append("example_en 누락")
            issue = ", ".join(issues) if issues else f"엔진 {len(engines)}개만 호환"

            problem_words.append(ProblemWord(
                id=w.id,
                english=w.english,
                korean=w.korean or "",
                compatible_engines=engines,
                issue=issue,
            ))

    engine_coverage = {
        name: EngineCoverage(
            count=counts[name],
            pct=round(counts[name] / total * 100, 1) if total else 0,
        )
        for name in engine_names
    }

    return EngineAuditResponse(
        total_words=total,
        engine_coverage=engine_coverage,
        problem_words=problem_words,
        unmapped_count=unmapped,
    )


@router.post("/engine-audit/refresh", response_model=EngineAuditRefreshResponse)
async def engine_audit_refresh(
    db: Annotated[AsyncSession, Depends(get_db)],
    teacher: CurrentTeacher,
):
    """Recompute compatible_engines for all words and update DB."""
    result = await db.execute(select(Word))
    words = result.scalars().all()

    engine_names = list(ENGINES.keys())
    counts: dict[str, int] = {name: 0 for name in engine_names}
    updated = 0

    for w in words:
        engines = compute_compatible_engines(w)
        new_value = ",".join(engines)
        if w.compatible_engines != new_value:
            w.compatible_engines = new_value
            updated += 1
        for name in engines:
            if name in counts:
                counts[name] += 1

    await db.commit()

    total = len(words)
    engine_coverage = {
        name: EngineCoverage(
            count=counts[name],
            pct=round(counts[name] / total * 100, 1) if total else 0,
        )
        for name in engine_names
    }

    return EngineAuditRefreshResponse(
        updated_count=updated,
        total_words=total,
        engine_coverage=engine_coverage,
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
