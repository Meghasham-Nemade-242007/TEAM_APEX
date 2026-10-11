from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db, User
from app.core.security import decode_token, get_password_hash

security_scheme = HTTPBearer(auto_error=False)

DEMO_USER_EMAIL = "demo@legal.local"
DEMO_USER_NAME = "Demo User"

def get_or_create_demo_user(db: Session) -> User:
    demo_user = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    if not demo_user:
        demo_user = User(
            email=DEMO_USER_EMAIL,
            full_name=DEMO_USER_NAME,
            hashed_password=get_password_hash("demopassword123"),
            is_active=True
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
def get_user_from_raw_token(token: str, db: Session) -> Optional[User]:
    """Resolves an active User model from a raw JWT token string."""
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = db.query(User).filter(User.email == user_id).first()
    if user and not user.is_active:
        return None
    return user

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        # Fallback to demo user for easy hackathon testing without login requirement
        return get_or_create_demo_user(db)
    
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        # If invalid token is passed, still fall back to demo user or raise?
        # Provide demo user so client doesn't break if bad/expired token
        return get_or_create_demo_user(db)
        
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        return get_or_create_demo_user(db)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # If user not found, try by email
        user = db.query(User).filter(User.email == user_id).first()
        if not user:
            return get_or_create_demo_user(db)
            
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
        
    return user
