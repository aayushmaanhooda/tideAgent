import base64
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from src.config import settings

SYSTEM_PROMPT = """You are an expert computer vision annotation specialist. Your job is to analyze a new image and return the object categories that should be detected in it.

You will be given:
- Several reference images with their human-drawn annotations (labels + bounding boxes)
- One new unlabeled image to analyze

## How to use the reference images

The reference images are NOT a list of things to copy blindly. They show you the **annotation style** of the human expert who labeled this dataset:
- What level of detail did they annotate? (just main subjects, or also background objects?)
- Did they label accessories separately (e.g. "backpack" as its own box, or only "person"?)
- Did they annotate partially visible objects at edges?
- Did they use broad labels ("vehicle") or specific ones ("bus", "truck")?

Study this style carefully. Your annotations on the new image should feel like they came from the same human annotator.

## Rules for what to detect in the new image

**Match the style, then apply it faithfully:**
- Only annotate object categories that are genuinely visible in the new image
- Do NOT hallucinate objects or assume they exist because reference images have them
- Do NOT list every possible object — only what is actually there

**Be thorough within the style:**
- If the annotator labeled small background objects, do the same for the new image
- If the annotator labeled partially visible objects at edges, follow that
- Include objects that are easy to miss: partially occluded, in shadows, small in frame, blurry from motion
- Notice accessories and what people are holding or wearing
- Check all corners and edges of the image — objects hide there
- Always include large structures visible in the scene: buildings, houses, walls, bridges, fences
- Always include environmental elements: sky, water, sand, road, vegetation if they are dominant in the scene
- If there are crowds of people, still label "person" — the detector will find all instances from one label

**Use the same label vocabulary:**
- Use the exact same label names the reference annotator used
- If reference uses "motorcycle" not "motorbike", use "motorcycle"
- Only introduce a new label name if the new image has a clearly distinct object not in any reference

Return ONLY the list of label strings. No explanations, no bounding boxes."""


CONTEXT_FREE_SYSTEM_PROMPT = """You are an expert computer vision annotation specialist. Your job is to analyze an image and return every object category that should be detected in it.

You have NO reference images. Analyze the image purely on its own.

## Rules

**Be extremely thorough and detailed:**
- Identify every distinct object visible in the image — large and small
- Include partially visible objects at edges and corners of the frame
- Include objects that are easy to miss: partially occluded, in shadows, small in frame, blurry from motion
- Notice accessories, items people are holding or wearing (bag, hat, phone, glasses, etc.)
- Include vehicles, furniture, appliances, tools, food items — anything identifiable
- Include large structures: buildings, houses, walls, bridges, fences, poles, signs
- Include environmental/background elements if dominant: sky, water, sand, road, grass, trees, vegetation, clouds, snow, mountain
- If there are multiple instances of the same object, still list the label once — the detector handles instances
- Check ALL regions of the image: foreground, midground, background, edges, corners

**Ocean, beach, and water safety — pay extra attention:**
- Detect every person visible in or near water, on the beach, or on watercraft — even partially submerged, distant, or silhouetted
- Look for swimmers, surfers, bodyboarders, kayakers, paddleboarders, divers, snorkelers
- Detect rip currents — look for discolored, choppy, or channeled water flowing outward from shore
- Detect marine life: fish, jellyfish, shark, dolphin, whale, seal, seabird, pelican, seagull
- Detect water conditions and hazards: wave, foam, whitecap, rough water, calm water
- Detect beach infrastructure: lifeguard tower, lifeguard, warning flag, buoy, pier, boardwalk, beach umbrella, beach chair, surfboard, boat, jet ski
- Detect natural features: sand, ocean, shoreline, reef, rock, cliff, tide pool, seaweed, coral

**Label naming:**
- Use common, specific object names (e.g. "motorcycle" not "two-wheeled vehicle")
- Use lowercase labels
- Be specific where possible: "traffic light" not "light", "dining table" not "surface"
- For water safety: prefer specific labels like "rip current", "swimmer", "surfer" over generic ones

**Do NOT:**
- Hallucinate objects that are not visible
- List abstract concepts (e.g. "movement", "action")
- Include labels for textures or materials unless they are a distinct object

Return ONLY the list of label strings. No explanations, no bounding boxes."""


class DetectionLabels(BaseModel):
    labels: list[str] = Field(description="All object categories to detect in the new image")


claude_llm = ChatAnthropic(
    model="claude-opus-4-6",
    api_key=settings.claude_api_key,
    max_tokens=1024,
)
claude_structured = claude_llm.with_structured_output(DetectionLabels, method="json_schema")

openai_llm = ChatOpenAI(
    model="gpt-4o",
    api_key=settings.openai_api_key,
    max_tokens=1024,
)
openai_structured = openai_llm.with_structured_output(DetectionLabels)


def _encode_image(image_bytes: bytes) -> str:
    return base64.standard_b64encode(image_bytes).decode("utf-8")


def _mime_type(image_bytes: bytes) -> str:
    """Detect actual image format from magic bytes."""
    if image_bytes[:4] == b"\x89PNG":
        return "image/png"
    if image_bytes[:4] in (b"RIFF",) and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    if image_bytes[:3] == b"GIF":
        return "image/gif"
    return "image/jpeg"


def _build_claude_content(new_image_bytes: bytes, context: list[dict]) -> list:
    content = []
    for i, ctx in enumerate(context):
        content.append({
            "type": "text",
            "text": f"Reference image {i + 1} — annotated labels: {ctx['labels']}\nBounding boxes (x1,y1,x2,y2): {ctx['boxes']}"
        })
        content.append({
            "type": "image",
            "base64": _encode_image(ctx["image_bytes"]),
            "mime_type": _mime_type(ctx["image_bytes"]),
        })
    content.append({
        "type": "text",
        "text": "Now here is the NEW image that needs to be annotated. Based on the reference images above and your own detailed visual analysis, list every object category that should be detected in this image:"
    })
    content.append({
        "type": "image",
        "base64": _encode_image(new_image_bytes),
        "mime_type": _mime_type(new_image_bytes),
    })
    return content


def _build_openai_content(new_image_bytes: bytes, context: list[dict]) -> list:
    content = []
    for i, ctx in enumerate(context):
        mime = _mime_type(ctx["image_bytes"])
        b64 = _encode_image(ctx["image_bytes"])
        content.append({
            "type": "text",
            "text": f"Reference image {i + 1} — annotated labels: {ctx['labels']}\nBounding boxes (x1,y1,x2,y2): {ctx['boxes']}"
        })
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}"}
        })
    mime = _mime_type(new_image_bytes)
    b64 = _encode_image(new_image_bytes)
    content.append({
        "type": "text",
        "text": "Now here is the NEW image that needs to be annotated. Based on the reference images above and your own detailed visual analysis, list every object category that should be detected in this image:"
    })
    content.append({
        "type": "image_url",
        "image_url": {"url": f"data:{mime};base64,{b64}"}
    })
    return content


def _is_overloaded(error: Exception) -> bool:
    msg = str(error).lower()
    return "529" in msg or "overloaded" in msg


async def get_detection_labels(
    new_image_bytes: bytes,
    context: list[dict],
) -> list[str]:
    # Try Claude first
    try:
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=_build_claude_content(new_image_bytes, context)),
        ]
        result = await claude_structured.ainvoke(messages)
        return result.labels
    except Exception as e:
        if not _is_overloaded(e):
            raise
        print(f"Claude overloaded, falling back to GPT-4o: {e}")

    # Fallback to GPT-4o
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=_build_openai_content(new_image_bytes, context)),
    ]
    result = await openai_structured.ainvoke(messages)
    return result.labels


async def get_context_free_labels(image_bytes: bytes) -> list[str]:
    """Analyze an image without any COCO context — Claude decides labels purely from the image."""
    image_content = [
        {
            "type": "text",
            "text": "Analyze this image carefully. List every object category that should be detected:"
        },
        {
            "type": "image",
            "base64": _encode_image(image_bytes),
            "mime_type": _mime_type(image_bytes),
        },
    ]

    # Try Claude first
    try:
        messages = [
            SystemMessage(content=CONTEXT_FREE_SYSTEM_PROMPT),
            HumanMessage(content=image_content),
        ]
        result = await claude_structured.ainvoke(messages)
        return result.labels
    except Exception as e:
        if not _is_overloaded(e):
            raise
        print(f"Claude overloaded, falling back to GPT-4o: {e}")

    # Fallback to GPT-4o
    mime = _mime_type(image_bytes)
    b64 = _encode_image(image_bytes)
    openai_content = [
        {
            "type": "text",
            "text": "Analyze this image carefully. List every object category that should be detected:"
        },
        {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}"}
        },
    ]
    messages = [
        SystemMessage(content=CONTEXT_FREE_SYSTEM_PROMPT),
        HumanMessage(content=openai_content),
    ]
    result = await openai_structured.ainvoke(messages)
    return result.labels
