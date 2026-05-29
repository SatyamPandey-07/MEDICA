import asyncio
import time
from typing import Dict, Tuple, Any, Optional
from ingestion_agent.app.utils.logger import logger

class TokenBucket:
    """
    A Token Bucket rate limiter that manages pacing of requests.
    Supports asynchronous waiting to acquire tokens.
    """
    def __init__(self, capacity: float, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = capacity
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        """Asynchronously waits until a token is available to consume."""
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self.last_update
                self.last_update = now
                
                # Refill tokens
                self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
                
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return
                
                # Calculate sleep duration to get 1 token
                needed = 1.0 - self.tokens
                sleep_time = needed / self.refill_rate
                await asyncio.sleep(sleep_time)

    def slow_down(self, multiplier: float = 0.5):
        """Reduces the refill rate (increases wait time) to dynamically adapt to 429s."""
        # Don't go slower than 1 token per 60 seconds
        min_rate = 1.0 / 60.0
        old_rate = self.refill_rate
        self.refill_rate = max(min_rate, self.refill_rate * multiplier)
        if old_rate != self.refill_rate:
            logger.warning(f"Dynamically slowed down TokenBucket to {1.0/self.refill_rate:.2f}s per request.")

class CircuitBreaker:
    """
    A stateful Circuit Breaker that transitions between CLOSED, OPEN, and HALF_OPEN.
    Automatically recovers after a designated cooldown period.
    """
    def __init__(self, failure_threshold: int = 2, cooldown_duration: float = 300.0):
        self.failure_threshold = failure_threshold
        self.cooldown_duration = cooldown_duration  # seconds
        
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.failure_count = 0
        self.cooldown_until: Optional[float] = None
        self._lock = asyncio.Lock()

    async def allow_request(self) -> bool:
        """
        Determines whether a request is allowed.
        If in OPEN state and cooldown elapsed, transitions to HALF_OPEN.
        """
        async with self._lock:
            now = time.monotonic()
            if self.state == "OPEN":
                if self.cooldown_until and now >= self.cooldown_until:
                    logger.info(f"Circuit Breaker cooldown elapsed. Transitioning from OPEN to HALF_OPEN.")
                    self.state = "HALF_OPEN"
                    return True
                return False
            return True

    async def record_success(self):
        """Records a successful API call, resetting the state to CLOSED."""
        async with self._lock:
            if self.state != "CLOSED":
                logger.info(f"Circuit Breaker successfully recovered. Transitioning from {self.state} to CLOSED.")
            self.state = "CLOSED"
            self.failure_count = 0
            self.cooldown_until = None

    async def record_failure(self):
        """Records an API failure. Trips the circuit if threshold exceeded."""
        async with self._lock:
            self.failure_count += 1
            if self.state == "HALF_OPEN" or self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                self.cooldown_until = time.monotonic() + self.cooldown_duration
                logger.warning(
                    f"Circuit Breaker tripped to OPEN. Failure count: {self.failure_count}. "
                    f"Blocked for next {self.cooldown_duration}s."
                )

class QueryCache:
    """
    Simple in-memory Query Cache to avoid redundant API queries.
    """
    def __init__(self, ttl: float = 600.0):
        self.ttl = ttl  # seconds
        self.cache: Dict[Tuple[str, str], Tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, source: str, query: str) -> Optional[Any]:
        async with self._lock:
            key = (source, query)
            if key in self.cache:
                timestamp, data = self.cache[key]
                if time.monotonic() - timestamp <= self.ttl:
                    return data
                # Expired
                del self.cache[key]
            return None

    async def set(self, source: str, query: str, data: Any):
        async with self._lock:
            self.cache[(source, query)] = (time.monotonic(), data)

class RateGovernor:
    """
    Central Coordinator managing Rate Limiters, Circuit Breakers, caches, and semaphores
    for all oncology discovery sources.
    """
    def __init__(self):
        # 1. Semaphores for strict serialization
        self.semaphores: Dict[str, asyncio.Semaphore] = {
            "arxiv": asyncio.Semaphore(1),
            "semanticscholar": asyncio.Semaphore(1),
            "clinicaltrials": asyncio.Semaphore(1),
        }
        
        # 2. Token Buckets (capacity, refill_rate in tokens/second)
        # Note: refill_rate = 1 / target_delay
        self.buckets: Dict[str, TokenBucket] = {
            "arxiv": TokenBucket(capacity=1.0, refill_rate=1.0 / 5.0),            # Max 1 req per 5.0s (safe buffer above 3s)
            "semanticscholar_public": TokenBucket(capacity=1.0, refill_rate=1.0 / 4.0), # Max 1 req per 4.0s (safe public tier)
            "semanticscholar_key": TokenBucket(capacity=10.0, refill_rate=10.0),        # Max 10 req/s (partner API key tier)
            "clinicaltrials": TokenBucket(capacity=3.0, refill_rate=3.0),          # Max 3 req/s
            "pubmed_public": TokenBucket(capacity=3.0, refill_rate=3.0),           # Max 3 req/s
            "pubmed_key": TokenBucket(capacity=10.0, refill_rate=10.0),            # Max 10 req/s
            "openalex": TokenBucket(capacity=2.0, refill_rate=2.0),                # Max 2 req/s
            "core": TokenBucket(capacity=2.0, refill_rate=2.0),                    # Max 2 req/s
            "europepmc": TokenBucket(capacity=3.0, refill_rate=3.0),               # Max 3 req/s
            "crossref": TokenBucket(capacity=3.0, refill_rate=3.0),                # Max 3 req/s
            "doaj": TokenBucket(capacity=2.0, refill_rate=2.0),                    # Max 2 req/s
        }
        
        # 3. Stateful Circuit Breakers
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        
        # 4. In-memory Query Cache
        self.cache = QueryCache(ttl=600.0)  # 10 minutes cache TTL

    def _get_bucket(self, source: str, has_key: bool = False) -> TokenBucket:
        if source == "semanticscholar":
            return self.buckets["semanticscholar_key"] if has_key else self.buckets["semanticscholar_public"]
        elif source == "pubmed":
            return self.buckets["pubmed_key"] if has_key else self.buckets["pubmed_public"]
        return self.buckets.get(source, TokenBucket(capacity=2.0, refill_rate=2.0))

    def _get_breaker(self, source: str) -> CircuitBreaker:
        if source not in self.circuit_breakers:
            # We want strict blocking, trip on 2 failures, cooldown 5 mins
            self.circuit_breakers[source] = CircuitBreaker(failure_threshold=2, cooldown_duration=300.0)
        return self.circuit_breakers[source]

    async def acquire(self, source: str, query: str, has_key: bool = False) -> bool:
        """
        Asynchronously acquires rate-limiting tokens and concurrency semaphores.
        Checks the circuit breaker. Returns True if request is allowed, False if blocked.
        """
        breaker = self._get_breaker(source)
        if not await breaker.allow_request():
            logger.warning(f"Request to '{source}' blocked because the Circuit Breaker is OPEN.")
            return False

        # Acquire serialization semaphore if registered
        if source in self.semaphores:
            await self.semaphores[source].acquire()
            
        # Acquire token pacing limit
        bucket = self._get_bucket(source, has_key)
        await bucket.acquire()
        
        return True

    def release_semaphore(self, source: str):
        """Releases the serialization semaphore for sequential resources."""
        if source in self.semaphores:
            try:
                self.semaphores[source].release()
            except ValueError:
                pass

    async def record_success(self, source: str):
        """Records a successful operation on the source."""
        breaker = self._get_breaker(source)
        await breaker.record_success()

    async def record_failure(self, source: str):
        """Records a failure on the source, potentially tripping it."""
        breaker = self._get_breaker(source)
        await breaker.record_failure()

    async def slow_down(self, source: str, has_key: bool = False, multiplier: float = 0.5):
        """Slows down the pacing for a specific source to avoid further 429s."""
        bucket = self._get_bucket(source, has_key)
        logger.warning(f"Slowing down rate limits for source '{source}'")
        bucket.slow_down(multiplier)

# Global singleton
rate_governor = RateGovernor()
