from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import Conversation, Document, Message, get_db
from app.services.question_answering.qa_service import Citation, QAService, RetrievedPassage

router = APIRouter(prefix="/documents", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    reasoning: str
    citations: List[Citation]
    uncertainty: str
    passages: List[RetrievedPassage]


class MessageItem(BaseModel):
    id: str
    role: str
    content: str
    citations: List[Dict[str, Any]] = []
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[MessageItem] = []


@router.post("/{document_id}/chat", response_model=ChatResponse)
async def chat_with_document(
    document_id: str,
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Retrieve or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.document_id == document_id
        ).first()

    if not conv:
        # Check if an existing conversation exists or make a new one
        conv = db.query(Conversation).filter(
            Conversation.document_id == document_id
        ).order_by(Conversation.created_at.desc()).first()

        if not conv:
            conv = Conversation(document_id=document_id)
            db.add(conv)
            db.commit()
            db.refresh(conv)

    # Gather history
    history_messages = [
        {"role": m.role, "content": m.content}
        for m in conv.messages
    ]

    # Run QA Service
    qa_service = QAService()
    qa_response = await qa_service.answer(
        question=payload.question,
        doc_id=document_id,
        conversation_history=history_messages
    )

    # Save user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.question,
        citations=[]
    )
    db.add(user_msg)

    # Save assistant message
    citations_data = [c.model_dump() for c in qa_response.citations]
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=qa_response.answer,
        citations=citations_data
    )
    db.add(assistant_msg)
    db.commit()

    return ChatResponse(
        conversation_id=conv.id,
        answer=qa_response.answer,
        reasoning=qa_response.reasoning,
        citations=qa_response.citations,
        uncertainty=qa_response.uncertainty,
        passages=qa_response.passages
    )


@router.get("/{document_id}/chat/history", response_model=ChatHistoryResponse)
def get_chat_history(
    document_id: str,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    conv = (
        db.query(Conversation)
        .filter(Conversation.document_id == document_id)
        .order_by(Conversation.created_at.desc())
        .first()
    )

    if not conv:
        return ChatHistoryResponse(conversation_id=None, messages=[])

    messages = [
        MessageItem(
            id=m.id,
            role=m.role,
            content=m.content,
            citations=m.citations or [],
            created_at=m.created_at
        )
        for m in conv.messages
    ]

    return ChatHistoryResponse(
        conversation_id=conv.id,
        messages=messages
    )
