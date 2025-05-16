"""
Simple console logging configuration using Loguru
"""
import sys
import os
from loguru import logger as loguru_logger


# Configure loguru
def setup_logging():
    """Setup and configure Loguru console logging"""
    # Get log level from environment variable or use INFO as default
    log_level = os.getenv("LOG_LEVEL", "INFO")
    
    # Remove default logger
    loguru_logger.remove()

    # Standard format for console logging
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )

    # Add console handler
    loguru_logger.add(
        sys.stderr,
        format=log_format,
        level=log_level,
        colorize=True,
        backtrace=True,  # Detailed exception information
        diagnose=True,   # Show variables in exceptions
    )

    return loguru_logger


# Create and configure logger
logger = setup_logging()
