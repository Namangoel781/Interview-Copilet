from fastapi import APIRouter, Depends, HTTPException
from settings import settings
from openai import AsyncOpenAI
from schemas_simulator import GenerateProblemIn, GenerateProblemOut
from services.ai_helpers import generate_problem_prompt, extract_first_json_object
import json
import os

router = APIRouter(
    prefix="/simulator",
    tags=["simulator"],
)

# Configure OpenAI
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)

@router.post("/generate", response_model=GenerateProblemOut)
async def generate_problem(payload: GenerateProblemIn):
    try:
        prompt = generate_problem_prompt(payload.topic, payload.difficulty)
        
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",

            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates coding problems in JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            timeout=60.0
        )


        
        text_resp = response.choices[0].message.content
        
        json_str = extract_first_json_object(text_resp)
        if not json_str:
             # Fallback or retry logic could go here, for now fail
             raise ValueError("AI did not return valid JSON")
             
        data = json.loads(json_str)
        return GenerateProblemOut(**data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from schemas_simulator import CodeSuggestionIn, CodeSuggestionOut
from ai import generate_code_suggestion

@router.post("/suggest-code", response_model=CodeSuggestionOut)
async def suggest_code_endpoint(payload: CodeSuggestionIn):

    try:
        json_resp = generate_code_suggestion(
            payload.topic, 
            payload.difficulty, 
            payload.problem_description, 
            payload.user_code
        )
        
        # Parse the JSON string returned by AI
        import json
        from services.ai_helpers import extract_first_json_object
        
        cleaned_json = extract_first_json_object(json_resp)
        if not cleaned_json:
            raise ValueError("AI did not return valid JSON")
            
        data = json.loads(cleaned_json)
        return CodeSuggestionOut(**data)


        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DEBUG ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


