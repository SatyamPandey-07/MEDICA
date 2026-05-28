"""
MEDICA Swappable LLM Factory Pattern
Provides a unified interface to call and stream from Gemini, OpenAI, Anthropic, and Groq.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Any, Optional

from core.config import settings, LLMProvider
from core.logging import get_logger

logger = get_logger(__name__)


class LLMClient(ABC):
    """Abstract base class for all LLM providers, ensuring a unified client interface."""

    def __init__(self, api_key: str, model_name: str) -> None:
        self.api_key = api_key
        self.model_name = model_name

    @abstractmethod
    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Non-streaming generation."""
        ...

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming generation yielding text chunks."""
        ...


class GeminiClient(LLMClient):
    """Google Gemini Client wrapper."""

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> str:
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        
        # Incorporate system instruction if provided
        config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=config,
            system_instruction=system_prompt,
        )

        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ["user", "system"] else "model"
            contents.append({"role": role, "parts": [msg["content"]]})

        # Run synchronously in an async wrapper since genai blocks slightly
        response = model.generate_content(contents)
        return response.text.strip()

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        
        config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=config,
            system_instruction=system_prompt,
        )

        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ["user", "system"] else "model"
            contents.append({"role": role, "parts": [msg["content"]]})

        response = model.generate_content(contents, stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text


class OpenAIClient(LLMClient):
    """OpenAI GPT-4o Client wrapper."""

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key)

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            role = m["role"] if m["role"] != "model" else "assistant"
            formatted_messages.append({"role": role, "content": m["content"]})

        response = await client.chat.completions.create(
            model=self.model_name,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key)

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            role = m["role"] if m["role"] != "model" else "assistant"
            formatted_messages.append({"role": role, "content": m["content"]})

        response = await client.chat.completions.create(
            model=self.model_name,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content


class AnthropicClient(LLMClient):
    """Anthropic Claude Client wrapper."""

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> str:
        import anthropic
        client = anthropic.Anthropic(api_key=self.api_key)

        # Anthropic messages must not include system prompt, and must alternate roles
        user_messages = []
        for m in messages:
            if m["role"] == "system":
                continue
            role = m["role"] if m["role"] != "model" else "assistant"
            user_messages.append({"role": role, "content": m["content"]})

        response = client.messages.create(
            model=self.model_name,
            system=system_prompt or "",
            max_tokens=max_tokens,
            temperature=temperature,
            messages=user_messages,
        )
        return response.content[0].text.strip()

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        import anthropic
        # Using anthropic's standard sync stream inside async generator
        client = anthropic.Anthropic(api_key=self.api_key)

        user_messages = []
        for m in messages:
            if m["role"] == "system":
                continue
            role = m["role"] if m["role"] != "model" else "assistant"
            user_messages.append({"role": role, "content": m["content"]})

        with client.messages.stream(
            model=self.model_name,
            system=system_prompt or "",
            max_tokens=max_tokens,
            temperature=temperature,
            messages=user_messages,
        ) as stream:
            for text in stream.text_stream:
                yield text


class GroqClient(LLMClient):
    """Groq (Llama-3) Client wrapper using OpenAI compatibility."""

    async def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1",
        )

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            role = m["role"] if m["role"] != "model" else "assistant"
            formatted_messages.append({"role": role, "content": m["content"]})

        response = await client.chat.completions.create(
            model=self.model_name,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1",
        )

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            role = m["role"] if m["role"] != "model" else "assistant"
            formatted_messages.append({"role": role, "content": m["content"]})

        response = await client.chat.completions.create(
            model=self.model_name,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content


class LLMFactory:
    """Factory to retrieve the active LLM client based on configuration and provide failovers."""

    @staticmethod
    def get_client(
        provider: Optional[LLMProvider] = None,
        custom_model: Optional[str] = None,
    ) -> LLMClient:
        """Retrieves the unified client for the active or requested LLM provider."""
        active_provider = provider or settings.llm_provider
        
        if active_provider == LLMProvider.GEMINI:
            model = custom_model or settings.gemini_model
            return GeminiClient(api_key=settings.gemini_api_key, model_name=model)
            
        elif active_provider == LLMProvider.OPENAI:
            model = custom_model or settings.openai_model
            return OpenAIClient(api_key=settings.openai_api_key, model_name=model)
            
        elif active_provider == LLMProvider.ANTHROPIC:
            model = custom_model or settings.anthropic_model
            return AnthropicClient(api_key=settings.anthropic_api_key, model_name=model)
            
        elif active_provider == LLMProvider.GROQ:
            model = custom_model or settings.groq_model
            return GroqClient(api_key=settings.groq_api_key, model_name=model)
            
        else:
            raise ValueError(f"Unknown LLM Provider configured: {active_provider}")

    @staticmethod
    def get_fallback_client() -> Optional[LLMClient]:
        """Creates a client using the configured fallback parameters."""
        if not settings.fallback_llm_provider:
            return None
            
        provider = settings.fallback_llm_provider
        if provider == LLMProvider.GEMINI:
            return GeminiClient(api_key=settings.gemini_api_key, model_name=settings.fallback_gemini_model)
        elif provider == LLMProvider.OPENAI:
            return OpenAIClient(api_key=settings.openai_api_key, model_name=settings.fallback_openai_model)
        elif provider == LLMProvider.ANTHROPIC:
            return AnthropicClient(api_key=settings.anthropic_api_key, model_name=settings.fallback_anthropic_model)
        elif provider == LLMProvider.GROQ:
            return GroqClient(api_key=settings.groq_api_key, model_name=settings.fallback_groq_model)
            
        return None
