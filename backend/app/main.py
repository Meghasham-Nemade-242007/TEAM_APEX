from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import create_tables, SessionLocal, User
from app.core.security import get_password_hash
from app.api.v1.router import router
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Legal Document Analysis System",
    description="AI-powered court document review and analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_demo_user():
    """Create the demo user for hackathon demonstrations if it doesn't exist."""
    db = SessionLocal()
    try:
        demo_email = "demo@legal.local"
        existing = db.query(User).filter(User.email == demo_email).first()
        if not existing:
            demo_user = User(
                email=demo_email,
                full_name="Demo User",
                hashed_password=get_password_hash("demo1234"),
                is_active=True,
            )
            db.add(demo_user)
            db.commit()
            logger.info("Demo user created: demo@legal.local / demo1234")
        else:
            logger.info("Demo user already exists")
    except Exception as e:
        logger.error(f"Failed to seed demo user: {e}")
    finally:
        db.close()


@app.on_event("startup")
async def startup():
    create_tables()
    seed_demo_user()


app.include_router(router, prefix="/api")


@app.get("/api/health")
async def health():
    """Health check endpoint — also reports Gemini configuration status."""
    from app.services.llm.gemini import GeminiProvider
    provider = GeminiProvider()
    return {
        "status": "ok",
        "version": "1.0.0",
        "gemini_configured": provider.is_configured(),
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
    }
