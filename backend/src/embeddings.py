import modal


async def generate_embeddings_via_modal(images_bytes_list: list[bytes]) -> list[list[float]]:
    """
    Send a batch of image bytes to Modal GPU function and get back 768-dim embeddings.
    Calls get_embeddings_batch which loads DINOv2 once on the GPU container.
    """
    get_embeddings_batch = modal.Function.from_name("tide-dinov2", "get_embeddings_batch")
    return await get_embeddings_batch.remote.aio(images_bytes_list)
