"""
MEDICA Oncology Research Agent
Autonomous ReAct agent that reasons, searches, retrieves, verifies, and compiles scientific oncology answers.
"""
from __future__ import annotations

import json
import re
from typing import AsyncGenerator, Dict, List, Any, Optional

from core.config import settings, LLMProvider
from core.logging import get_logger
from core.llm import LLMFactory
from agents.tools import (
    search_pubmed,
    retrieve_papers,
    read_knowledge_file,
    verify_claim,
    get_citations,
)

logger = get_logger(__name__)

# ReAct System Prompt
_AGENT_SYSTEM_PROMPT = """You are MEDICA's autonomous Oncology Research Librarian and Guarded Oncology Copilot.
Your mission is to answer research questions with absolute evidence-based clinical and molecular rigor.

You have access to the following tools:

1. `search_pubmed(query: str, limit: int = 5)`
   - Description: Search PubMed and actively ingest the latest oncology papers matching the query.
   - Use when: You need the latest trials or the local database does not have enough detail.
   - Arguments: `query` (scientific search terms), `limit` (max papers, 1 to 5).

2. `retrieve_papers(query: str, limit: int = 5)`
   - Description: Search the local MEDICA knowledge base (hybrid semantic/keyword/tag).
   - Use when: You want to query what is already indexed in MEDICA. Always check local papers first!
   - Arguments: `query` (search terms), `limit` (max results).

3. `read_knowledge_file(filepath: str)`
   - Description: Read the full structured markdown file for an ingested paper (including frontmatter and adversarial reviews).
   - Use when: You have a paper ID or file path and need to inspect details or clinical outcomes.
   - Arguments: `filepath` (e.g., "cancers/breast_cancer/papers/pmid_38123456.md").

4. `verify_claim(claim: str)`
   - Description: Run an adversarial claim verification check against all local literature.
   - Use when: Evaluating a specific therapeutic or prognostic claim to check for consensus vs. contradictions.
   - Arguments: `claim` (scientific statement).

5. `get_citations(pmid: str)`
   - Description: Fetch citation network (citing papers) for a specific PMID.
   - Use when: Checking follow-up trials or tracking citation density.
   - Arguments: `pmid` (PubMed ID string).

Core Instructions:
- NEVER fabricate clinical outcomes, p-values, or PMIDs.
- Cite your sources in brackets like [PMID: 38123456] or [DOI: 10.1200/JCO.23.00123].
- ALWAYS query the local database first using `retrieve_papers` before running `search_pubmed`.
- If you find a pivotal trial, read its knowledge file using `read_knowledge_file` to review its adversarial flags and methodology.
- Prioritize high evidence levels: Meta-analyses, Systematic Reviews, and RCTs over preclinical models.

ReAct Loop Format:
You MUST respond in this EXACT format in each step:

Thought: <reason about what to do next>
Action: <tool_name>
Action Input: <arguments for the tool, as raw string or JSON>

Then you will receive an Observation. Repeat this loop until you have enough evidence.
When you are ready to give the final answer, output:

Thought: I have sufficient clinical evidence. I will summarize the findings.
Final Answer: <your structured, rigorous clinical answer, citing PMIDs/DOIs, including treatment recommendations, molecular contexts, and methodological caveats>

Let's begin!
"""


class OncologyResearchAgent:
    """
    Autonomous ReAct agent for oncology intelligence.

    Coordinates tools to answer complex medical questions.
    Generates structured thoughts, triggers tools, observes results,
    and returns a fully cited response.
    """

    def __init__(self, max_steps: int = 5) -> None:
        self.max_steps = max_steps
        self.tools = {
            "search_pubmed": search_pubmed,
            "retrieve_papers": retrieve_papers,
            "read_knowledge_file": read_knowledge_file,
            "verify_claim": verify_claim,
            "get_citations": get_citations,
        }

    async def _call_llm(self, prompt: str, history: List[Dict[str, str]]) -> str:
        """Call the configured LLM provider and return response text."""
        # Setup system context
        messages = []
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": prompt})

        try:
            # Attempt active LLM client from the Factory
            client = LLMFactory.get_client()
            logger.info("agent_llm_factory_call", provider=settings.llm_provider, model=settings.active_llm_model)
            return await client.generate(
                messages=messages,
                temperature=0.1,
                max_tokens=2048,
                system_prompt=_AGENT_SYSTEM_PROMPT
            )
        except Exception as e:
            logger.warning("agent_llm_primary_failed", error=str(e), action="attempt_fallback")
            fallback_client = LLMFactory.get_fallback_client()
            if fallback_client:
                logger.info(
                    "agent_llm_fallback_call",
                    provider=settings.fallback_llm_provider,
                    model=fallback_client.model_name
                )
                try:
                    return await fallback_client.generate(
                        messages=messages,
                        temperature=0.1,
                        max_tokens=2048,
                        system_prompt=_AGENT_SYSTEM_PROMPT
                    )
                except Exception as fe:
                    logger.error("agent_llm_fallback_failed", error=str(fe))
                    raise fe
            else:
                raise e

    def _parse_react(self, text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Parse Thought, Action, Action Input, or Final Answer from LLM response."""
        thought = None
        action = None
        action_input = None
        final_answer = None

        # Parse Thought
        thought_match = re.search(r"Thought:\s*(.*?)(?=(Action:|Final Answer:|$))", text, re.DOTALL | re.IGNORECASE)
        if thought_match:
            thought = thought_match.group(1).strip()

        # Parse Action
        action_match = re.search(r"Action:\s*(\w+)", text, re.IGNORECASE)
        action_input_match = re.search(r"Action Input:\s*(.*)", text, re.DOTALL | re.IGNORECASE)

        if action_match:
            action = action_match.group(1).strip()
            if action_input_match:
                action_input = action_input_match.group(1).strip()
                # Clean up any potential markdown code blocks or brackets
                action_input = re.sub(r"^[`'\"\s]+|[`'\"\s]+$", "", action_input)

        # Parse Final Answer
        final_match = re.search(r"Final Answer:\s*(.*)", text, re.DOTALL | re.IGNORECASE)
        if final_match:
            final_answer = final_match.group(1).strip()

        # Fallback if no specific tags found
        if not action and not final_answer:
            if "Final Answer:" in text:
                parts = text.split("Final Answer:")
                final_answer = parts[-1].strip()
            else:
                final_answer = text.strip()

        return thought, action, action_input, final_answer

    async def run(self, user_query: str) -> AsyncGenerator[str, None]:
        """
        Run the ReAct research agent loop.
        Yields raw streaming tokens or status blocks so the client can follow the reasoning path.
        """
        logger.info("agent_run_start", query=user_query)

        # 1. Run Input Safety and Relevance Guardrails
        from core.guardrails import ClinicalGuardrails
        is_safe, guard_err = ClinicalGuardrails.validate_input(user_query)
        if not is_safe:
            yield f"### ⚠️ Safety Guardrail Blocked\n*{guard_err}*\n"
            return

        # 2. Graceful Fallback if LLM is not configured
        if not settings.active_llm_key:
            yield "### ⚠️ MEDICA Notice\n*No LLM API Key is configured. Running in Local Direct Retrieval Fallback Mode.*\n\n"
            yield f"[thought] Executing local hybrid search fallback for: '{user_query}'...[/thought]\n"

            # Run a direct retrieval + claim verification fallback
            retrieval_text = await retrieve_papers(user_query, limit=5)
            yield f"[call] Calling retrieve_papers(query='{user_query}') [/call]\n"
            yield f"[observation]\n{retrieval_text}\n[/observation]\n"

            # Run verification on the main query terms
            claim_text = await verify_claim(user_query)
            yield f"[call] Calling verify_claim(claim='{user_query}') [/call]\n"
            yield f"[observation]\n{claim_text}\n[/observation]\n"

            yield "\n**Final Answer**: Based on direct local knowledge base search, here are the relevant oncology trials and verification statistics matching your request:\n\n"
            yield retrieval_text
            yield "\n\n"
            yield claim_text
            return

        # 3. Main ReAct Loop
        history: List[Dict[str, str]] = []
        step = 0
        prompt = f"Question: {user_query}"

        while step < self.max_steps:
            step += 1
            yield f"[thought] Reasoning step {step} of {self.max_steps}... [/thought]\n"

            try:
                # Get model response
                logger.debug("agent_llm_call", step=step)
                llm_response = await self._call_llm(prompt, history)
                logger.debug("agent_llm_response", response=llm_response)

                thought, action, action_input, final_answer = self._parse_react(llm_response)

                # Stream the thought to the user
                if thought:
                    yield f"[thought] {thought} [/thought]\n"

                # Check if we have a Final Answer
                if final_answer:
                    # Run Output groundedness and statistical self-healing checks
                    _, verified_answer = await ClinicalGuardrails.validate_output(final_answer, user_query)
                    yield f"\n{verified_answer}"
                    logger.info("agent_run_success", step=step)
                    return

                # Check if we need to call a tool
                if action and action in self.tools:
                    yield f"[call] Running `{action}({action_input or ''})` [/call]\n"

                    # Execute tool
                    tool_func = self.tools[action]
                    try:
                        observation = await tool_func(action_input or "")
                    except Exception as tool_err:
                        observation = f"Error executing tool {action}: {str(tool_err)}"

                    yield f"[observation]\n{observation}\n[/observation]\n"

                    # Append to history
                    history.append({"role": "user", "content": prompt})
                    history.append({"role": "assistant", "content": llm_response})

                    # Prepare prompt for next step
                    prompt = f"Observation:\n{observation}"
                else:
                    # Invalid action or no action - yield response as final
                    yield f"\n{llm_response}"
                    return

            except Exception as e:
                logger.error("agent_step_error", step=step, error=str(e))
                yield f"\n### ⚠️ Agent Reasoning Interrupted\n*The LLM Provider returned an API error: {str(e)}.*\n"
                yield "*Automatically shifting database session to local Direct Retrieval Fallback Mode...*\n\n"
                
                yield f"[thought] Executing local hybrid search fallback for: '{user_query}'...[/thought]\n"
                
                # Run direct retrieval
                retrieval_text = await retrieve_papers(user_query, limit=5)
                yield f"[call] Calling retrieve_papers(query='{user_query}') [/call]\n"
                yield f"[observation]\n{retrieval_text}\n[/observation]\n"

                # Run claim verification
                claim_text = await verify_claim(user_query)
                yield f"[call] Calling verify_claim(claim='{user_query}') [/call]\n"
                yield f"[observation]\n{claim_text}\n[/observation]\n"

                yield "\n**Final Answer (Direct Local Search Fallback)**: Here are the relevant oncology trials and verification statistics found in the local knowledge base:\n\n"
                yield retrieval_text
                yield "\n\n"
                yield claim_text
                return

        # Max steps reached
        yield f"\n### Research Limit Reached\nCould not resolve final answer within {self.max_steps} reasoning steps. Please refine your query."
