# genbase/server/src/services/model_service.py

"""
Model service for getting available LLM models based on configured API keys
"""
import os
from typing import List, Dict
from ..logger import logger


class ModelService:
    """
    Service for managing available LLM models based on environment API keys
    """
    
    # Map of API keys to their supported models
    MODEL_MAPPING = {
        "OPENAI_API_KEY": [
            # Latest models
            "gpt-4.1",
            "gpt-4.1-mini", 
            "gpt-4.1-nano",
            "o4-mini",
            "o3-mini",
            "o3",
            "o1-mini",
            "o1-preview",
            # GPT-4o series
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4o-mini-2024-07-18",
            "gpt-4o-2024-08-06",
            "gpt-4o-2024-05-13",
            # GPT-4 series
            "gpt-4-turbo",
            "gpt-4-turbo-preview",
            "gpt-4-0125-preview",
            "gpt-4-1106-preview",
            "gpt-4",
            "gpt-4-0314",
            "gpt-4-0613",
            "gpt-4-32k",
            "gpt-4-32k-0314",
            "gpt-4-32k-0613",
            # GPT-3.5 series
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-1106",
            "gpt-3.5-turbo-0301",
            "gpt-3.5-turbo-0613",
            "gpt-3.5-turbo-16k",
            "gpt-3.5-turbo-16k-0613"
        ],
        "ANTHROPIC_API_KEY": [
            # Claude 4 series
            "claude-opus-4-20250514",
            "claude-sonnet-4-20250514",
            # Claude 3.7 series
            "claude-3.7",
            "claude-3-7-sonnet-20250219",
            # Claude 3.5 series
            "claude-3.5",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-haiku-20241022",
            # Claude 3 series
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307"
        ],
        "GEMINI_API_KEY": [
            "gemini/gemini-pro",
            "gemini/gemini-1.5-pro-latest",
            "gemini/gemini-2.0-flash",
            "gemini/gemini-2.0-flash-exp",
            "gemini/gemini-2.0-flash-lite-preview-02-05",
            "gemini/gemini-1.5-pro",
            "gemini/gemini-1.5-flash",
            "gemini/gemini-1.5-flash-8b",
            "gemini/gemini-pro-vision"
        ],
        "XAI_API_KEY": [
            "xai/grok-3-mini-beta",
            "xai/grok-2-vision-latest",
            "xai/grok-beta",
            "xai/grok-vision-beta"
        ],
        "GROQ_API_KEY": [
            "groq/llama-3.1-8b-instant",
            "groq/llama-3.1-70b-versatile",
            "groq/llama3-8b-8192",
            "groq/llama3-70b-8192",
            "groq/llama2-70b-4096",
            "groq/mixtral-8x7b-32768",
            "groq/gemma-7b-it",
            "groq/llama-3.2-11b-vision-preview",
            "groq/whisper-large-v3"
        ],
        "MISTRAL_API_KEY": [
            "mistral/mistral-small-latest",
            "mistral/mistral-medium-latest",
            "mistral/mistral-large-2407",
            "mistral/mistral-large-latest",
            "mistral/open-mistral-7b",
            "mistral/open-mixtral-8x7b",
            "mistral/open-mixtral-8x22b",
            "mistral/codestral-latest",
            "mistral/open-mistral-nemo",
            "mistral/open-mistral-nemo-2407",
            "mistral/open-codestral-mamba",
            "mistral/codestral-mamba-latest"
        ],
        "CODESTRAL_API_KEY": [
            "text-completion-codestral/codestral-latest",
            "text-completion-codestral/codestral-2405"
        ],
        "FIREWORKS_AI_API_KEY": [
            "fireworks_ai/llama-v3p2-1b-instruct",
            "fireworks_ai/llama-v3p2-3b-instruct",
            "fireworks_ai/llama-v3p2-11b-vision-instruct",
            "fireworks_ai/llama-v3p2-90b-vision-instruct",
            "fireworks_ai/mixtral-8x7b-instruct",
            "fireworks_ai/firefunction-v1",
            "fireworks_ai/llama-v2-70b-chat"
        ],
        "LLAMA_API_KEY": [
            "meta_llama/Llama-4-Scout-17B-16E-Instruct-FP8",
            "meta_llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            "meta_llama/Llama-3.3-70B-Instruct",
            "meta_llama/Llama-3.3-8B-Instruct"
        ]
    }
    
    # Models that require multiple environment variables
    MULTI_ENV_MODELS = {
        # Azure OpenAI requires multiple env vars
        ("AZURE_API_KEY", "AZURE_API_BASE", "AZURE_API_VERSION"): [
            "azure/gpt-4o",
            "azure/gpt-4o-mini",
            "azure/gpt-4-turbo",
            "azure/gpt-4",
            "azure/gpt-4-0314",
            "azure/gpt-4-0613",
            "azure/gpt-4-32k",
            "azure/gpt-4-32k-0314",
            "azure/gpt-4-32k-0613",
            "azure/gpt-4-1106-preview",
            "azure/gpt-4-0125-preview",
            "azure/gpt-3.5-turbo",
            "azure/gpt-3.5-turbo-0301",
            "azure/gpt-3.5-turbo-0613",
            "azure/gpt-3.5-turbo-16k",
            "azure/gpt-3.5-turbo-16k-0613",
            "azure/o1-mini",
            "azure/o1-preview"
        ],
        # AWS Sagemaker requires multiple env vars
        ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION_NAME"): [
            "sagemaker/jumpstart-dft-meta-textgeneration-llama-2-70b",
            "sagemaker/jumpstart-dft-meta-textgeneration-llama-2-70b-b-f"
        ]
    }
    
    @staticmethod
    def get_available_models() -> List[str]:
        """
        Get list of available models based on configured API keys
        
        Returns:
            List of available model names
        """
        try:
            available_models = []
            
            # Check single API key models
            for api_key_name, models in ModelService.MODEL_MAPPING.items():
                if os.getenv(api_key_name):
                    available_models.extend(models)
                    logger.debug(f"Found {api_key_name}, added {len(models)} models")
            
            # Check multi-environment variable models
            for env_keys, models in ModelService.MULTI_ENV_MODELS.items():
                if all(os.getenv(key) for key in env_keys):
                    available_models.extend(models)
                    logger.debug(f"Found all required keys {env_keys}, added {len(models)} models")
            
            # Remove duplicates while preserving order
            seen = set()
            unique_models = []
            for model in available_models:
                if model not in seen:
                    seen.add(model)
                    unique_models.append(model)
            
            configured_providers = len([k for k in ModelService.MODEL_MAPPING.keys() if os.getenv(k)])
            configured_multi_providers = len([keys for keys in ModelService.MULTI_ENV_MODELS.keys() if all(os.getenv(key) for key in keys)])
            
            logger.info(f"Found {len(unique_models)} available models from {configured_providers + configured_multi_providers} configured providers")
            
            # Return default models if no API keys are configured
            if not unique_models:
                logger.warning("No API keys configured, returning default models")
                return [
                    "gpt-4o",
                    "claude-3-5-sonnet-20241022"
                ]
            
            return unique_models
            
        except Exception as e:
            logger.error(f"Error getting available models: {str(e)}")
            # Return default models as fallback
            return [
                "gpt-4o",
                "claude-3-5-sonnet-20241022"
            ]
    
    @staticmethod
    def get_provider_info() -> Dict[str, Dict]:
        """
        Get information about configured providers
        
        Returns:
            Dictionary with provider information
        """
        provider_info = {}
        
        # Single API key providers
        for api_key_name, models in ModelService.MODEL_MAPPING.items():
            is_configured = bool(os.getenv(api_key_name))
            provider_name = api_key_name.replace("_API_KEY", "").lower()
            
            provider_info[provider_name] = {
                "configured": is_configured,
                "model_count": len(models) if is_configured else 0,
                "models": models if is_configured else []
            }
        
        # Multi-environment variable providers
        for env_keys, models in ModelService.MULTI_ENV_MODELS.items():
            is_configured = all(os.getenv(key) for key in env_keys)
            # Use first key as provider name identifier
            provider_name = env_keys[0].split("_")[0].lower()
            
            provider_info[provider_name] = {
                "configured": is_configured,
                "model_count": len(models) if is_configured else 0,
                "models": models if is_configured else [],
                "required_env_vars": list(env_keys)
            }
        
        return provider_info