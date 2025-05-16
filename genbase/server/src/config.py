"""
Application configuration
"""
import os
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config(BaseModel):
    """
    Application settings
    """
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Application settings
    APP_NAME: str = "Genbase API"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "Genbase API Server"
    
    # API settings
    API_PREFIX: str = os.getenv("API_PREFIX", "/api/v1")

    BASE_DIR: str = '/root/development/genbase-project/genbase/test'

    CORS_ORIGINS: List[str] = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,https://console.genbase.io").split(",")]



# Create settings instance
config = Config()