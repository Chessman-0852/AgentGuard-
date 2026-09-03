# agentguard/api/main.py
import logging
import os
from contextlib import asynccontextmanager

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agentguard.config import load_policy, setup_sighup_reload
from agentguard.database import init_db

load_dotenv()

# Configure structlog — JSON output, ISO timestamps, INFO level
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("AgentGuard starting up")
    init_db()
    load_policy()
    setup_sighup_reload()
    logger.info("Startup complete — policy loaded, DB initialized")
    yield
    logger.info("AgentGuard shutting down")


app = FastAPI(
    title="AgentGuard",
    description="Agentic Commerce Trust & Policy Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # Demo: allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from agentguard.api.routes.intents import router as intents_router
from agentguard.api.routes.audit import router as audit_router
from agentguard.api.routes.webhooks import router as webhooks_router

app.include_router(intents_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(webhooks_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "agentguard"}
