from langchain_core.prompts import PromptTemplate, ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage
from typing import Dict, Any, List, Optional

# Base Markdown Formatting System Prompt
BASE_MARKDOWN_SYSTEM_PROMPT = """You are an expert AI assistant that ALWAYS responds in well-formatted Markdown. You must follow these formatting guidelines strictly:

## Markdown Formatting Rules:

### Headers (Use appropriately for content hierarchy):
```
# Main Title (H1) - Use sparingly, only for document titles
## Section Headers (H2) - For major sections
### Subsection Headers (H3) - For subsections
#### Minor Headers (H4) - For detailed breakdowns
##### Small Headers (H5) - For fine-grained organization
###### Smallest Headers (H6) - For the most granular details
```

### Text Formatting:
- **Bold text** for emphasis and important points
- *Italic text* for subtle emphasis or technical terms
- ***Bold and italic*** for critical information
- `inline code` for technical terms, commands, or variables
- ~~strikethrough~~ for corrections or deprecated information

### Lists:
**Unordered Lists:**
- Use hyphens (-) for main points
  - Use indentation for sub-points
    - Multiple levels supported
- Keep list items concise but informative

**Ordered Lists:**
1. Use numbers for sequential steps
2. Or for ranked/prioritized information
   a. Use letters for sub-steps
   b. Maintain logical flow
3. Ensure proper numbering

### Code Blocks:
```language
Use triple backticks with language specification
Always specify the programming language
Include proper indentation
Add comments when helpful
```

### Blockquotes:
> Use for citations, important notes, or highlighted information
> Can span multiple lines
>> Use double arrows for nested quotes

### Tables:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Use for structured information |

### Links and Images:
- [Link text](URL) for external references
- ![Alt text](image-url) for images
- Use descriptive link text

### Horizontal Rules:
---
Use three dashes for section breaks

### Task Lists:
- [x] Completed tasks
- [ ] Pending tasks
- Use for action items or checklists

### Special Elements:
- Use `---` for page breaks between major sections
- Use `>` for callouts and important notices
- Use proper spacing between elements for readability

## Response Structure Guidelines:

1. **Start with a clear title** (# or ##) when appropriate
2. **Use logical hierarchy** - headers should flow naturally
3. **Break up large text blocks** with headers, lists, or blockquotes
4. **Include relevant code examples** when technical topics are discussed
5. **Use tables for comparative or structured data**
6. **End with actionable next steps** when appropriate

## Formatting Quality Standards:

- **Consistency**: Maintain the same formatting style throughout
- **Readability**: Use whitespace effectively to separate sections
- **Accessibility**: Write descriptive alt text for images and clear link text
- **Professionalism**: Keep formatting clean and purposeful
- **Completeness**: Ensure all code blocks have language tags

## Content Enhancement:
- Provide **comprehensive answers** with proper depth
- Include **relevant examples** when explaining concepts
- Use **visual formatting** to highlight key information
- Structure responses to be **scannable and digestible**
- Add **context and background** when necessary

Remember: Every response must be properly formatted Markdown. No plain text responses allowed."""

# Query Processing Prompt Template
QUERY_PROCESSOR_PROMPT = PromptTemplate(
    input_variables=["user_query", "context", "additional_instructions"],
    template="""## Query Analysis and Processing

**User Query:** {user_query}

**Context Information:** 
{context}

**Additional Instructions:**
{additional_instructions}

## Processing Instructions:

1. **Analyze the user's query** thoroughly to understand intent
2. **Identify key topics** that need to be addressed
3. **Determine the appropriate response format** based on query type
4. **Structure your response** using proper Markdown formatting
5. **Provide comprehensive information** while maintaining clarity

## Response Requirements:

- Use appropriate Markdown formatting for all content
- Structure information hierarchically with proper headers
- Include relevant examples, code blocks, or tables as needed
- Ensure the response directly addresses the user's question
- Provide actionable information when applicable

## Begin Response:
"""
)

# Chainable Prompt Template for Additional Context
CHAINABLE_CONTEXT_PROMPT = PromptTemplate(
    input_variables=["previous_context", "new_instruction", "specific_focus"],
    template="""## Additional Context and Instructions

**Previous Context:**
{previous_context}

**New Instruction:**
{new_instruction}

**Specific Focus Areas:**
{specific_focus}

## Enhanced Processing Guidelines:

Building on the previous context, ensure your response:

1. **Integrates new information** seamlessly with existing context
2. **Maintains formatting consistency** with established Markdown standards
3. **Addresses the specific focus areas** mentioned above
4. **Provides enhanced depth** based on the additional instructions
5. **Preserves logical flow** from any previous conversation

Continue with your enhanced response following all Markdown formatting guidelines."""
)

# Chat-based Prompt Template for Conversations
CHAT_PROMPT_TEMPLATE = ChatPromptTemplate.from_messages([
    ("system", BASE_MARKDOWN_SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{user_input}")
])

# Specialized Prompt Templates for Different Use Cases

# Technical Documentation Prompt
TECHNICAL_DOCS_PROMPT = PromptTemplate(
    input_variables=["topic", "technical_level", "specific_requirements"],
    template="""## Technical Documentation Request

**Topic:** {topic}
**Technical Level:** {technical_level}
**Specific Requirements:** {specific_requirements}

## Documentation Standards:

Create comprehensive technical documentation with:

### Structure Requirements:
- **Clear hierarchy** with appropriate header levels
- **Code examples** with proper syntax highlighting
- **Step-by-step instructions** using ordered lists
- **Technical specifications** in tables when appropriate
- **Troubleshooting sections** with common issues
- **References and links** to additional resources

### Content Requirements:
- **Prerequisites** clearly stated
- **Detailed explanations** with examples
- **Best practices** and recommendations
- **Security considerations** when applicable
- **Performance implications** where relevant

Generate the technical documentation following all Markdown formatting standards."""
)

# Code Review and Explanation Prompt
CODE_REVIEW_PROMPT = PromptTemplate(
    input_variables=["code_snippet", "language", "review_focus"],
    template="""## Code Review and Analysis

**Programming Language:** {language}
**Review Focus:** {review_focus}

**Code to Review:**
```{language}
{code_snippet}
```

## Review Guidelines:

Provide a comprehensive code review including:

### Analysis Sections:
1. **Code Overview** - What the code does
2. **Structure Analysis** - Organization and architecture
3. **Best Practices** - Adherence to coding standards
4. **Potential Issues** - Bugs, security concerns, performance
5. **Improvements** - Specific recommendations
6. **Examples** - Show better alternatives when applicable

### Formatting Requirements:
- Use appropriate code blocks with language specification
- Highlight specific lines or functions using inline code
- Create tables for comparison when showing before/after
- Use blockquotes for important warnings or notes
- Structure with clear headers and subheaders

Begin your comprehensive code review."""
)

# Creative Content Prompt
CREATIVE_CONTENT_PROMPT = PromptTemplate(
    input_variables=["content_type", "theme", "style_requirements", "length"],
    template="""## Creative Content Generation

**Content Type:** {content_type}
**Theme/Topic:** {theme}
**Style Requirements:** {style_requirements}
**Target Length:** {length}

## Creative Guidelines:

Generate creative content with proper Markdown formatting:

### Formatting for Creative Content:
- **Use headers** to structure narrative or content sections
- **Emphasize key phrases** with bold and italic formatting
- **Include dialogue** using blockquotes when appropriate
- **Create visual breaks** with horizontal rules
- **Use lists** for character descriptions, plot points, or features
- **Format any included code or technical elements** properly

### Content Quality Standards:
- **Engaging opening** that captures attention
- **Clear structure** with logical flow
- **Rich descriptions** using varied formatting
- **Compelling conclusion** or call-to-action
- **Professional presentation** despite creative nature

Create the content following all Markdown standards while maintaining creativity."""
)

# Prompt Chaining Helper Functions
class PromptChainer:
    """Helper class for chaining prompts together"""
    
    def __init__(self):
        self.context_history = []
        self.formatting_enforced = True
    
    def add_base_formatting(self, prompt: str) -> str:
        """Add base Markdown formatting requirements to any prompt"""
        if self.formatting_enforced:
            return f"{BASE_MARKDOWN_SYSTEM_PROMPT}\n\n---\n\n{prompt}"
        return prompt
    
    def chain_prompts(self, *prompts: PromptTemplate, **kwargs) -> str:
        """Chain multiple prompts together"""
        chained_content = []
        
        # Add base formatting
        chained_content.append(BASE_MARKDOWN_SYSTEM_PROMPT)
        chained_content.append("---")
        
        # Process each prompt
        for i, prompt in enumerate(prompts):
            try:
                formatted_prompt = prompt.format(**kwargs)
                chained_content.append(f"## Chain Step {i+1}")
                chained_content.append(formatted_prompt)
                chained_content.append("---")
            except KeyError as e:
                chained_content.append(f"**Error in prompt {i+1}:** Missing variable {e}")
        
        return "\n\n".join(chained_content)
    
    def create_conversation_prompt(self, user_query: str, context: str = "", 
                                 additional_instructions: str = "") -> Dict[str, Any]:
        """Create a complete conversation prompt with all components"""
        
        return {
            "system_prompt": BASE_MARKDOWN_SYSTEM_PROMPT,
            "user_prompt": QUERY_PROCESSOR_PROMPT.format(
                user_query=user_query,
                context=context,
                additional_instructions=additional_instructions
            )
        }

# Preset Prompt Combinations
PROMPT_COMBINATIONS = {
    "technical_help": {
        "system": BASE_MARKDOWN_SYSTEM_PROMPT,
        "processor": TECHNICAL_DOCS_PROMPT,
        "description": "For technical documentation and help requests"
    },
    
    "code_assistance": {
        "system": BASE_MARKDOWN_SYSTEM_PROMPT,
        "processor": CODE_REVIEW_PROMPT,
        "description": "For code review, debugging, and programming help"
    },
    
    "creative_writing": {
        "system": BASE_MARKDOWN_SYSTEM_PROMPT,
        "processor": CREATIVE_CONTENT_PROMPT,
        "description": "For creative content generation"
    },
    
    "general_chat": {
        "system": BASE_MARKDOWN_SYSTEM_PROMPT,
        "processor": QUERY_PROCESSOR_PROMPT,
        "description": "For general conversation and queries"
    }
}

# Usage Examples and Testing
def get_prompt_by_type(prompt_type: str, **kwargs) -> PromptTemplate:
    """Get a specific prompt type with parameters"""
    
    prompt_map = {
        "query": QUERY_PROCESSOR_PROMPT,
        "chain": CHAINABLE_CONTEXT_PROMPT,
        "technical": TECHNICAL_DOCS_PROMPT,
        "code": CODE_REVIEW_PROMPT,
        "creative": CREATIVE_CONTENT_PROMPT
    }
    
    if prompt_type not in prompt_map:
        raise ValueError(f"Unknown prompt type: {prompt_type}")
    
    return prompt_map[prompt_type]

# Integration with your streaming system
def create_streaming_prompt_state(user_query: str, prompt_type: str = "general_chat", 
                                context: str = "", **kwargs) -> Dict[str, Any]:
    """Create prompt state compatible with your streaming system"""
    
    chainer = PromptChainer()
    
    if prompt_type == "general_chat":
        prompt_data = chainer.create_conversation_prompt(
            user_query=user_query,
            context=context,
            additional_instructions=kwargs.get("additional_instructions", "")
        )
    else:
        # Use specialized prompts
        combo = PROMPT_COMBINATIONS.get(prompt_type, PROMPT_COMBINATIONS["general_chat"])
        prompt_data = {
            "system_prompt": combo["system"],
            "user_prompt": user_query
        }
    
    return {
        "persona": prompt_data["system_prompt"],
        "messages": [{"role": "user", "content": prompt_data["user_prompt"]}],
        "formatting_enforced": True,
        "prompt_type": prompt_type
    }