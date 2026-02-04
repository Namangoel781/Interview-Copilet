
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class TestCase(BaseModel):
    input: Dict[str, Any]
    output: Any
    explanation: Optional[str] = None

class GenerateProblemIn(BaseModel):
    topic: str
    difficulty: str = "Medium" # Easy, Medium, Hard

class GenerateProblemOut(BaseModel):
    id: str  # Generated ID (e.g. slug of title)
    title: str
    difficulty: str
    description: str
    examples: List[TestCase]
    constraints: List[str]
    initial_code: str
    test_cases: List[TestCase] # Detailed test cases (including hidden ones ideally, but for now we trust client or send them)
    solution: str
    hints: List[str]

class CodeSuggestionIn(BaseModel):
    topic: str
    difficulty: str
    problem_description: str
    user_code: str

class CodeSuggestionOut(BaseModel):
    suggestion_code: str
    explanation: str

