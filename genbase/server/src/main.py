"""
FastAPI main application file
"""
import os
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from alembic.config import Config as AlembicConfig
from alembic import command
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from src.routers import models
from src.routers import chat
from src.routers import code
from src.routers import workspaces
from src.routers import variables

from .database import get_db
from .config import config
from .logger import logger
from src.routers import projects, groups, operations
from src.routers import agents  # Import the new agent router
# Initialize FastAPI app
app = FastAPI(
    title=config.APP_NAME,
    description=config.APP_DESCRIPTION,
    version=config.APP_VERSION,
    root_path=config.API_PREFIX,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)









# Include routers
app.include_router(projects.router)
app.include_router(groups.router)
app.include_router(operations.router)
app.include_router(variables.router)
app.include_router(workspaces.router)
app.include_router(code.router)
app.include_router(chat.router)
app.include_router(agents.router)  # Register the new agent router
app.include_router(models.router)  # Add this line




def run_migrations():
    """Run database migrations using Alembic"""
    try:
        logger.info("Running database migrations...")
        # Get the directory of the current file
        current_dir = Path(__file__).parent.parent
        alembic_ini_path = current_dir / "alembic.ini"
        
        if not alembic_ini_path.exists():
            logger.error(f"Alembic config not found at {alembic_ini_path}")
            raise FileNotFoundError(f"Alembic config not found at {alembic_ini_path}")
        
        # Create Alembic config
        alembic_cfg = AlembicConfig(str(alembic_ini_path))
        
        # Run the migrations
        command.upgrade(alembic_cfg, "head")
        logger.success("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Error running database migrations: {str(e)}")
        raise


@app.on_event("startup")
async def startup_event():
    """
    Execute tasks on application startup
    """
    logger.info(f"Starting {config.APP_NAME} v{config.APP_VERSION}")
    # Run database migrations
    run_migrations()
    
    logger.info("Application startup complete")


@app.get("/")
async def root():
    """Root endpoint"""
    logger.debug("Root endpoint called")
    return {"message": f"Welcome to {config.APP_NAME}"}


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    """Health check endpoint with database connection test"""
    logger.debug("Health check endpoint called")
    try:
        # Try to execute a simple query to check database connection
        db.execute(text("SELECT 1"))
        logger.debug("Database connection successful")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return {"status": "unhealthy", "database": str(e)}


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server directly")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)