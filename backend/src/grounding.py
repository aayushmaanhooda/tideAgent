import modal


async def run_grounding_dino_via_modal(image_bytes: bytes, labels: list[str]) -> list[dict]:
    """
    Calls Grounding DINO on Modal GPU.
    Returns [{label, bbox: [x1,y1,x2,y2], confidence}, ...]
    """
    run_grounding_dino = modal.Function.from_name("tide-dinov2", "run_grounding_dino")
    return await run_grounding_dino.remote.aio(image_bytes, labels)
