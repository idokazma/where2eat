"""
LLM Configuration for Restaurant Analysis
Manages OpenAI and Claude API configurations
"""

import os
from typing import Literal, Optional
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

LLMProvider = Literal["openai", "claude"]

@dataclass
class LLMConfig:
    """Configuration for LLM providers"""

    # Provider selection
    provider: LLMProvider = "claude"
    
    # OpenAI configuration
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.1
    openai_max_tokens: int = 4000
    
    # Claude configuration
    claude_api_key: Optional[str] = None
    claude_model: str = "claude-sonnet-4-20250514"
    claude_temperature: float = 0.1
    claude_max_tokens: int = 8192  # Increased to handle large transcript analyses
    
    # Analysis configuration
    chunk_size: int = 100000  # Increased for better context
    chunk_overlap: int = 2000
    enable_chunking: bool = True
    
    @classmethod
    def from_env(cls) -> 'LLMConfig':
        """Create configuration from environment variables"""
        
        # Get provider from env (default: claude)
        provider = os.getenv("LLM_PROVIDER", "claude").lower()
        if provider not in ["openai", "claude"]:
            provider = "claude"
        
        return cls(
            provider=provider,
            
            # OpenAI settings
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            openai_temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.1")),
            openai_max_tokens=int(os.getenv("OPENAI_MAX_TOKENS", "4000")),
            
            # Claude settings
            claude_api_key=os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY"),
            claude_model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
            claude_temperature=float(os.getenv("CLAUDE_TEMPERATURE", "0.1")),
            claude_max_tokens=int(os.getenv("CLAUDE_MAX_TOKENS", "8192")),
            
            # Analysis settings
            chunk_size=int(os.getenv("TRANSCRIPT_CHUNK_SIZE", "100000")),
            chunk_overlap=int(os.getenv("TRANSCRIPT_CHUNK_OVERLAP", "2000")),
            enable_chunking=os.getenv("ENABLE_CHUNKING", "true").lower() == "true"
        )
    
    def validate(self) -> None:
        """Validate configuration and raise errors if invalid"""
        if self.provider == "openai":
            if not self.openai_api_key:
                raise ValueError(
                    "OpenAI API key not found. Set OPENAI_API_KEY environment variable."
                )
        elif self.provider == "claude":
            if not self.claude_api_key:
                raise ValueError(
                    "Claude API key not found. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable."
                )
        else:
            raise ValueError(f"Invalid LLM provider: {self.provider}. Must be 'openai' or 'claude'.")
    
    def get_active_model(self) -> str:
        """Get the model name for the active provider"""
        if self.provider == "openai":
            return self.openai_model
        else:
            return self.claude_model
    
    def get_active_api_key(self) -> str:
        """Get the API key for the active provider"""
        if self.provider == "openai":
            return self.openai_api_key
        else:
            return self.claude_api_key
    
    def get_active_temperature(self) -> float:
        """Get the temperature for the active provider"""
        if self.provider == "openai":
            return self.openai_temperature
        else:
            return self.claude_temperature
    
    def get_active_max_tokens(self) -> int:
        """Get the max tokens for the active provider"""
        if self.provider == "openai":
            return self.openai_max_tokens
        else:
            return self.claude_max_tokens

# Global configuration instance
_config: Optional[LLMConfig] = None

def get_config() -> LLMConfig:
    """Get the global LLM configuration"""
    global _config
    if _config is None:
        _config = LLMConfig.from_env()
        _config.validate()
    return _config

def set_config(config: LLMConfig) -> None:
    """Set the global LLM configuration"""
    global _config
    config.validate()
    _config = config

def get_provider() -> LLMProvider:
    """Get the active LLM provider"""
    return get_config().provider