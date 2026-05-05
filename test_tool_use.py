import sys
import os
import json
from datetime import datetime

sys.path.append('backend')
from main import chat_with_bot, ChatRequest

def test_tool_use():
    user_id = '138db9c1-54c7-45cf-99b7-4fe52d5dbe3d'
    
    print("\n--- Testing Add Manual Notification ---")
    req1 = ChatRequest(
        prompt="Add a quiz for NLP tomorrow at 10am",
        user_id=user_id
    )
    res1 = chat_with_bot(req1)
    print(f"Response: {res1.response}")
    print(f"Action: {res1.action}")
    print(f"Action Result: {res1.action_result}")

    print("\n--- Testing Roman Urdu mark as done ---")
    # We need a real ID from the previous step if possible, but let's just try with a dummy first to see the tool call
    req2 = ChatRequest(
        prompt="Mera task 1 complete ho gaya hai",
        user_id=user_id
    )
    res2 = chat_with_bot(req2)
    print(f"Response: {res2.response}")
    print(f"Action: {res2.action}")
    
    print("\n--- Testing Delete with Confirmation ---")
    req3 = ChatRequest(
        prompt="Delete task 100",
        user_id=user_id
    )
    res3 = chat_with_bot(req3)
    print(f"Response: {res3.response}")
    # It should ask for confirmation
    
if __name__ == "__main__":
    test_tool_use()
