import hashlib
import re

class TextUtils:
    """
    Utilities for processing and normalizing text for the Ingestion Agent.
    """

    @staticmethod
    def generate_content_hash(title: str, abstract: str) -> str:
        """
        Generates a unique SHA-256 hash for a paper based on its title and abstract.
        Normalizes text (lowercase, alphanumeric only) to ensure consistency.
        """
        # Combine and normalize
        text = f"{title or ''}{abstract or ''}".lower()
        # Remove all non-alphanumeric characters for robust comparison
        clean_text = re.sub(r'[^a-z0-9]', '', text)
        
        return hashlib.sha256(clean_text.encode()).hexdigest()
