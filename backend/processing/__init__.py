"""MEDICA processing package."""
from processing.linker import EntityLinker
from processing.normalizer import Normalizer
from processing.tagger import Tagger

__all__ = ["Normalizer", "Tagger", "EntityLinker"]
